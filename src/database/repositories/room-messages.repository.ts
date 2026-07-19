import { Injectable } from '@nestjs/common';
import { RoomMessage } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomMessagesRepository extends BaseRepository<RoomMessage> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.roomMessage);
  }

  findByRoomId(roomId: string, limit = 200) {
    return this.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
