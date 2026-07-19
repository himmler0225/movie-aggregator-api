import '../../load-env';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import {
  AppConfigService,
  loadAppConfig,
  resolveCorsOriginOption,
} from '../../config';import type {
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

@WebSocketGateway({
  namespace: '/watch-party',
  cors: gatewayCors,
})
export class WatchPartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** roomCode → socketId → presence */
  private readonly presenceByRoom = new Map<string, Map<string, PresencePayload>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

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

  handleDisconnect(client: Socket) {
    const data = client.data as GatewaySocketData;
    if (!data.roomCode) return;

    const room = this.presenceByRoom.get(data.roomCode);
    room?.delete(client.id);
    if (room?.size === 0) this.presenceByRoom.delete(data.roomCode);

    client.to(data.roomCode).emit('presence:leave', {
      userId: data.presence?.userId,
      username: data.presence?.username,
    });
    this.emitPresenceSync(data.roomCode);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: JoinWsPayload) {
    const data = client.data as GatewaySocketData;
    const roomCode = body.roomCode?.toUpperCase();
    if (!roomCode || !body.presence) return { ok: false };

    if (data.roomCode && data.roomCode !== roomCode) {
      void client.leave(data.roomCode);
      const prev = this.presenceByRoom.get(data.roomCode);
      prev?.delete(client.id);
    }

    void client.join(roomCode);
    data.roomCode = roomCode;
    data.presence = body.presence;

    let room = this.presenceByRoom.get(roomCode);
    if (!room) {
      room = new Map();
      this.presenceByRoom.set(roomCode, room);
    }
    room.set(client.id, body.presence);

    client.to(roomCode).emit('presence:join', body.presence);
    this.emitPresenceSync(roomCode);
    return { ok: true };
  }

  @SubscribeMessage('broadcast')
  handleBroadcast(@ConnectedSocket() client: Socket, @MessageBody() body: BroadcastWsPayload) {
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

  private emitPresenceSync(roomCode: string) {
    const room = this.presenceByRoom.get(roomCode);
    const members = room ? [...room.values()].sort((a, b) => a.joinedAt - b.joinedAt) : [];
    this.server?.to(roomCode).emit('presence:sync', members);
  }
}
