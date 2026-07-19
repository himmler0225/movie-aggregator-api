import { Injectable } from '@nestjs/common';
import { WatchEvent } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WatchEventsRepository extends BaseRepository<WatchEvent> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.watchEvent);
  }

  findByMovieSlug(movieSlug: string, from: Date, limit = 5000) {
    return this.findMany({
      where: { movieSlug, startedAt: { gte: from } },
      take: limit,
    });
  }
}
