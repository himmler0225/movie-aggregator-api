import { AppError, AppErrorCode } from '../../shared/errors';
import type {
  MetadataListApiResponse,
  MovieDetailApiResponse,
  MovieListApiResponse,
  MovieListItem,
} from '../../shared/types/movie.types';
import type { PaginationMeta } from '../../shared/types/pagination.type';
import type {
  VsmovDetailResponse,
  VsmovListItem,
  VsmovListResponse,
  VsmovMetadataResponse,
  VsmovPagination,
  VsmovTaxonomyItem,
} from './vsmov.types';

const SOURCE = 'vsmov';

const normalizeTaxonomyItem = (item: VsmovTaxonomyItem) => ({
  id: String(item._id),
  name: item.name,
  slug: item.slug,
});

const normalizeListItem = (movie: VsmovListItem): MovieListItem => ({
  _id: String(movie._id),
  name: movie.name,
  slug: movie.slug,
  origin_name: movie.origin_name,
  poster_url: movie.poster_url,
  thumb_url: movie.thumb_url,
  year: movie.year,
});

const normalizePagination = (pagination: VsmovPagination): PaginationMeta => ({
  totalItems: Number(pagination.totalItems),
  totalItemsPerPage: Number(pagination.totalItemsPerPage),
  currentPage: Number(pagination.currentPage),
  totalPages: Number(pagination.totalPages),
});

export const normalizeVsmovListResponse = (
  raw: VsmovListResponse,
): MovieListApiResponse => ({
  source: SOURCE,
  data: raw.items.map(normalizeListItem),
  pagination: normalizePagination(raw.pagination),
});

export const normalizeVsmovDetailResponse = (
  raw: VsmovDetailResponse,
): MovieDetailApiResponse => {
  if (!raw.status || !raw.movie?.name || !raw.movie.slug) {
    throw new AppError(AppErrorCode.MOVIE_NOT_FOUND, raw.msg || undefined);
  }

  const movie = raw.movie;

  return {
    source: SOURCE,
    data: {
      movie: {
        ...normalizeListItem(movie),
        type: movie.type,
        quality: movie.quality,
        lang: movie.lang,
        episode_current: movie.episode_current,
        episode_total: movie.episode_total ?? undefined,
        time: movie.time,
        category: movie.category.map(normalizeTaxonomyItem),
        country: movie.country.map(normalizeTaxonomyItem),
        content: movie.content,
        status: movie.status,
        director: movie.director,
        actor: movie.actor,
        trailer_url: movie.trailer_url ?? undefined,
        is_copyright: movie.is_copyright,
        sub_docquyen: movie.sub_docquyen,
        chieurap: movie.chieurap,
        showtimes: movie.showtimes ?? undefined,
        view: movie.view,
        notify: movie.notify ?? undefined,
        modified: movie.modified,
      },
      episodes: raw.episodes.map((server) => ({
        server_name: server.server_name,
        server_data: server.server_data.map((episode) => ({
          name: episode.name,
          slug: episode.slug,
          filename: episode.filename,
          link_embed: episode.link_embed,
          link_m3u8: '',
        })),
      })),
    },
  };
};

export const normalizeVsmovMetadataResponse = (
  raw: VsmovMetadataResponse,
): MetadataListApiResponse => ({
  source: SOURCE,
  data: raw.data.items.map((item) => ({
    _id: String(item._id),
    name: item.name,
    slug: item.slug,
  })),
});
