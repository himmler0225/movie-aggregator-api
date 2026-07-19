import { Injectable } from '@nestjs/common';
import { RoomMember } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomMembersRepository extends BaseRepository<RoomMember> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.roomMember);
  }

  findByRoomId(roomId: string) {
    return this.findMany({ where: { roomId }, orderBy: { joinedAt: 'asc' } });
  }

  isMember(roomId: string, userId: string) {
    return this.findOne({ roomId, userId });
  }

  removeMember(roomId: string, userId: string) {
    return this.deleteMany({ roomId, userId });
  }
}
