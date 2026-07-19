import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomMembersRepository } from '../../database/repositories/room-members.repository';
import { RoomMessagesRepository } from '../../database/repositories/room-messages.repository';
import { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import { mapRoomMessage, mapWatchRoom } from '../mappers';
import type {
  AddRoomMemberInput,
  CreateRoomInput,
  InsertMessageInput,
  RoomMemberView,
  UpdatePlaybackState,
} from '../types';
import { WatchPartyGateway } from './watch-party.gateway';

@Injectable()
export class WatchPartyService {
  constructor(
    private readonly rooms: WatchRoomsRepository,
    private readonly members: RoomMembersRepository,
    private readonly messages: RoomMessagesRepository,
    private readonly gateway: WatchPartyGateway,
  ) {}

  async createRoom(input: CreateRoomInput) {
    const hours = input.expiresHours ?? 6;
    const expiresAt = new Date(Date.now() + hours * 3600_000);

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
      expiresAt,
    });

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

  async fetchMembers(roomId: string): Promise<RoomMemberView[]> {
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
    hostId: string,
    joinedMessage: string,
  ) {
    const existing = await this.isMember(roomId, userId);
    if (existing) return false;

    await this.addMember({ roomId, userId, username, avatarUrl });
    if (userId !== hostId) {
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
    const row = await this.messages.create({
      roomId: input.roomId,
      userId: input.userId,
      username: input.username,
      avatarUrl: input.type === 'message' ? (input.avatarUrl ?? null) : null,
      content: input.content,
      type: input.type ?? 'message',
    });
    const mapped = mapRoomMessage(row);
    const room = await this.rooms.findById(input.roomId);
    if (room) this.gateway.emitMessageCreated(room.code, mapped);
    return { data: mapped, error: null };
  }

  async fetchMessages(roomId: string, limit = 200) {
    const rows = await this.messages.findByRoomId(roomId, limit);
    return rows.map(mapRoomMessage);
  }

  async updatePlayback(roomId: string, hostId: string, state: UpdatePlaybackState) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    if (room.hostId !== hostId) throw new ForbiddenException('platform.onlyHostPlayback');

    await this.rooms.update(
      { id: roomId },
      {
        playbackTime: state.playbackTime,
        isPlaying: state.isPlaying,
        episodeName: state.episodeName,
        serverIndex: state.serverIndex,
      },
    );
    return { error: null };
  }

  async removeMember(roomId: string, userId: string) {
    await this.members.removeMember(roomId, userId);
    return { error: null };
  }

  async deleteRoom(roomId: string, hostId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('platform.roomNotFound');
    if (room.hostId !== hostId) throw new ForbiddenException('platform.onlyHostClose');
    const code = room.code;
    await this.rooms.delete({ id: roomId });
    this.gateway.emitRoomClosed(code);
    return { error: null };
  }
}
