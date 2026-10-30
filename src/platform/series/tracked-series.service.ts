import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Unfinished episodes watched within this window count as "following". */
const HISTORY_WINDOW_MS = 30 * 24 * 3600_000;

/** Series people follow: favourites, watchlists and shows they're part-way through. */
@Injectable()
export class TrackedSeriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** slug -> follower user ids; all users when `userIds` is omitted. */
  async followersBySlug(userIds?: string[]): Promise<Map<string, Set<string>>> {
    const who = userIds ? { userId: { in: userIds } } : {};
    const map = new Map<string, Set<string>>();
    const add = (slug: string, userId: string) => {
      const set = map.get(slug) ?? new Set<string>();
      set.add(userId);
      map.set(slug, set);
    };
    const [favorites, lists, history] = await Promise.all([
      this.prisma.favorite.findMany({
        where: who,
        select: { userId: true, movieSlug: true },
      }),
      this.prisma.userWatchlist.findMany({
        where: who,
        select: { userId: true, slugs: true },
      }),
      this.prisma.watchHistory.findMany({
        where: {
          ...who,
          completed: false,
          watchedAt: { gte: new Date(Date.now() - HISTORY_WINDOW_MS) },
        },
        select: { userId: true, movieSlug: true },
      }),
    ]);
    favorites.forEach((f) => add(f.movieSlug, f.userId));
    lists.forEach((l) => l.slugs.forEach((slug) => add(slug, l.userId)));
    history.forEach((h) => add(h.movieSlug, h.userId));
    return map;
  }
}
