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
  /**
   * Stores the latest upstream episode; when it differs from the stored one,
   * also logs a release event (the first sighting is not an event).
   */
  async observe(movieSlug: string, episodeCurrent: string) {
    const prev = await this.prisma.seriesEpisodeState.findUnique({
      where: { movieSlug },
    });
    if (!prev) {
      return this.prisma.seriesEpisodeState.create({
        data: { movieSlug, episodeCurrent },
      });
    }
    if (prev.episodeCurrent !== episodeCurrent) {
      await this.prisma.seriesEpisodeEvent.create({
        data: { movieSlug, episode: episodeCurrent },
      });
    }
    return this.prisma.seriesEpisodeState.update({
      where: { movieSlug },
      data: { episodeCurrent, checkedAt: new Date() },
    });
  }
  markNotified(movieSlug: string, episode: string) {
    return this.prisma.seriesEpisodeState.update({
      where: { movieSlug },
      data: { notifiedEpisode: episode },
    });
  }
  eventsFor(slugs: string[], since: Date) {
    return this.prisma.seriesEpisodeEvent.findMany({
      where: { movieSlug: { in: slugs }, seenAt: { gte: since } },
      orderBy: { seenAt: 'asc' },
    });
  }
}
