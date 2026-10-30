import type { MovieListItem } from '../../shared/types/movie.types';

export interface TasteProfile {
  genres: Map<string, { name: string; weight: number }>;
  countries: Map<string, { name: string; weight: number }>;
}

export interface WeightedSeed {
  movie: Pick<MovieListItem, 'slug' | 'category' | 'country'>;
  weight: number;
}

/** Genres that say little about taste on their own. */
const WEAK_GENRES = new Set(['phim-18']);

export function buildTasteProfile(seeds: WeightedSeed[]): TasteProfile {
  const genres: TasteProfile['genres'] = new Map();
  const countries: TasteProfile['countries'] = new Map();
  for (const { movie, weight } of seeds) {
    for (const g of movie.category ?? []) {
      if (!g?.slug || WEAK_GENRES.has(g.slug)) continue;
      const cur = genres.get(g.slug) ?? { name: g.name, weight: 0 };
      cur.weight += weight;
      genres.set(g.slug, cur);
    }
    for (const c of movie.country ?? []) {
      if (!c?.slug) continue;
      const cur = countries.get(c.slug) ?? { name: c.name, weight: 0 };
      cur.weight += weight;
      countries.set(c.slug, cur);
    }
  }
  return { genres, countries };
}

export function topEntries(
  map: Map<string, { name: string; weight: number }>,
  n: number,
) {
  return [...map.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, n)
    .map(([slug, v]) => ({ slug, name: v.name, weight: v.weight }));
}

/**
 * Ranks candidates by how well their genres/country match the profile, with a
 * small bonus for recent years; drops anything already seen and duplicates.
 */
export function rankCandidates(
  candidates: MovieListItem[],
  profile: TasteProfile,
  exclude: Set<string>,
  limit: number,
  currentYear = new Date().getFullYear(),
): MovieListItem[] {
  const totalGenre =
    [...profile.genres.values()].reduce((s, g) => s + g.weight, 0) || 1;
  const totalCountry =
    [...profile.countries.values()].reduce((s, c) => s + c.weight, 0) || 1;
  const seen = new Set<string>();
  const scored: { movie: MovieListItem; score: number }[] = [];
  for (const movie of candidates) {
    if (!movie?.slug || exclude.has(movie.slug) || seen.has(movie.slug))
      continue;
    seen.add(movie.slug);
    const genreScore = (movie.category ?? []).reduce(
      (s, g) => s + (profile.genres.get(g.slug)?.weight ?? 0),
      0,
    );
    const countryScore = (movie.country ?? []).reduce(
      (s, c) => s + (profile.countries.get(c.slug)?.weight ?? 0),
      0,
    );
    const age = movie.year ? Math.max(0, currentYear - movie.year) : 5;
    const recency = Math.max(0, 1 - age / 10);
    const score =
      genreScore / totalGenre +
      0.6 * (countryScore / totalCountry) +
      0.25 * recency;
    if (score > 0) scored.push({ movie, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.movie);
}
