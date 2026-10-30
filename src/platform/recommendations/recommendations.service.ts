import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoviesService } from '../../movies/movies.service';
import type { MovieListItem } from '../../shared/types/movie.types';
import { TtlCache } from '../../shared/utils';
import {
  buildTasteProfile,
  rankCandidates,
  topEntries,
  type WeightedSeed,
} from './recommend.util';

export interface Recommendations {
  items: MovieListItem[];
  /** Why: the genres / countries the picks are based on (display names). */
  genres: string[];
  countries: string[];
}

const EMPTY: Recommendations = { items: [], genres: [], countries: [] };
const CACHE_TTL_MS = 30 * 60_000;
const MAX_SEEDS = 20;
const MIN_SEEDS = 2;
const RESULT_SIZE = 20;
const CANDIDATES_PER_LIST = 30;
const FETCH_CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

/**
 * "For you": builds a genre/country taste profile from what the user watched,
 * favourited and rated highly, then ranks upstream lists against it.
 */
@Injectable()
export class RecommendationsService {
  private readonly cache = new TtlCache<Recommendations>(500);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movies: MoviesService,
  ) {}

  async forUser(userId: string): Promise<Recommendations> {
    const result = await this.cache.getOrLoad(userId, CACHE_TTL_MS, () =>
      this.compute(userId),
    );
    // Not enough history yet: recompute next time instead of hiding the row for 30 min.
    if (result.items.length === 0) this.cache.delete(userId);
    return result;
  }

  private async compute(userId: string): Promise<Recommendations> {
    const [history, favorites, ratings] = await Promise.all([
      this.prisma.watchHistory.findMany({
        where: { userId },
        orderBy: { watchedAt: 'desc' },
        take: 80,
        select: {
          movieSlug: true,
          completed: true,
          progressSec: true,
          durationSec: true,
        },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { movieSlug: true },
      }),
      this.prisma.movieRating.findMany({
        where: { userId },
        select: { movieSlug: true, score: true },
      }),
    ]);

    const weights = new Map<string, number>();
    const bump = (slug: string, by: number) =>
      weights.set(slug, (weights.get(slug) ?? 0) + by);
    for (const h of history) {
      const engaged =
        h.completed ||
        (h.durationSec > 0 && h.progressSec / h.durationSec > 0.5);
      // One row per episode: cap a series' history weight so a long show doesn't dominate.
      if ((weights.get(h.movieSlug) ?? 0) < 3)
        bump(h.movieSlug, engaged ? 1 : 0.5);
    }
    favorites.forEach((f) => bump(f.movieSlug, 2));
    const disliked = new Set<string>();
    for (const r of ratings) {
      if (r.score >= 4) bump(r.movieSlug, 2);
      if (r.score <= 2) disliked.add(r.movieSlug);
    }
    disliked.forEach((slug) => weights.delete(slug));

    const exclude = new Set([
      ...history.map((h) => h.movieSlug),
      ...favorites.map((f) => f.movieSlug),
      ...ratings.map((r) => r.movieSlug),
    ]);
    const seedSlugs = [...weights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SEEDS);
    if (seedSlugs.length < MIN_SEEDS) return EMPTY;

    const seeds = (
      await mapLimit(seedSlugs, FETCH_CONCURRENCY, async ([slug, weight]) => {
        try {
          const { movie } = (await this.movies.getMovieDetail(slug)).data;
          return { movie, weight } satisfies WeightedSeed;
        } catch {
          return null;
        }
      })
    ).filter((s): s is NonNullable<typeof s> => s !== null);
    if (seeds.length < MIN_SEEDS) return EMPTY;

    const profile = buildTasteProfile(seeds);
    const genres = topEntries(profile.genres, 2);
    const [country] = topEntries(profile.countries, 1);
    if (genres.length === 0) return EMPTY;

    const page = { page: 1, limit: CANDIDATES_PER_LIST };
    const requests: (() => Promise<{ data: MovieListItem[] }>)[] =
      genres.flatMap((g) => [
        () => this.movies.getByGenre(g.slug, page),
        ...(country
          ? [
              () =>
                this.movies.getByGenre(g.slug, {
                  ...page,
                  country: country.slug,
                }),
            ]
          : []),
      ]);
    if (country)
      requests.push(() => this.movies.getByCountry(country.slug, page));

    const lists = await mapLimit(requests, FETCH_CONCURRENCY, (load) =>
      load().then(
        (r) => r.data ?? [],
        () => [] as MovieListItem[],
      ),
    );

    return {
      items: rankCandidates(lists.flat(), profile, exclude, RESULT_SIZE),
      genres: genres.map((g) => g.name),
      countries: country ? [country.name] : [],
    };
  }
}
