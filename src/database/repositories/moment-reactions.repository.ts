import { Injectable } from '@nestjs/common';
import { MomentReaction, Prisma } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MomentReactionsRepository extends BaseRepository<MomentReaction> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.momentReaction);
  }
  /** Adds each row's count to its bucket, creating buckets as needed. Keys must be unique. */
  async incrementMany(rows: MomentReaction[]) {
    if (!rows.length) return;
    const values = Prisma.join(
      rows.map(
        (r) =>
          Prisma.sql`(${r.movieSlug}, ${r.episodeName}, ${r.bucket}, ${r.emoji}, ${r.count})`,
      ),
    );
    await this.prisma.$executeRaw`
      INSERT INTO public.moment_reactions
        (movie_slug, episode_name, bucket, emoji, count)
      VALUES ${values}
      ON CONFLICT (movie_slug, episode_name, bucket, emoji)
      DO UPDATE SET count = moment_reactions.count + EXCLUDED.count
    `;
  }
  findByEpisode(movieSlug: string, episodeName: string) {
    return this.findMany({ where: { movieSlug, episodeName } });
  }
}
