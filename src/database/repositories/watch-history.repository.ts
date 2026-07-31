import { Injectable } from '@nestjs/common';
import { WatchHistory } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';
import { QUERY_LIMITS } from '../../shared/constants';

@Injectable()
export class WatchHistoryRepository extends BaseRepository<WatchHistory> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.watchHistory);
  }
  findByUserId(
    userId: string,
    limit: number = QUERY_LIMITS.watchHistoryPerUser,
  ) {
    return this.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: limit,
    });
  }
  deleteItem(userId: string, movieSlug: string, episodeName: string) {
    return this.deleteMany({ userId, movieSlug, episodeName });
  }
  clearByUserId(userId: string) {
    return this.deleteMany({ userId });
  }
}
