import { Injectable } from '@nestjs/common';
import { UserWatchlist } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserWatchlistsRepository extends BaseRepository<UserWatchlist> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.userWatchlist);
  }

  findByUserId(userId: string) {
    return this.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }
}
