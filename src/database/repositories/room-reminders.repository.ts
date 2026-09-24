import { Injectable } from '@nestjs/common';
import { RoomReminder } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomRemindersRepository extends BaseRepository<RoomReminder> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.roomReminder);
  }
  subscribe(roomId: string, userId: string) {
    return this.prisma.roomReminder.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: { roomId, userId },
      update: {},
    });
  }
  unsubscribe(roomId: string, userId: string) {
    return this.deleteMany({ roomId, userId });
  }
  /** Unsent reminders for rooms starting in (from, to]. */
  findDue(from: Date, to: Date, limit: number) {
    return this.prisma.roomReminder.findMany({
      where: {
        notifiedAt: null,
        room: { scheduledAt: { gt: from, lte: to } },
      },
      include: { room: true },
      take: limit,
    });
  }
  /** Marks a reminder sent; false if another instance already did. */
  async claim(id: string, at: Date) {
    const count = await this.updateMany(
      { id, notifiedAt: null },
      { notifiedAt: at },
    );
    return count === 1;
  }
  findForUser(userId: string, since: Date) {
    return this.prisma.roomReminder.findMany({
      where: { userId, room: { scheduledAt: { gt: since } } },
      include: { room: true },
      orderBy: { room: { scheduledAt: 'asc' } },
    });
  }
  async countByRooms(roomIds: string[]) {
    if (!roomIds.length) return new Map<string, number>();
    const rows = await this.prisma.roomReminder.groupBy({
      by: ['roomId'],
      where: { roomId: { in: roomIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.roomId, r._count._all]));
  }
}
