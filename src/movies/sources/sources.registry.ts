import { kkphimSource } from './kkphim.source';
import { ophimSource } from './ophim.source';
import type { MovieSourceConfig } from './source.types';
import { vsmovSource } from './vsmov.source';

export const MOVIE_SOURCES = {
  kkphim: kkphimSource,
  ophim: ophimSource,
  vsmov: vsmovSource,
} as const satisfies Record<string, MovieSourceConfig>;

export type SourceKey = keyof typeof MOVIE_SOURCES;

export const SOURCE_KEYS: SourceKey[] = ['kkphim', 'ophim', 'vsmov'];

export const SOURCE_FALLBACK_ORDER: SourceKey[] = ['kkphim', 'ophim', 'vsmov'];

export const MOVIES_API_PREFIX = 'api/movies';

export const isSourceKey = (value: string): value is SourceKey =>
  (SOURCE_KEYS as readonly string[]).includes(value);
