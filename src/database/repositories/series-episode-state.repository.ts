import { Injectable } from '@nestjs/common';
import { SeriesEpisodeState } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SeriesEpisodeStateRepository extends BaseRepository<SeriesEpisodeState> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.seriesEpisodeState);
  }
  findBySlugs(slugs: string[]) {
    return this.findMany({ where: { movieSlug: { in: slugs } } });
  }
  save(movieSlug: string, episodeCurrent: string) {
    return this.prisma.seriesEpisodeState.upsert({
      where: { movieSlug },
      create: { movieSlug, episodeCurrent },
      update: { episodeCurrent, checkedAt: new Date() },
    });
  }
}
