export const MOVIE_TYPES = [
  'phim-bo',
  'phim-le',
  'tv-shows',
  'hoat-hinh',
  'phim-vietsub',
  'phim-thuyet-minh',
  'phim-long-tieng',
] as const;

export type MovieType = (typeof MOVIE_TYPES)[number];

export const MOVIE_TYPE_LABELS: Record<MovieType, string> = {
  'phim-bo': 'TV Series',
  'phim-le': 'Feature Film',
  'tv-shows': 'TV Shows',
  'hoat-hinh': 'Animation',
  'phim-vietsub': 'Vietsub',
  'phim-thuyet-minh': 'Dubbed (VN)',
  'phim-long-tieng': 'Voice-over (VN)',
};

export const isMovieType = (value: string): value is MovieType =>
  (MOVIE_TYPES as readonly string[]).includes(value);
