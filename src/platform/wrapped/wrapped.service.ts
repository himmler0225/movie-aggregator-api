import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoviesService } from '../../movies/movies.service';
import { TtlCache } from '../../shared/utils';
import {
  buildTasteProfile,
  topEntries,
} from '../recommendations/recommend.util';
import { computeWrapped, type WrappedStats } from './wrapped.util';

const VN_OFFSET_MS = 7 * 3600_000;

export interface Wrapped extends WrappedStats {
  year: number;
  top_genres: string[];
  top_countries: string[];
  comments: number;
  danmaku: number;
  ratings: number;
  favorites_added: number;
}

@Injectable()
export class WrappedService {
  private readonly cache = new TtlCache<Wrapped>(500);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movies: MoviesService,
  ) {}

  forUser(userId: string, year: number) {
    return this.cache.getOrLoad(`${userId}:${year}`, 60 * 60_000, () =>
      this.compute(userId, year),
    );
  }

  private async compute(userId: string, year: number): Promise<Wrapped> {
    const from = new Date(Date.UTC(year, 0, 1) - VN_OFFSET_MS);
    const to = new Date(Date.UTC(year + 1, 0, 1) - VN_OFFSET_MS);
    const inYear = { gte: from, lt: to };
    const [rows, comments, danmaku, ratings, favorites] = await Promise.all([
      this.prisma.watchHistory.findMany({
        where: { userId, watchedAt: inYear },
        select: {
          movieSlug: true,
          movieName: true,
          thumbUrl: true,
          progressSec: true,
          durationSec: true,
          watchedAt: true,
        },
      }),
      this.prisma.comment.count({ where: { userId, createdAt: inYear } }),
      this.prisma.danmakuComment.count({
        where: { userId, createdAt: inYear },
      }),
      this.prisma.movieRating.count({ where: { userId, createdAt: inYear } }),
      this.prisma.favorite.count({ where: { userId, createdAt: inYear } }),
    ]);
    const stats = computeWrapped(rows);

    // Genres/countries of the most-watched titles, weighted by time spent.
    const weighted = [...new Map(rows.map((r) => [r.movieSlug, 0])).keys()]
      .map((slug) => ({
        slug,
        seconds: rows
          .filter((r) => r.movieSlug === slug)
          .reduce(
            (s, r) =>
              s + Math.min(r.progressSec, r.durationSec || r.progressSec),
            0,
          ),
      }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 15);
    const seeds = (
      await Promise.all(
        weighted.map(({ slug, seconds }) =>
          this.movies.getMovieDetail(slug).then(
            (r) => ({ movie: r.data.movie, weight: seconds }),
            () => null,
          ),
        ),
      )
    ).filter((s): s is NonNullable<typeof s> => s !== null);
    const profile = buildTasteProfile(seeds);

    return {
      year,
      ...stats,
      top_genres: topEntries(profile.genres, 3).map((g) => g.name),
      top_countries: topEntries(profile.countries, 2).map((c) => c.name),
      comments,
      danmaku,
      ratings,
      favorites_added: favorites,
    };
  }
}
