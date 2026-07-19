import type { PaginationMeta } from './pagination.type';

export interface Category {
  id?: string;
  name: string;
  slug: string;
}

export interface Country {
  id?: string;
  name: string;
  slug: string;
}

export interface MetadataItem {
  _id: string;
  name: string;
  slug: string;
}

export interface MovieListItem {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  poster_url: string;
  thumb_url: string;
  year?: number;
  type?: string;
  quality?: string;
  lang?: string;
  episode_current?: string;
  episode_total?: string;
  time?: string;
  category?: Category[];
  country?: Country[];
}

export interface EpisodeServerData {
  name: string;
  slug: string;
  filename?: string;
  link_embed: string;
  link_m3u8: string;
}

export interface EpisodeServer {
  server_name: string;
  server_data: EpisodeServerData[];
}

export interface MovieDetail extends MovieListItem {
  content?: string;
  status?: string;
  director?: string[];
  actor?: string[];
  trailer_url?: string;
  is_copyright?: boolean;
  sub_docquyen?: boolean;
  chieurap?: boolean;
  showtimes?: string;
  view?: number;
  notify?: string;
  modified?: { time: string };
}

/** Unified response envelope for all movie endpoints. */
export interface MovieApiResponse<T> {
  source: string;
  data: T;
  pagination?: PaginationMeta;
}

export interface MovieDetailData {
  movie: MovieDetail;
  episodes: EpisodeServer[];
}

export type MovieListApiResponse = MovieApiResponse<MovieListItem[]>;
export type MovieDetailApiResponse = MovieApiResponse<MovieDetailData>;
export type MetadataListApiResponse = MovieApiResponse<MetadataItem[]>;
