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
import { createAdapter } from '@socket.io/redis-adapter';
import { Namespace, Server, Socket } from 'socket.io';
import {
  AppConfigService,
  loadAppConfig,
  resolveCorsOriginOption,
} from '../../config';
import { RedisService } from '../../infra/redis';
import { AppLogger } from '../../shared/logger';
import { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import type {
  BroadcastWsPayload,
  GatewaySocketData,
  JoinWsPayload,
  JwtPayload,
  PlaybackEventType,
  PlaybackEventWsPayload,
  PlaybackStateMsg,
  PresencePayload,
  RoomMessageView,
} from '../types';

const gatewayCors = (() => {
  const { corsOrigins } = loadAppConfig();
  return {
    origin: resolveCorsOriginOption(corsOrigins),
    credentials: true,
  } as const;
})();

const presenceKey = (roomCode: string) => `watchparty:presence:${roomCode}`;
const playbackKey = (roomCode: string) => `watchparty:playback:${roomCode}`;
const playbackSeqKey = (roomCode: string) =>
  `watchparty:playback:seq:${roomCode}`;
const SEEK_DEBOUNCE_MS = 80;
const PLAYBACK_TTL_SECONDS = 24 * 3600;
const PLAYBACK_EVENT_TYPES: ReadonlySet<PlaybackEventType> = new Set([
  'PLAY',
  'PAUSE',
  'SEEK',
]);
// Assigns the seq and stores the state in one atomic step, so the stored
// state always carries the highest seq even when commits race across
// instances.
const COMMIT_PLAYBACK_SCRIPT = `
local seq = redis.call('INCR', KEYS[2])
local state = cjson.decode(ARGV[1])
state['seq'] = seq
redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return seq
`;

interface PendingSeek {
  timer: NodeJS.Timeout;
  roomId: string;
  time: number;
}

interface PlaybackCommand {
  type: PlaybackEventType;
  time: number;
  isPlaying?: boolean;
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
  private readonly presenceByRoom = new Map<
    string,
    Map<string, PresencePayload>
  >();
  private readonly playbackByRoom = new Map<string, PlaybackStateMsg>();
  private readonly seqByRoom = new Map<string, number>();
  private readonly pendingSeeks = new Map<string, PendingSeek>();
  private readonly commitQueues = new Map<string, Promise<boolean>>();
  constructor(
    private readonly jwt: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    private readonly rooms: WatchRoomsRepository,
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
    } catch {
      client.disconnect(true);
    }
  }
  async handleDisconnect(client: Socket) {
    const data = client.data as GatewaySocketData;
    if (!data.roomCode) return;
    await this.removePresence(data.roomCode, client.id);
    client.to(data.roomCode).emit('presence:leave', {
      userId: data.presence?.userId,
      username: data.presence?.username,
    });
    await this.emitPresenceSync(data.roomCode);
  }
  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: JoinWsPayload,
  ) {
    const data = client.data as GatewaySocketData;
    const roomCode = body.roomCode?.toUpperCase();
    if (!roomCode || !body.presence) return { ok: false };
    if (data.roomCode && data.roomCode !== roomCode) {
      void client.leave(data.roomCode);
      await this.removePresence(data.roomCode, client.id);
    }
    void client.join(roomCode);
    data.roomCode = roomCode;
    data.presence = body.presence;
    const room = await this.rooms.findByCode(roomCode);
    data.roomId = room?.id;
    data.isHost = !!room && room.hostId === data.userId;
    await this.setPresence(roomCode, client.id, body.presence);
    client.to(roomCode).emit('presence:join', body.presence);
    await this.emitPresenceSync(roomCode);
    const cached = await this.getPlaybackState(roomCode);
    const playbackState: PlaybackStateMsg | null = cached
      ? { ...cached, type: cached.isPlaying ? 'PLAY' : 'PAUSE' }
      : room
        ? {
            type: room.isPlaying ? 'PLAY' : 'PAUSE',
            time: room.playbackTime,
            isPlaying: room.isPlaying,
            seq: 0,
            updatedAt: Date.now(),
          }
        : null;
    if (playbackState) client.emit('playback:sync', playbackState);
    return { ok: true };
  }
  @SubscribeMessage('broadcast')
  handleBroadcast(
    @ConnectedSocket()
    client: Socket,
    @MessageBody()
    body: BroadcastWsPayload,
  ) {
    const roomCode = body.roomCode?.toUpperCase();
    if (!roomCode || !body.event) return { ok: false };
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
    if (!data.isHost || !data.roomId) return { ok: false };
    const type = body.type;
    const time = Number(body.time);
    if (!PLAYBACK_EVENT_TYPES.has(type)) return { ok: false };
    if (!Number.isFinite(time) || time < 0) return { ok: false };
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
  // Commits for a room run one at a time, in arrival order.
  private enqueueCommit(
    roomCode: string,
    roomId: string,
    command: PlaybackCommand,
  ): Promise<boolean> {
    const prev = this.commitQueues.get(roomCode) ?? Promise.resolve(true);
    const run = prev
      .then(() => this.commitPlaybackEvent(roomCode, roomId, command))
      .then(
        () => true,
        (err: Error) => {
          this.logger.error(
            `Playback commit failed for ${roomCode}: ${err.message}`,
            err.stack,
          );
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
    const isPlaying =
      command.isPlaying ??
      (command.type === 'SEEK'
        ? await this.currentIsPlaying(roomCode, roomId)
        : command.type === 'PLAY');
    const state = await this.storePlaybackState(roomCode, {
      type: command.type,
      time: command.time,
      isPlaying,
      updatedAt: Date.now(),
    });
    this.server?.to(roomCode).emit('playback:event', state);
    await this.rooms.updateMany(
      { id: roomId },
      { playbackTime: command.time, isPlaying },
    );
  }
  private async currentIsPlaying(roomCode: string, roomId: string) {
    const cached = await this.getPlaybackState(roomCode);
    if (cached) return cached.isPlaying;
    const room = await this.rooms.findById(roomId);
    return room?.isPlaying ?? false;
  }
  emitMessageCreated(roomCode: string, message: RoomMessageView) {
    this.server?.to(roomCode.toUpperCase()).emit('message:created', message);
  }
  emitRoomClosed(roomCode: string) {
    const code = roomCode.toUpperCase();
    this.server?.to(code).emit('room:closed', {});
    void this.clearRoomState(code);
  }
  /** Drops cached presence and playback for a room code; never throws. */
  async clearRoomState(roomCode: string) {
    const code = roomCode.toUpperCase();
    const pending = this.pendingSeeks.get(code);
    if (pending) clearTimeout(pending.timer);
    this.pendingSeeks.delete(code);
    this.playbackByRoom.delete(code);
    this.seqByRoom.delete(code);
    this.presenceByRoom.delete(code);
    const client = this.redis.getClient();
    if (!client) return;
    try {
      await client.del(
        playbackKey(code),
        playbackSeqKey(code),
        presenceKey(code),
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to clear room state for ${code}: ${error.message}`,
        error.stack,
      );
    }
  }
  private async setPresence(
    roomCode: string,
    socketId: string,
    presence: PresencePayload,
  ) {
    const client = this.redis.getClient();
    if (client) {
      await client.hset(
        presenceKey(roomCode),
        socketId,
        JSON.stringify(presence),
      );
      return;
    }
    let room = this.presenceByRoom.get(roomCode);
    if (!room) {
      room = new Map();
      this.presenceByRoom.set(roomCode, room);
    }
    room.set(socketId, presence);
  }
  private async removePresence(roomCode: string, socketId: string) {
    const client = this.redis.getClient();
    if (client) {
      await client.hdel(presenceKey(roomCode), socketId);
      return;
    }
    const room = this.presenceByRoom.get(roomCode);
    room?.delete(socketId);
    if (room?.size === 0) {
      // Last viewer left: the DB row already holds the latest playback.
      this.presenceByRoom.delete(roomCode);
      this.playbackByRoom.delete(roomCode);
      this.seqByRoom.delete(roomCode);
    }
  }
  private async listPresence(roomCode: string): Promise<PresencePayload[]> {
    const client = this.redis.getClient();
    if (client) {
      const entries = await client.hgetall(presenceKey(roomCode));
      return Object.values(entries)
        .map((raw) => JSON.parse(raw) as PresencePayload)
        .sort((a, b) => a.joinedAt - b.joinedAt);
    }
    const room = this.presenceByRoom.get(roomCode);
    return room
      ? [...room.values()].sort((a, b) => a.joinedAt - b.joinedAt)
      : [];
  }
  private async emitPresenceSync(roomCode: string) {
    const members = await this.listPresence(roomCode);
    this.server?.to(roomCode).emit('presence:sync', members);
  }
  private async getPlaybackState(
    roomCode: string,
  ): Promise<PlaybackStateMsg | null> {
    const client = this.redis.getClient();
    if (client) {
      const raw = await client.get(playbackKey(roomCode));
      if (!raw) return null;
      const state = JSON.parse(raw) as Partial<PlaybackStateMsg>;
      // States written before isPlaying existed can't be trusted; use the DB.
      return typeof state.isPlaying === 'boolean'
        ? (state as PlaybackStateMsg)
        : null;
    }
    return this.playbackByRoom.get(roomCode) ?? null;
  }
  private async storePlaybackState(
    roomCode: string,
    state: Omit<PlaybackStateMsg, 'seq'>,
  ): Promise<PlaybackStateMsg> {
    const client = this.redis.getClient();
    if (client) {
      const seq = (await client.eval(
        COMMIT_PLAYBACK_SCRIPT,
        2,
        playbackKey(roomCode),
        playbackSeqKey(roomCode),
        JSON.stringify(state),
        PLAYBACK_TTL_SECONDS,
      )) as number;
      return { ...state, seq };
    }
    const seq = (this.seqByRoom.get(roomCode) ?? 0) + 1;
    this.seqByRoom.set(roomCode, seq);
    const stored = { ...state, seq };
    this.playbackByRoom.set(roomCode, stored);
    return stored;
  }
}
