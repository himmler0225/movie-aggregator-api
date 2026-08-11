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
  private readonly seekTimers = new Map<string, NodeJS.Timeout>();
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
    data.isHost = !!room && room.hostId === data.userId;
    await this.setPresence(roomCode, client.id, body.presence);
    client.to(roomCode).emit('presence:join', body.presence);
    await this.emitPresenceSync(roomCode);
    const playbackState =
      (await this.getPlaybackState(roomCode)) ??
      (room
        ? {
            type: room.isPlaying ? ('PLAY' as const) : ('PAUSE' as const),
            time: room.playbackTime,
            seq: 0,
            updatedAt: Date.now(),
          }
        : null);
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
    const roomCode = body.roomCode?.toUpperCase();
    if (!roomCode || !body.type || !data.isHost) return { ok: false };
    const time = Number(body.time) || 0;
    if (body.type === 'SEEK') {
      const existing = this.seekTimers.get(roomCode);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        this.seekTimers.delete(roomCode);
        void this.commitPlaybackEvent(roomCode, 'SEEK', time);
      }, SEEK_DEBOUNCE_MS);
      this.seekTimers.set(roomCode, timer);
      return { ok: true };
    }
    const existing = this.seekTimers.get(roomCode);
    if (existing) {
      clearTimeout(existing);
      this.seekTimers.delete(roomCode);
    }
    await this.commitPlaybackEvent(roomCode, body.type, time);
    return { ok: true };
  }
  private async commitPlaybackEvent(
    roomCode: string,
    type: PlaybackStateMsg['type'],
    time: number,
  ) {
    const seq = await this.nextSeq(roomCode);
    const state: PlaybackStateMsg = { type, time, seq, updatedAt: Date.now() };
    await this.setPlaybackState(roomCode, state);
    this.server?.to(roomCode).emit('playback:event', state);
    const room = await this.rooms.findByCode(roomCode);
    if (room) {
      await this.rooms.update(
        { id: room.id },
        { playbackTime: time, isPlaying: type !== 'PAUSE' },
      );
    }
  }
  emitMessageCreated(roomCode: string, message: RoomMessageView) {
    this.server?.to(roomCode.toUpperCase()).emit('message:created', message);
  }
  emitRoomClosed(roomCode: string) {
    this.server?.to(roomCode.toUpperCase()).emit('room:closed', {});
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
    if (room?.size === 0) this.presenceByRoom.delete(roomCode);
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
      return raw ? (JSON.parse(raw) as PlaybackStateMsg) : null;
    }
    return this.playbackByRoom.get(roomCode) ?? null;
  }
  private async setPlaybackState(roomCode: string, state: PlaybackStateMsg) {
    const client = this.redis.getClient();
    if (client) {
      await client.set(playbackKey(roomCode), JSON.stringify(state));
      return;
    }
    this.playbackByRoom.set(roomCode, state);
  }
  private async nextSeq(roomCode: string): Promise<number> {
    const client = this.redis.getClient();
    if (client) {
      return client.incr(playbackSeqKey(roomCode));
    }
    const next = (this.seqByRoom.get(roomCode) ?? 0) + 1;
    this.seqByRoom.set(roomCode, next);
    return next;
  }
}
