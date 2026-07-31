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

export const isMovieType = (value: string): value is MovieType =>
  (MOVIE_TYPES as readonly string[]).includes(value);
