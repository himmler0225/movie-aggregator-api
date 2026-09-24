import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomMembersRepository } from '../../database/repositories/room-members.repository';
import { RoomMessagesRepository } from '../../database/repositories/room-messages.repository';
import { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import { PermissionsService } from '../auth/permissions.service';
import { QUERY_LIMITS } from '../../shared/constants';
import { mapRoomMessage, mapWatchRoom } from '../mappers';
import { DanmakuService } from '../danmaku/danmaku.service';
import { DANMAKU_MAX_LENGTH } from '../danmaku/dto/danmaku.dto';
import type {
  AddRoomMemberInput,
  CreateRoomInput,
  InsertMessageInput,
  RoomControlState,
  RoomMemberView,
  UpdatePlaybackState,
  UpdateRoomSettingsInput,
} from '../types';
import {
  canControlPlayback,
  MAX_CO_HOSTS,
  toControlMsg,
  toControlState,
} from './room-control';
import { WatchPartyGateway } from './watch-party.gateway';

@Injectable()
export class WatchPartyService {
  constructor(
    private readonly rooms: WatchRoomsRepository,
    private readonly members: RoomMembersRepository,
    private readonly messages: RoomMessagesRepository,
    private readonly gateway: WatchPartyGateway,
    private readonly permissions: PermissionsService,
    private readonly danmaku: DanmakuService,
  ) {}
  async createRoom(input: CreateRoomInput) {
    if (
      input.isPrivate &&
      !this.permissions.has(input.hostRole, 'watch-party:create-private')
    ) {
      throw new ForbiddenException('platform.privateRoomRequiresPremium');
    }
    const hours = input.expiresHours ?? 6;
    const expiresAt = new Date(Date.now() + hours * 3600000);
    const row = await this.rooms.create({
      code: input.code.toUpperCase(),
      hostId: input.hostId,
      movieSlug: input.movieSlug,
      movieName: input.movieName,
      thumbUrl: input.thumbUrl ?? null,
      episodeName: input.episodeName,
      serverIndex: input.serverIndex,
      playbackTime: 0,
      isPlaying: false,
      isPrivate: input.isPrivate ?? false,
      pin: input.pin ?? null,
      controlMode: input.controlMode ?? 'host',
      waitForBuffering: input.waitForBuffering ?? true,
      expiresAt,
    });
    // A reused code must not inherit the previous room's cached state.
    await this.gateway.clearRoomState(row.code);
    return { data: { id: row.id }, error: null };
  }
  async fetchRoomByCode(code: string) {
    const row = await this.rooms.findByCode(code);
    if (!row) return { data: null, error: null };
    return {
      data: { code: row.code, expires_at: row.expiresAt.toISOString() },
      error: null,
    };
  }
  async fetchRoomFull(code: string) {
    const row = await this.rooms.findByCode(code);
    return row ? mapWatchRoom(row) : null;
  }
  async assertCanRead(roomId: string, userId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    if (!room.isPrivate || room.hostId === userId) return room;
    if (await this.isMember(roomId, userId)) return room;
    throw new ForbiddenException('platform.notRoomMember');
  }
  async fetchMembers(
    roomId: string,
    requesterId: string,
  ): Promise<RoomMemberView[]> {
    await this.assertCanRead(roomId, requesterId);
    const rows = await this.members.findByRoomId(roomId);
    return rows.map((m) => ({
      user_id: m.userId,
      username: m.username,
      avatar_url: m.avatarUrl,
      joined_at: m.joinedAt.toISOString(),
    }));
  }
  async isMember(roomId: string, userId: string) {
    const row = await this.members.isMember(roomId, userId);
    return !!row;
  }
  async addMember(input: AddRoomMemberInput) {
    await this.members.create({
      roomId: input.roomId,
      userId: input.userId,
      username: input.username,
      avatarUrl: input.avatarUrl,
    });
    return { error: null };
  }
  async joinAsGuest(
    roomId: string,
    userId: string,
    username: string,
    avatarUrl: string | null,
    pin: string | null | undefined,
    joinedMessage: string,
  ) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    const existing = await this.isMember(roomId, userId);
    const isHost = userId === room.hostId;
    if (
      room.isPrivate &&
      !isHost &&
      !existing &&
      room.pin &&
      room.pin !== (pin ?? '').trim()
    ) {
      throw new ForbiddenException('platform.invalidPin');
    }
    if (existing) return false;
    await this.addMember({ roomId, userId, username, avatarUrl });
    if (userId !== room.hostId) {
      await this.insertMessage({
        roomId,
        userId,
        username,
        content: joinedMessage,
        type: 'system',
      });
    }
    return true;
  }
  async insertMessage(input: InsertMessageInput) {
    const room = await this.assertCanRead(input.roomId, input.userId);
    const type = input.type ?? 'message';
    const playbackTime =
      type === 'message' ? (input.playbackTime ?? null) : null;
    const asDanmaku =
      !!input.asDanmaku && playbackTime !== null && !!room.episodeName;
    if (asDanmaku && input.content.trim().length > DANMAKU_MAX_LENGTH) {
      throw new BadRequestException('platform.danmakuTooLong');
    }
    const row = await this.messages.create({
      roomId: input.roomId,
      userId: input.userId,
      username: input.username,
      avatarUrl: type === 'message' ? (input.avatarUrl ?? null) : null,
      content: input.content,
      type,
      playbackTime,
    });
    const mapped = mapRoomMessage(row);
    this.gateway.emitMessageCreated(room.code, mapped);
    if (asDanmaku && playbackTime !== null && room.episodeName) {
      await this.danmaku.create({
        userId: input.userId,
        movieSlug: room.movieSlug,
        episodeName: room.episodeName,
        playbackTime,
        content: input.content,
        username: input.username,
        avatarUrl: input.avatarUrl ?? null,
        roomId: room.id,
      });
    }
    return { data: mapped, error: null };
  }
  async fetchMessages(
    roomId: string,
    requesterId: string,
    limit: number = QUERY_LIMITS.roomMessages,
  ) {
    await this.assertCanRead(roomId, requesterId);
    const rows = await this.messages.findByRoomId(roomId, limit);
    return rows.map(mapRoomMessage);
  }
  async updatePlayback(
    roomId: string,
    userId: string,
    state: UpdatePlaybackState,
  ) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    if (!canControlPlayback(toControlState(room), userId))
      throw new ForbiddenException('platform.onlyHostPlayback');
    await this.rooms.update(
      { id: roomId },
      {
        playbackTime: state.playbackTime,
        isPlaying: state.isPlaying,
        episodeName: state.episodeName,
        serverIndex: state.serverIndex,
      },
    );
    await this.gateway.applyPlaybackUpdate(
      room.code,
      roomId,
      state.playbackTime,
      state.isPlaying,
    );
    return { error: null };
  }
  async updateSettings(
    roomId: string,
    userId: string,
    input: UpdateRoomSettingsInput,
  ) {
    await this.requireHostRoom(roomId, userId);
    const data: Record<string, unknown> = {};
    if (input.controlMode) data.controlMode = input.controlMode;
    if (input.waitForBuffering !== undefined) {
      data.waitForBuffering = input.waitForBuffering;
    }
    const updated = await this.rooms.update({ id: roomId }, data);
    return this.publishControl(updated.code, toControlState(updated));
  }
  async addCoHost(roomId: string, userId: string, targetId: string) {
    const room = await this.requireHostRoom(roomId, userId);
    if (targetId === room.hostId) {
      throw new BadRequestException('platform.cannotTargetSelf');
    }
    await this.requireMember(roomId, targetId);
    if (room.coHostIds.includes(targetId)) {
      return { data: toControlMsg(toControlState(room)), error: null };
    }
    if (room.coHostIds.length >= MAX_CO_HOSTS) {
      throw new BadRequestException('platform.tooManyCoHosts');
    }
    const updated = await this.rooms.update(
      { id: roomId },
      { coHostIds: [...room.coHostIds, targetId] },
    );
    return this.publishControl(updated.code, toControlState(updated));
  }
  async removeCoHost(roomId: string, userId: string, targetId: string) {
    const room = await this.requireHostRoom(roomId, userId);
    if (!room.coHostIds.includes(targetId)) {
      return { data: toControlMsg(toControlState(room)), error: null };
    }
    const updated = await this.rooms.update(
      { id: roomId },
      { coHostIds: room.coHostIds.filter((id) => id !== targetId) },
    );
    return this.publishControl(updated.code, toControlState(updated));
  }
  async transferHost(roomId: string, userId: string, targetId: string) {
    const room = await this.requireHostRoom(roomId, userId);
    if (targetId === userId) {
      throw new BadRequestException('platform.cannotTargetSelf');
    }
    const member = await this.requireMember(roomId, targetId);
    const coHostIds = room.coHostIds.filter((id) => id !== targetId);
    // Conditional on the current host so a concurrent auto-transfer wins cleanly.
    const updated = await this.rooms.updateMany(
      { id: roomId, hostId: userId },
      { hostId: targetId, coHostIds },
    );
    if (!updated) throw new ForbiddenException('platform.onlyHostSettings');
    const result = await this.publishControl(room.code, {
      ...toControlState(room),
      hostId: targetId,
      coHostIds,
    });
    this.gateway.emitHostChanged(room.code, {
      hostId: targetId,
      previousHostId: userId,
      username: member.username,
      reason: 'transferred',
    });
    return result;
  }
  private async requireHostRoom(roomId: string, userId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    if (room.hostId !== userId) {
      throw new ForbiddenException('platform.onlyHostSettings');
    }
    return room;
  }
  private async requireMember(roomId: string, userId: string) {
    const member = await this.members.isMember(roomId, userId);
    if (!member) throw new BadRequestException('platform.targetNotMember');
    return member;
  }
  private async publishControl(roomCode: string, control: RoomControlState) {
    await this.gateway.publishControl(roomCode, control);
    return { data: toControlMsg(control), error: null };
  }
  async removeMember(roomId: string, userId: string) {
    await this.members.removeMember(roomId, userId);
    return { error: null };
  }
  async deleteRoom(roomId: string, hostId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    if (room.hostId !== hostId)
      throw new ForbiddenException('platform.onlyHostClose');
    const code = room.code;
    await this.rooms.delete({ id: roomId });
    this.gateway.emitRoomClosed(code);
    return { error: null };
  }
}
