import { Injectable } from '@nestjs/common';
import { WatchRoom } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WatchRoomsRepository extends BaseRepository<WatchRoom> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.watchRoom);
  }
  findByCode(code: string) {
    return this.findOne({ code: code.toUpperCase() });
  }
}
