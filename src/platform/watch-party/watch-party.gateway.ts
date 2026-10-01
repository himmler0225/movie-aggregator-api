import '../../load-env';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { WatchRoom } from '@prisma/client';
import { createAdapter } from '@socket.io/redis-adapter';
import { Namespace, Server, Socket } from 'socket.io';
import {
  AppConfigService,
  loadAppConfig,
  resolveCorsOriginOption,
} from '../../config';
import { RedisService } from '../../infra/redis';
import { AppLogger } from '../../shared/logger';
import { MoviesService } from '../../movies/movies.service';
import { RoomMembersRepository } from '../../database/repositories/room-members.repository';
import { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import type {
  BroadcastWsPayload,
  BufferingViewer,
  EpisodeChangeReason,
  EpisodeChangeWsPayload,
  EpisodeEndedWsPayload,
  EpisodeQueueItem,
  GatewaySocketData,
  JoinWsPayload,
  JwtPayload,
  PlaybackEventType,
  PlaybackEventWsPayload,
  PlaybackStateMsg,
  PresencePayload,
  ReactionWsPayload,
  RoomControlState,
  RoomMediaState,
  RoomMessageView,
  ViewerStatusWsPayload,
} from '../types';
import { MomentsService } from '../moments/moments.service';
import { isReactionEmoji } from '../moments/moments.constants';
import {
  canControlPlayback,
  toControlMsg,
  toControlState,
} from './room-control';
import {
  MAX_EPISODE_NAME_LENGTH,
  removeFromQueue,
  toMediaMsg,
  toMediaState,
} from './room-media';
import { WatchPartyStore } from './watch-party.store';

const gatewayCors = (() => {
  const { corsOrigins } = loadAppConfig();
  return {
    origin: resolveCorsOriginOption(corsOrigins),
    credentials: true,
  } as const;
})();

const SEEK_DEBOUNCE_MS = 80;
/** Longest the room waits for one buffering viewer before playing on. */
const BUFFER_MAX_WAIT_MS = 15_000;
/** After the room gave up on a viewer, ignore their buffering this long. */
const BUFFER_COOLDOWN_MS = 60_000;
/** Buffering entries older than this are leftovers from a dead instance. */
const BUFFER_STALE_MS = BUFFER_MAX_WAIT_MS * 2;
/** Viewers further than this from the room position get corrected. */
const DRIFT_TOLERANCE_S = 2;
/** How long a disconnected host has to come back before the host moves on. */
const HOST_GRACE_MS = 30_000;
/** Minimum gap between two reactions from one socket. */
const REACTION_MIN_INTERVAL_MS = 250;
const userRoom = (userId: string) => `user:${userId}`;
const PLAYBACK_EVENT_TYPES: ReadonlySet<PlaybackEventType> = new Set([
  'PLAY',
  'PAUSE',
  'SEEK',
]);

interface PendingSeek {
  timer: NodeJS.Timeout;
  roomId: string;
  time: number;
}

interface PlaybackCommand {
  type: PlaybackEventType;
  time: number;
  isPlaying?: boolean;
  auto?: boolean;
}

interface BufferingEntry {
  roomCode: string;
  roomId: string;
  timer: NodeJS.Timeout;
}

export type HostChangeReason = 'host_left' | 'transferred';

/** Where playback is now, extrapolating from the last committed state. */
export function currentPlaybackTime(
  state: Pick<PlaybackStateMsg, 'time' | 'isPlaying' | 'updatedAt'>,
  now = Date.now(),
): number {
  if (!state.isPlaying) return state.time;
  return state.time + Math.max(0, now - state.updatedAt) / 1000;
}

@WebSocketGateway({
  namespace: '/watch-party',
  cors: gatewayCors,
})
export class WatchPartyGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit<Namespace>
{
  private readonly logger = AppLogger.create(WatchPartyGateway.name);
  @WebSocketServer()
  server!: Server;
  private readonly pendingSeeks = new Map<string, PendingSeek>();
  private readonly commitQueues = new Map<string, Promise<boolean>>();
  private readonly bufferingBySocket = new Map<string, BufferingEntry>();
  private readonly bufferCooldownUntil = new Map<string, number>();
  private readonly hostTransferTimers = new Map<string, NodeJS.Timeout>();
  private readonly lastReactionAt = new Map<string, number>();
  constructor(
    private readonly jwt: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    private readonly rooms: WatchRoomsRepository,
    private readonly members: RoomMembersRepository,
    private readonly store: WatchPartyStore,
    private readonly movies: MoviesService,
    private readonly moments: MomentsService,
  ) {}
  afterInit(server: Namespace) {
    const pubClient = this.redis.getClient();
    if (!pubClient) return;
    const subClient = this.redis.createSubscriber();
    if (!subClient) return;
    server.server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('Socket.IO Redis adapter attached');
  }
  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.appConfig.jwtSecret,
      });
      (client.data as GatewaySocketData).userId = payload.sub;
      // Personal channel for reminders, whatever room the user is in.
      void client.join(userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }
  async handleDisconnect(client: Socket) {
    const data = client.data as GatewaySocketData;
    this.bufferCooldownUntil.delete(client.id);
    this.lastReactionAt.delete(client.id);
    if (!data.roomCode) return;
    try {
      await this.leaveRoom(client, data.roomCode);
    } catch (err) {
      this.logError(`Disconnect cleanup failed for ${data.roomCode}`, err);
    }
  }
  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: JoinWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || !body.presence || !data.userId) return { ok: false };
    const room = await this.rooms.findByCode(roomCode);
    if (!room) return { ok: false };
    if (
      room.isPrivate &&
      room.hostId !== data.userId &&
      !(await this.members.isMember(room.id, data.userId))
    ) {
      return { ok: false, error: 'platform.notRoomMember' };
    }
    if (data.roomCode && data.roomCode !== roomCode) {
      void client.leave(data.roomCode);
      await this.leaveRoom(client, data.roomCode);
    }
    void client.join(roomCode);
    data.roomCode = roomCode;
    data.roomId = room.id;
    const control = await this.loadControl(roomCode, room);
    const presence: PresencePayload = {
      ...body.presence,
      userId: data.userId,
      isHost: control?.hostId === data.userId,
    };
    data.presence = presence;
    if (control?.hostId === data.userId) this.cancelHostTransfer(roomCode);
    await this.store.setPresence(roomCode, client.id, presence);
    client.to(roomCode).emit('presence:join', presence);
    await this.emitPresenceSync(roomCode);
    const cached = await this.store.getPlayback(roomCode);
    const playbackState: PlaybackStateMsg = cached
      ? { ...cached, type: cached.isPlaying ? 'PLAY' : 'PAUSE' }
      : {
          type: room.isPlaying ? 'PLAY' : 'PAUSE',
          time: room.playbackTime,
          isPlaying: room.isPlaying,
          seq: 0,
          updatedAt: Date.now(),
        };
    client.emit('playback:sync', playbackState);
    if (control) client.emit('room:control', toControlMsg(control));
    const media = await this.loadMedia(roomCode, room);
    if (media) client.emit('room:media', toMediaMsg(media));
    const waiting = await this.listWaiting(roomCode);
    if (waiting.length) client.emit('playback:waiting', { users: waiting });
    return { ok: true };
  }
  @SubscribeMessage('broadcast')
  handleBroadcast(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: BroadcastWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || roomCode !== data.roomCode) return { ok: false };
    if (!body.event || typeof body.event !== 'string') return { ok: false };
    client.to(roomCode).emit('broadcast', {
      event: body.event,
      payload: body.payload ?? {},
    });
    return { ok: true };
  }
  @SubscribeMessage('playback:event')
  async handlePlaybackEvent(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: PlaybackEventWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || roomCode !== data.roomCode) return { ok: false };
    if (!data.roomId) return { ok: false };
    const type = body.type;
    const time = Number(body.time);
    if (!PLAYBACK_EVENT_TYPES.has(type)) return { ok: false };
    if (!Number.isFinite(time) || time < 0) return { ok: false };
    const control = await this.loadControl(roomCode);
    if (!control || !canControlPlayback(control, data.userId)) {
      return { ok: false };
    }
    const roomId = data.roomId;
    if (type === 'SEEK') {
      const pending = this.pendingSeeks.get(roomCode);
      if (pending) clearTimeout(pending.timer);
      const timer = setTimeout(() => {
        this.pendingSeeks.delete(roomCode);
        void this.enqueueCommit(roomCode, roomId, { type: 'SEEK', time });
      }, SEEK_DEBOUNCE_MS);
      this.pendingSeeks.set(roomCode, { timer, roomId, time });
      return { ok: true };
    }
    this.flushPendingSeek(roomCode);
    const ok = await this.enqueueCommit(roomCode, roomId, { type, time });
    return { ok };
  }
  /**
   * Viewers report their position and whether they are buffering every few
   * seconds. Buffering can pause the room until they catch up; a viewer that
   * drifted too far gets a `playback:correct`.
   */
  @SubscribeMessage('viewer:status')
  async handleViewerStatus(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: ViewerStatusWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || roomCode !== data.roomCode) return { ok: false };
    if (!data.roomId || typeof body.buffering !== 'boolean') {
      return { ok: false };
    }
    const time = Number(body.time);
    if (!Number.isFinite(time) || time < 0) return { ok: false };
    if (body.buffering) {
      await this.startBuffering(client, roomCode, data.roomId);
      return { ok: true };
    }
    await this.stopBuffering(client.id);
    const state = await this.store.getPlayback(roomCode);
    if (state) {
      const expected = currentPlaybackTime(state);
      if (Math.abs(time - expected) > DRIFT_TOLERANCE_S) {
        client.emit('playback:correct', {
          ...state,
          time: expected,
          updatedAt: Date.now(),
        });
      }
    }
    return { ok: true };
  }
  /** A controller switches the room to another episode. */
  @SubscribeMessage('episode:change')
  async handleEpisodeChange(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: EpisodeChangeWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || roomCode !== data.roomCode || !data.roomId) {
      return { ok: false };
    }
    const episodeName = body.episodeName;
    if (typeof episodeName !== 'string' || !episodeName.trim()) {
      return { ok: false };
    }
    if (episodeName.length > MAX_EPISODE_NAME_LENGTH) return { ok: false };
    const serverIndex = body.serverIndex;
    if (
      serverIndex !== undefined &&
      (!Number.isInteger(serverIndex) || serverIndex < 0)
    ) {
      return { ok: false };
    }
    const control = await this.loadControl(roomCode);
    if (!control || !canControlPlayback(control, data.userId)) {
      return { ok: false };
    }
    const roomId = data.roomId;
    const ok = await this.enqueue(roomCode, async () => {
      const media = await this.loadMedia(roomCode);
      if (!media) return false;
      return this.switchEpisode(roomCode, roomId, media, {
        item: {
          episode_name: episodeName,
          server_index: serverIndex ?? media.serverIndex,
        },
        reason: 'manual',
      });
    });
    return { ok };
  }
  /**
   * Any viewer reports the episode finished. With auto-next on, the room
   * moves to the head of the queue, or else to the next episode of the
   * movie. Duplicate reports for the same episode are ignored.
   */
  @SubscribeMessage('episode:ended')
  async handleEpisodeEnded(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: EpisodeEndedWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || roomCode !== data.roomCode || !data.roomId) {
      return { ok: false };
    }
    if (typeof body.episodeName !== 'string' || !body.episodeName) {
      return { ok: false };
    }
    const roomId = data.roomId;
    const ended = body.episodeName;
    const advanced = await this.enqueue(roomCode, async () => {
      const media = await this.loadMedia(roomCode);
      if (!media?.autoNext || media.episodeName !== ended) return false;
      const next = media.queue[0] ?? (await this.findNextEpisode(media));
      if (!next) return false;
      return this.switchEpisode(roomCode, roomId, media, {
        item: next,
        reason: 'auto_next',
        fromEpisode: ended,
      });
    });
    return { ok: true, advanced };
  }
  /** Emoji reaction at a point of the episode; shown live and counted for the heatmap. */
  @SubscribeMessage('reaction')
  async handleReaction(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: ReactionWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body?.roomCode?.toUpperCase();
    if (!roomCode || roomCode !== data.roomCode) return { ok: false };
    const time = Number(body.time);
    if (!isReactionEmoji(body.emoji)) return { ok: false };
    if (!Number.isFinite(time) || time < 0) return { ok: false };
    const now = Date.now();
    const last = this.lastReactionAt.get(client.id) ?? 0;
    if (now - last < REACTION_MIN_INTERVAL_MS) return { ok: false };
    this.lastReactionAt.set(client.id, now);
    this.server?.to(roomCode).emit('reaction', {
      user_id: data.userId,
      username: data.presence?.username ?? null,
      emoji: body.emoji,
      time,
    });
    const media = await this.loadMedia(roomCode);
    if (media?.episodeName) {
      this.moments.record({
        movieSlug: media.movieSlug,
        episodeName: media.episodeName,
        time,
        emoji: body.emoji,
      });
    }
    return { ok: true };
  }
  /** Applies a playback change made outside the socket (REST) so cached state and viewers follow it. */
  async applyPlaybackUpdate(
    roomCode: string,
    roomId: string,
    time: number,
    isPlaying: boolean,
  ) {
    const code = roomCode.toUpperCase();
    this.flushPendingSeek(code);
    await this.enqueueCommit(code, roomId, {
      type: isPlaying ? 'PLAY' : 'PAUSE',
      time,
      isPlaying,
    });
  }
  /** Caches the room's control settings and tells everyone in it. */
  async publishControl(roomCode: string, control: RoomControlState) {
    const code = roomCode.toUpperCase();
    await this.store.setControl(code, control);
    this.server?.to(code).emit('room:control', toControlMsg(control));
    await this.emitPresenceSync(code);
  }
  /**
   * Caches the room's episode and queue and tells everyone. With a reason,
   * the episode itself changed and clients should load the new source.
   */
  async publishMedia(
    roomCode: string,
    media: RoomMediaState,
    reason?: EpisodeChangeReason,
  ) {
    const code = roomCode.toUpperCase();
    await this.store.setMedia(code, media);
    const msg = toMediaMsg(media);
    this.server?.to(code).emit('room:media', msg);
    if (reason)
      this.server?.to(code).emit('episode:changed', { ...msg, reason });
  }
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }
  emitRoomStarting(roomCode: string, payload: unknown) {
    this.server?.to(roomCode.toUpperCase()).emit('room:starting', payload);
  }
  emitHostChanged(
    roomCode: string,
    change: {
      hostId: string;
      previousHostId: string;
      username: string | null;
      reason: HostChangeReason;
    },
  ) {
    this.server?.to(roomCode.toUpperCase()).emit('host:changed', {
      host_id: change.hostId,
      previous_host_id: change.previousHostId,
      username: change.username,
      reason: change.reason,
    });
  }
  emitMessageCreated(roomCode: string, message: RoomMessageView) {
    this.server?.to(roomCode.toUpperCase()).emit('message:created', message);
  }
  emitRoomClosed(roomCode: string) {
    const code = roomCode.toUpperCase();
    this.server?.to(code).emit('room:closed', {});
    void this.clearRoomState(code);
  }
  /** Drops cached presence, playback and control for a room code; never throws. */
  async clearRoomState(roomCode: string) {
    const code = roomCode.toUpperCase();
    const pending = this.pendingSeeks.get(code);
    if (pending) clearTimeout(pending.timer);
    this.pendingSeeks.delete(code);
    this.cancelHostTransfer(code);
    for (const [socketId, entry] of this.bufferingBySocket) {
      if (entry.roomCode !== code) continue;
      clearTimeout(entry.timer);
      this.bufferingBySocket.delete(socketId);
    }
    try {
      await this.store.clearRoom(code);
    } catch (err) {
      this.logError(`Failed to clear room state for ${code}`, err);
    }
  }
  private async leaveRoom(client: Socket, roomCode: string) {
    const data = client.data as GatewaySocketData;
    await this.stopBuffering(client.id);
    await this.store.removePresence(roomCode, client.id);
    client.to(roomCode).emit('presence:leave', {
      userId: data.presence?.userId,
      username: data.presence?.username,
    });
    await this.emitPresenceSync(roomCode);
    if (data.userId) await this.scheduleHostTransfer(roomCode, data.userId);
  }
  private async loadControl(
    roomCode: string,
    room?: WatchRoom | null,
  ): Promise<RoomControlState | null> {
    const cached = await this.store.getControl(roomCode);
    if (cached) return cached;
    const row = room ?? (await this.rooms.findByCode(roomCode));
    if (!row) return null;
    const control = toControlState(row);
    await this.store.setControl(roomCode, control);
    return control;
  }
  private async loadMedia(
    roomCode: string,
    room?: WatchRoom | null,
  ): Promise<RoomMediaState | null> {
    const cached = await this.store.getMedia(roomCode);
    if (cached) return cached;
    const row = room ?? (await this.rooms.findByCode(roomCode));
    if (!row) return null;
    const media = toMediaState(row);
    await this.store.setMedia(roomCode, media);
    return media;
  }
  /** Runs inside the room's queue so it is ordered with playback commits. */
  private async switchEpisode(
    roomCode: string,
    roomId: string,
    media: RoomMediaState,
    change: {
      item: EpisodeQueueItem;
      reason: EpisodeChangeReason;
      fromEpisode?: string;
    },
  ): Promise<boolean> {
    const { item, reason } = change;
    const queue = removeFromQueue(media.queue, item);
    const isPlaying =
      reason === 'auto_next' || (await this.currentIsPlaying(roomCode, roomId));
    // When advancing, only the first report for this episode may win.
    const updated = await this.rooms.updateMany(
      change.fromEpisode === undefined
        ? { id: roomId }
        : { id: roomId, episodeName: change.fromEpisode },
      {
        episodeName: item.episode_name,
        serverIndex: item.server_index,
        episodeQueue: queue,
        playbackTime: 0,
        isPlaying,
      },
    );
    if (!updated) return false;
    const pending = this.pendingSeeks.get(roomCode);
    if (pending) clearTimeout(pending.timer);
    this.pendingSeeks.delete(roomCode);
    await this.publishMedia(
      roomCode,
      {
        ...media,
        episodeName: item.episode_name,
        serverIndex: item.server_index,
        queue,
      },
      reason,
    );
    await this.commitPlaybackEvent(roomCode, roomId, {
      type: isPlaying ? 'PLAY' : 'PAUSE',
      time: 0,
      isPlaying,
    });
    return true;
  }
  /** Next episode on the same server, from the movie's episode list. */
  private async findNextEpisode(
    media: RoomMediaState,
  ): Promise<EpisodeQueueItem | null> {
    if (!media.episodeName) return null;
    try {
      const detail = await this.movies.getMovieDetail(media.movieSlug);
      const episodes =
        detail.data.episodes[media.serverIndex]?.server_data ?? [];
      const index = episodes.findIndex(
        (e) => e.name === media.episodeName || e.slug === media.episodeName,
      );
      if (index === -1 || index + 1 >= episodes.length) return null;
      const current = episodes[index];
      const next = episodes[index + 1];
      return {
        episode_name:
          current.name === media.episodeName ? next.name : next.slug,
        server_index: media.serverIndex,
      };
    } catch (err) {
      this.logError(`Next-episode lookup failed for ${media.movieSlug}`, err);
      return null;
    }
  }
  private flushPendingSeek(roomCode: string) {
    const pending = this.pendingSeeks.get(roomCode);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingSeeks.delete(roomCode);
    void this.enqueueCommit(roomCode, pending.roomId, {
      type: 'SEEK',
      time: pending.time,
    });
  }
  private enqueueCommit(
    roomCode: string,
    roomId: string,
    command: PlaybackCommand,
  ): Promise<boolean> {
    return this.enqueue(roomCode, async () => {
      await this.commitPlaybackEvent(roomCode, roomId, command);
      return true;
    });
  }
  // Room state changes run one at a time, in arrival order; a failure is
  // logged and resolves to false instead of rejecting.
  private enqueue(
    roomCode: string,
    task: () => Promise<boolean>,
  ): Promise<boolean> {
    const prev = this.commitQueues.get(roomCode) ?? Promise.resolve(true);
    const run = prev.then(task).then(
      (ok) => ok,
      (err: unknown) => {
        this.logError(`Room update failed for ${roomCode}`, err);
        return false;
      },
    );
    this.commitQueues.set(roomCode, run);
    void run.then(() => {
      if (this.commitQueues.get(roomCode) === run) {
        this.commitQueues.delete(roomCode);
      }
    });
    return run;
  }
  private async commitPlaybackEvent(
    roomCode: string,
    roomId: string,
    command: PlaybackCommand,
  ) {
    // A person taking control cancels any pending auto-resume.
    if (!command.auto) await this.store.takeAutoPaused(roomCode);
    const isPlaying =
      command.isPlaying ??
      (command.type === 'SEEK'
        ? await this.currentIsPlaying(roomCode, roomId)
        : command.type === 'PLAY');
    const state = await this.store.commitPlayback(roomCode, {
      type: command.type,
      time: command.time,
      isPlaying,
      updatedAt: Date.now(),
      ...(command.auto ? { auto: true } : {}),
    });
    this.server?.to(roomCode).emit('playback:event', state);
    await this.rooms.updateMany(
      { id: roomId },
      { playbackTime: command.time, isPlaying },
    );
  }
  private async currentIsPlaying(roomCode: string, roomId: string) {
    const cached = await this.store.getPlayback(roomCode);
    if (cached) return cached.isPlaying;
    const room = await this.rooms.findById(roomId);
    return room?.isPlaying ?? false;
  }
  private async startBuffering(
    client: Socket,
    roomCode: string,
    roomId: string,
  ) {
    // Only the start of a buffering spell counts; repeats are the same spell.
    if (this.bufferingBySocket.has(client.id)) return;
    const cooldown = this.bufferCooldownUntil.get(client.id);
    if (cooldown && cooldown > Date.now()) return;
    const control = await this.loadControl(roomCode);
    if (!control?.waitForBuffering) return;
    const data = client.data as GatewaySocketData;
    const timer = setTimeout(() => {
      this.bufferCooldownUntil.set(client.id, Date.now() + BUFFER_COOLDOWN_MS);
      void this.stopBuffering(client.id).catch((err) =>
        this.logError(`Buffering timeout failed for ${roomCode}`, err),
      );
    }, BUFFER_MAX_WAIT_MS);
    this.bufferingBySocket.set(client.id, { roomCode, roomId, timer });
    await this.store.addBuffering(roomCode, client.id, {
      userId: data.userId ?? '',
      username: data.presence?.username ?? '',
      since: Date.now(),
    });
    await this.emitWaiting(roomCode);
    const state = await this.store.getPlayback(roomCode);
    if (!state?.isPlaying) return;
    if (!(await this.store.markAutoPaused(roomCode))) return;
    this.flushPendingSeek(roomCode);
    await this.enqueueCommit(roomCode, roomId, {
      type: 'PAUSE',
      time: currentPlaybackTime(state),
      auto: true,
    });
  }
  private async stopBuffering(socketId: string) {
    const entry = this.bufferingBySocket.get(socketId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.bufferingBySocket.delete(socketId);
    await this.store.removeBuffering(entry.roomCode, socketId);
    const waiting = await this.emitWaiting(entry.roomCode);
    if (waiting.length) return;
    if (!(await this.store.takeAutoPaused(entry.roomCode))) return;
    const state = await this.store.getPlayback(entry.roomCode);
    if (!state || state.isPlaying) return;
    await this.enqueueCommit(entry.roomCode, entry.roomId, {
      type: 'PLAY',
      time: state.time,
      auto: true,
    });
  }
  private async listWaiting(roomCode: string): Promise<BufferingViewer[]> {
    const cutoff = Date.now() - BUFFER_STALE_MS;
    const viewers = await this.store.listBuffering(roomCode);
    return viewers.filter((v) => v.since > cutoff);
  }
  private async emitWaiting(roomCode: string) {
    const users = await this.listWaiting(roomCode);
    this.server?.to(roomCode).emit('playback:waiting', { users });
    return users;
  }
  private async scheduleHostTransfer(roomCode: string, userId: string) {
    if (this.hostTransferTimers.has(roomCode)) return;
    const control = await this.loadControl(roomCode);
    if (!control || control.hostId !== userId) return;
    const present = await this.store.listPresence(roomCode);
    // Still connected from another tab or device.
    if (present.some((p) => p.userId === userId)) return;
    const timer = setTimeout(() => {
      this.hostTransferTimers.delete(roomCode);
      void this.transferHostIfAbsent(roomCode, userId).catch((err) =>
        this.logError(`Host transfer failed for ${roomCode}`, err),
      );
    }, HOST_GRACE_MS);
    this.hostTransferTimers.set(roomCode, timer);
  }
  private cancelHostTransfer(roomCode: string) {
    const timer = this.hostTransferTimers.get(roomCode);
    if (!timer) return;
    clearTimeout(timer);
    this.hostTransferTimers.delete(roomCode);
  }
  private async transferHostIfAbsent(roomCode: string, previousHostId: string) {
    const room = await this.rooms.findByCode(roomCode);
    if (!room || room.hostId !== previousHostId) return;
    const present = await this.store.listPresence(roomCode);
    if (present.some((p) => p.userId === previousHostId)) return;
    const candidates = present.filter((p) => p.userId !== previousHostId);
    if (!candidates.length) return;
    // Co-hosts first, then whoever has been in the room longest.
    const next =
      candidates.find((p) => room.coHostIds.includes(p.userId)) ??
      candidates[0];
    const coHostIds = room.coHostIds.filter((id) => id !== next.userId);
    // Conditional on the old host so two instances can't both transfer.
    const updated = await this.rooms.updateMany(
      { id: room.id, hostId: previousHostId },
      { hostId: next.userId, coHostIds },
    );
    if (!updated) return;
    await this.publishControl(roomCode, {
      ...toControlState(room),
      hostId: next.userId,
      coHostIds,
    });
    this.emitHostChanged(roomCode, {
      hostId: next.userId,
      previousHostId,
      username: next.username,
      reason: 'host_left',
    });
  }
  private async emitPresenceSync(roomCode: string) {
    const [members, control] = await Promise.all([
      this.store.listPresence(roomCode),
      this.store.getControl(roomCode),
    ]);
    const synced = control
      ? members.map((m) => ({ ...m, isHost: m.userId === control.hostId }))
      : members;
    this.server?.to(roomCode).emit('presence:sync', synced);
  }
  private logError(message: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(`${message}: ${error.message}`, error.stack);
  }
}
