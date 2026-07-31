import { AppError, AppErrorCode } from '../shared/errors';
import { LEADING_SLASH_PATTERN } from '../shared/constants';
import type {
  MetadataItem,
  MetadataListApiResponse,
  MovieDetail,
  MovieDetailApiResponse,
  MovieDetailData,
  MovieListApiResponse,
  MovieListItem,
} from '../shared/types/movie.types';
import { MOVIE_SOURCES, type SourceKey } from './sources/sources.registry';
import { buildSourceResponse } from './sources/source-response.util';

type AnyObj = Record<string, unknown>;

const toAbsoluteImg = (raw: string | undefined, source: SourceKey): string => {
  if (!raw) return '';
  return raw.startsWith('http')
    ? raw
    : MOVIE_SOURCES[source].imgBase + raw.replace(LEADING_SLASH_PATTERN, '');
};

export const normalizeMovie = (
  raw: AnyObj,
  source: SourceKey,
): MovieListItem => ({
  _id: raw._id as string | undefined,
  name: (raw.name as string) ?? '',
  slug: (raw.slug as string) ?? '',
  origin_name: raw.origin_name as string | undefined,
  poster_url: toAbsoluteImg(raw.poster_url as string | undefined, source),
  thumb_url: toAbsoluteImg(raw.thumb_url as string | undefined, source),
  year: raw.year as number | undefined,
  quality: raw.quality as string | undefined,
  lang: raw.lang as string | undefined,
  episode_current: raw.episode_current as string | undefined,
  episode_total: raw.episode_total as string | undefined,
  type: raw.type as string | undefined,
  time: raw.time as string | undefined,
  category: raw.category as MovieListItem['category'],
  country: raw.country as MovieListItem['country'],
});

export const normalizeNewMoviesResponse = (
  raw: AnyObj,
  source: SourceKey,
): MovieListApiResponse => {
  const items = ((raw.items as AnyObj[]) ?? []).map((it) =>
    normalizeMovie(it, source),
  );
  return buildSourceResponse(
    source,
    items,
    raw.pagination as MovieListApiResponse['pagination'],
  );
};

export const normalizeListResponse = (
  raw: AnyObj,
  source: SourceKey,
): MovieListApiResponse => {
  const data = (raw.data as AnyObj) ?? {};
  const items = ((data.items as AnyObj[]) ?? []).map((it) =>
    normalizeMovie(it, source),
  );
  const pagination = (data.params as AnyObj | undefined)?.pagination as
    MovieListApiResponse['pagination'] | undefined;
  return buildSourceResponse(source, items, pagination);
};

export const normalizeDetailResponse = (
  raw: AnyObj,
  source: SourceKey,
): MovieDetailApiResponse => {
  const movie = (raw.movie as AnyObj) ?? {};
  const statusFalse = raw.status === false || raw.status === 'false';
  const noMovie =
    !movie || typeof movie !== 'object' || !movie.name || !movie.slug;
  if (statusFalse || noMovie) {
    throw new AppError(
      AppErrorCode.MOVIE_NOT_FOUND,
      (raw.msg as string) || undefined,
    );
  }
  const normalizedMovie: MovieDetail = {
    ...normalizeMovie(movie, source),
    content: movie.content as string | undefined,
    status: movie.status as string | undefined,
    director: movie.director as string[] | undefined,
    actor: movie.actor as string[] | undefined,
    trailer_url: movie.trailer_url as string | undefined,
    is_copyright: movie.is_copyright as boolean | undefined,
    sub_docquyen: movie.sub_docquyen as boolean | undefined,
    chieurap: movie.chieurap as boolean | undefined,
    showtimes: movie.showtimes as string | undefined,
    view: movie.view as number | undefined,
    notify: movie.notify as string | undefined,
    modified: movie.modified as
      | {
          time: string;
        }
      | undefined,
  };
  const detailData: MovieDetailData = {
    movie: normalizedMovie,
    episodes: (raw.episodes as MovieDetailData['episodes']) ?? [],
  };
  return buildSourceResponse(source, detailData);
};

const extractMetadataItems = (raw: unknown): MetadataItem[] => {
  if (Array.isArray(raw)) return raw as MetadataItem[];
  if (raw && typeof raw === 'object') {
    const obj = raw as AnyObj;
    if (Array.isArray(obj.items)) return obj.items as MetadataItem[];
    const data = obj.data;
    if (Array.isArray(data)) return data as MetadataItem[];
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as AnyObj).items)
    ) {
      return (data as AnyObj).items as MetadataItem[];
    }
  }
  return [];
};

export const normalizeMetadataResponse = (
  raw: unknown,
  source: SourceKey,
): MetadataListApiResponse =>
  buildSourceResponse(source, extractMetadataItems(raw));
