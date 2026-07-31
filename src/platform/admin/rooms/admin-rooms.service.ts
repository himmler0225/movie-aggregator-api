import { Injectable } from '@nestjs/common';
import { RoomMembersRepository } from '../../../database/repositories/room-members.repository';
import { RoomMessagesRepository } from '../../../database/repositories/room-messages.repository';
import { WatchRoomsRepository } from '../../../database/repositories/watch-rooms.repository';
import { mapRoomMessage } from '../../mappers';
import { QUERY_LIMITS } from '../../../shared/constants';
import type { AdminRoomRow } from '../../types';

@Injectable()
export class AdminRoomsService {
  constructor(
    private readonly watchRooms: WatchRoomsRepository,
    private readonly roomMembers: RoomMembersRepository,
    private readonly roomMessages: RoomMessagesRepository,
  ) {}
  async roomStats() {
    const now = new Date();
    const [active, members, msgs] = await Promise.all([
      this.watchRooms.count({ expiresAt: { gt: now } }),
      this.roomMembers.count(),
      this.roomMessages.count(),
    ]);
    return { active, members, msgs };
  }
  async listRooms(showHistory: boolean): Promise<AdminRoomRow[]> {
    const where = showHistory ? undefined : { expiresAt: { gt: new Date() } };
    const rows = await this.watchRooms.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: QUERY_LIMITS.adminRoomsList,
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      host_id: r.hostId,
      movie_name: r.movieName,
      movie_slug: r.movieSlug,
      created_at: r.createdAt.toISOString(),
      expires_at: r.expiresAt.toISOString(),
    }));
  }
  async deleteRoom(roomId: string) {
    await this.watchRooms.delete({ id: roomId });
    return { ok: true };
  }
  async members(roomId: string) {
    const rows = await this.roomMembers.findByRoomId(roomId);
    return rows.map((m) => ({
      user_id: m.userId,
      username: m.username,
      avatar_url: m.avatarUrl,
      joined_at: m.joinedAt.toISOString(),
    }));
  }
  async messages(roomId: string, limit: number = QUERY_LIMITS.roomMessages) {
    const rows = await this.roomMessages.findByRoomId(roomId, limit);
    return rows.map(mapRoomMessage);
  }
}
