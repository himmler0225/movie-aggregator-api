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
import type {
  BroadcastWsPayload,
  GatewaySocketData,
  JoinWsPayload,
  JwtPayload,
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
  constructor(
    private readonly jwt: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
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
    await this.setPresence(roomCode, client.id, body.presence);
    client.to(roomCode).emit('presence:join', body.presence);
    await this.emitPresenceSync(roomCode);
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
}
