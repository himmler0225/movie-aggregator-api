import { Injectable } from '@nestjs/common';
import { SkipMark } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SkipMarksRepository extends BaseRepository<SkipMark> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.skipMark);
  }
  findByEpisode(movieSlug: string, episodeName: string) {
    return this.findMany({
      where: { movieSlug, episodeName },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
  }
  upsertMine(
    userId: string,
    key: { movieSlug: string; episodeName: string; kind: string },
    range: { startSec: number; endSec: number },
  ) {
    return this.prisma.skipMark.upsert({
      where: { userId_movieSlug_episodeName_kind: { userId, ...key } },
      create: { userId, ...key, ...range },
      update: range,
    });
  }
}
