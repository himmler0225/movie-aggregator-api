import { kkphimSource } from './kkphim.source';
import { ophimSource } from './ophim.source';
import type { MovieSourceConfig } from './source.types';
import { vsmovSource } from './vsmov.source';

/**
 * Movie source registry — to add a new source:
 * 1. Create `new-source.source.ts`
 * 2. Import and add to MOVIE_SOURCES
 * 3. Add key to SOURCE_FALLBACK_ORDER (priority order)
 */
export const MOVIE_SOURCES = {
  kkphim: kkphimSource,
  ophim: ophimSource,
  vsmov: vsmovSource,
} as const satisfies Record<string, MovieSourceConfig>;

export type SourceKey = keyof typeof MOVIE_SOURCES;

export const SOURCE_KEYS: SourceKey[] = ['kkphim', 'ophim', 'vsmov'];

/** Fallback order — first entry is primary. */
export const SOURCE_FALLBACK_ORDER: SourceKey[] = ['kkphim', 'ophim', 'vsmov'];

export const MOVIES_API_PREFIX = 'api/movies';

export const getMovieSource = (key: SourceKey): MovieSourceConfig =>
  MOVIE_SOURCES[key];

export const isSourceKey = (value: string): value is SourceKey =>
  (SOURCE_KEYS as readonly string[]).includes(value);

export const getImageProxySource = (): SourceKey =>
  SOURCE_FALLBACK_ORDER.find(
    (key) => MOVIE_SOURCES[key].capabilities.imageWebp,
  ) ?? 'kkphim';
