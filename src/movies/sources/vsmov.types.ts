export interface VsmovExternalId {
  id: string | null;
}

export interface VsmovTmdb {
  type: string;
  id: string | null;
  season: number | null;
  vote_average: string;
  vote_count: number;
}

export interface VsmovTimestamp {
  time: string;
}

export interface VsmovListItem {
  tmdb: VsmovTmdb;
  imdb: VsmovExternalId;
  modified: VsmovTimestamp;
  _id: number;
  name: string;
  origin_name: string;
  slug: string;
  poster_url: string;
  thumb_url: string;
  year: number;
}

export interface VsmovPagination {
  totalItems: number;
  totalItemsPerPage: number | string;
  currentPage: number;
  totalPages: number;
}

export interface VsmovListResponse {
  status: boolean;
  items: VsmovListItem[];
  pagination: VsmovPagination;
  pathImage?: string;
}

export interface VsmovTaxonomyItem {
  _id: number | string;
  name: string;
  slug: string;
}

export interface VsmovMetadataResponse {
  status: string;
  message: string;
  data: {
    items: VsmovTaxonomyItem[];
  };
}

export interface VsmovMovie extends VsmovListItem {
  created: VsmovTimestamp;
  content: string;
  type: 'series' | 'single';
  status: string;
  is_copyright: boolean;
  trailer_url: string | null;
  time: string;
  episode_current: string;
  episode_total: string | null;
  quality: string;
  lang: string;
  notify: string | null;
  showtimes: string | null;
  keywords: string | null;
  view: number;
  chieurap: boolean;
  sub_docquyen: boolean;
  actor: string[];
  director: string[];
  category: VsmovTaxonomyItem[];
  country: VsmovTaxonomyItem[];
}

export interface VsmovEpisode {
  name: string;
  slug: string;
  filename: string;
  link_embed: string;
}

export interface VsmovEpisodeServer {
  server_name: string;
  server_data: VsmovEpisode[];
}

export interface VsmovDetailResponse {
  status: boolean;
  msg: string;
  movie: VsmovMovie;
  episodes: VsmovEpisodeServer[];
}
