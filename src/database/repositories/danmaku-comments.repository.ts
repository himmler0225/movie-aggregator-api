import { Injectable } from '@nestjs/common';
import { DanmakuComment } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DanmakuCommentsRepository extends BaseRepository<DanmakuComment> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.danmakuComment);
  }
  findByEpisode(
    movieSlug: string,
    episodeName: string,
    range: { from?: number; to?: number },
    limit: number,
  ) {
    return this.findMany({
      where: {
        movieSlug,
        episodeName,
        playbackTime: { gte: range.from, lt: range.to },
      },
      orderBy: { playbackTime: 'asc' },
      take: limit,
    });
  }
  countByBucket(movieSlug: string, episodeName: string, bucketSeconds: number) {
    return this.prisma.$queryRaw<Array<{ bucket: number; count: number }>>`
      SELECT floor(playback_time / ${bucketSeconds})::int AS bucket,
             COUNT(*)::int AS count
      FROM public.danmaku_comments
      WHERE movie_slug = ${movieSlug} AND episode_name = ${episodeName}
      GROUP BY 1
    `;
  }
}
