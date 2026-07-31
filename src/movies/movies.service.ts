import { Injectable } from '@nestjs/common';
import { AppError, AppErrorCode } from '../shared/errors';
import { AppLogger } from '../shared/logger';
import type {
  MetadataListApiResponse,
  MovieDetailApiResponse,
  MovieListApiResponse,
} from '../shared/types/movie.types';
import type {
  MovieFilterParams,
  SearchParams,
} from '../shared/types/filter.type';
import type { UpstreamTimeoutKind } from '../shared/constants/upstream.constant';
import type { MovieType } from '../shared/constants/movie-types.constant';
import {
  assertKeyword,
  assertMovieType,
  assertPhimimgUrl,
  assertValidYear,
  buildUrl,
} from '../shared/utils';
import { UpstreamClientService } from '../upstream/upstream-client.service';
import { buildUpstreamListParams, resolvePagination } from './filter.util';
import {
  normalizeDetailResponse,
  normalizeListResponse,
  normalizeMetadataResponse,
  normalizeNewMoviesResponse,
} from './movie.normalizer';
import {
  isSourceKey,
  MOVIE_SOURCES,
  SOURCE_FALLBACK_ORDER,
  type SourceKey,
} from './sources/sources.registry';
import {
  normalizeVsmovDetailResponse,
  normalizeVsmovListResponse,
  normalizeVsmovMetadataResponse,
} from './sources/vsmov.mapper';
import type {
  VsmovDetailResponse,
  VsmovListResponse,
  VsmovMetadataResponse,
} from './sources/vsmov.types';

@Injectable()
export class MoviesService {
  private readonly logger = AppLogger.create(MoviesService.name);
  constructor(private readonly upstream: UpstreamClientService) {}
  getNewMovies(
    page = 1,
    pinnedSource?: SourceKey,
  ): Promise<MovieListApiResponse> {
    return this.withFallback('getNewMovies', pinnedSource, (source) =>
      this.fetchNewMovies(source, page),
    );
  }
  getMoviesByType(
    type: string,
    filters: MovieFilterParams = {},
    pinnedSource?: SourceKey,
  ): Promise<MovieListApiResponse> {
    return this.withFallback('getMoviesByType', pinnedSource, (source) =>
      this.fetchMoviesByType(source, type, filters),
    );
  }
  getMovieDetail(
    slug: string,
    pinnedSource?: SourceKey,
  ): Promise<MovieDetailApiResponse> {
    return this.withFallback('getMovieDetail', pinnedSource, (source) =>
      this.fetchMovieDetail(source, slug),
    );
  }
  searchMovies(
    params: SearchParams,
    pinnedSource?: SourceKey,
  ): Promise<MovieListApiResponse> {
    return this.withFallback('searchMovies', pinnedSource, (source) =>
      this.fetchSearchMovies(source, params),
    );
  }
  getByGenre(
    slug: string,
    filters: MovieFilterParams = {},
    pinnedSource?: SourceKey,
  ): Promise<MovieListApiResponse> {
    return this.withFallback('getByGenre', pinnedSource, (source) =>
      this.fetchByGenre(source, slug, filters),
    );
  }
  getByCountry(
    slug: string,
    filters: MovieFilterParams = {},
    pinnedSource?: SourceKey,
  ): Promise<MovieListApiResponse> {
    return this.withFallback('getByCountry', pinnedSource, (source) =>
      this.fetchByCountry(source, slug, filters),
    );
  }
  getByYear(
    year: string,
    filters: MovieFilterParams = {},
    pinnedSource?: SourceKey,
  ): Promise<MovieListApiResponse> {
    return this.withFallback('getByYear', pinnedSource, (source) =>
      this.fetchByYear(source, year, filters),
    );
  }
  getAllGenres(pinnedSource?: SourceKey): Promise<MetadataListApiResponse> {
    return this.withFallback('getAllGenres', pinnedSource, (source) =>
      this.fetchAllGenres(source),
    );
  }
  getAllCountries(pinnedSource?: SourceKey): Promise<MetadataListApiResponse> {
    return this.withFallback('getAllCountries', pinnedSource, (source) =>
      this.fetchAllCountries(source),
    );
  }
  getAllYears(pinnedSource?: SourceKey): Promise<MetadataListApiResponse> {
    return this.fetchAllYears(pinnedSource ?? 'vsmov');
  }
  getImageWebp(imageUrl: string) {
    assertPhimimgUrl(imageUrl);
    return this.upstream.getBinary(imageUrl, 'image');
  }
  resolvePinnedSource(value?: string): SourceKey | undefined {
    if (!value) return undefined;
    if (!isSourceKey(value)) {
      throw new AppError(AppErrorCode.BAD_REQUEST, 'Invalid source.');
    }
    return value;
  }
  private async withFallback<
    T extends {
      source: string;
    },
  >(
    context: string,
    pinnedSource: SourceKey | undefined,
    call: (source: SourceKey) => Promise<T>,
  ): Promise<T> {
    if (pinnedSource) {
      return call(pinnedSource);
    }
    const [primary, ...fallbacks] = SOURCE_FALLBACK_ORDER;
    try {
      return await call(primary);
    } catch (primaryError) {
      if (
        primaryError instanceof AppError &&
        !this.isFallbackable(primaryError)
      ) {
        throw primaryError;
      }
      for (const fallback of fallbacks) {
        this.logger.warn(
          `${context} failed @${primary}, fallback @${fallback}`,
        );
        try {
          return await call(fallback);
        } catch {
          // already logged above — move on to the next fallback source
        }
      }
      if (primaryError instanceof AppError) throw primaryError;
      throw new AppError(AppErrorCode.UPSTREAM_ERROR);
    }
  }
  private isFallbackable(error: AppError): boolean {
    return (
      error.code === AppErrorCode.UPSTREAM_ERROR ||
      error.code === AppErrorCode.UPSTREAM_TIMEOUT ||
      error.code === AppErrorCode.MOVIE_NOT_FOUND
    );
  }
  private async fetchNewMovies(
    source: SourceKey,
    page = 1,
  ): Promise<MovieListApiResponse> {
    const { baseUrl, routes } = MOVIE_SOURCES[source];
    const url = buildUrl(baseUrl, routes.newMovies, { page });
    const raw = await this.upstream.getJson<Record<string, unknown>>(
      url,
      'list',
    );
    return source === 'vsmov'
      ? normalizeVsmovListResponse(raw as unknown as VsmovListResponse)
      : normalizeNewMoviesResponse(raw, source);
  }
  private async fetchMoviesByType(
    source: SourceKey,
    type: string,
    filters: MovieFilterParams = {},
  ): Promise<MovieListApiResponse> {
    assertMovieType(type);
    const config = MOVIE_SOURCES[source];
    const { baseUrl, routes } = config;
    const upstreamType = config.typeMap
      ? config.typeMap[type as MovieType]
      : type;
    if (!upstreamType) {
      throw new AppError(
        AppErrorCode.BAD_REQUEST,
        `Movie type "${type}" is not supported by ${source}.`,
      );
    }
    const params = this.buildListParams(source, filters);
    const url =
      config.capabilities.listByTypeMode === 'query'
        ? buildUrl(baseUrl, routes.listByType, {
            ...params,
            type: upstreamType,
          })
        : buildUrl(baseUrl, `${routes.listByType}/${upstreamType}`, params);
    const raw = await this.upstream.getJson<Record<string, unknown>>(
      url,
      'list',
    );
    return this.normalizeList(raw, source);
  }
  private async fetchMovieDetail(
    source: SourceKey,
    slug: string,
  ): Promise<MovieDetailApiResponse> {
    const { baseUrl, routes } = MOVIE_SOURCES[source];
    const url = buildUrl(baseUrl, `${routes.detail}/${slug}`);
    const raw = await this.upstream.getJson<Record<string, unknown>>(
      url,
      'detail',
    );
    return source === 'vsmov'
      ? normalizeVsmovDetailResponse(raw as unknown as VsmovDetailResponse)
      : normalizeDetailResponse(raw, source);
  }
  private async fetchSearchMovies(
    source: SourceKey,
    params: SearchParams,
  ): Promise<MovieListApiResponse> {
    assertKeyword(params.keyword);
    const { page, limit } = resolvePagination(params);
    const { baseUrl, routes } = MOVIE_SOURCES[source];
    const url = buildUrl(baseUrl, routes.search, {
      keyword: params.keyword.trim(),
      page,
      limit,
    });
    const raw = await this.upstream.getJson<Record<string, unknown>>(
      url,
      'search',
    );
    return this.normalizeList(raw, source);
  }
  private async fetchByGenre(
    source: SourceKey,
    slug: string,
    filters: MovieFilterParams = {},
  ): Promise<MovieListApiResponse> {
    const { routes } = MOVIE_SOURCES[source];
    return this.fetchFilteredList(
      source,
      `${routes.byGenre}/${slug}`,
      filters,
      'list',
    );
  }
  private async fetchByCountry(
    source: SourceKey,
    slug: string,
    filters: MovieFilterParams = {},
  ): Promise<MovieListApiResponse> {
    const { routes } = MOVIE_SOURCES[source];
    return this.fetchFilteredList(
      source,
      `${routes.byCountry}/${slug}`,
      filters,
      'list',
    );
  }
  private async fetchByYear(
    source: SourceKey,
    year: string,
    filters: MovieFilterParams = {},
  ): Promise<MovieListApiResponse> {
    assertValidYear(year);
    const { routes } = MOVIE_SOURCES[source];
    return this.fetchFilteredList(
      source,
      `${routes.byYear}/${year}`,
      filters,
      'list',
    );
  }
  private async fetchAllGenres(
    source: SourceKey,
  ): Promise<MetadataListApiResponse> {
    const { baseUrl, routes } = MOVIE_SOURCES[source];
    const url = buildUrl(baseUrl, routes.genres);
    const raw = await this.upstream.getJson<unknown>(url, 'meta');
    return this.normalizeMetadata(raw, source);
  }
  private async fetchAllCountries(
    source: SourceKey,
  ): Promise<MetadataListApiResponse> {
    const { baseUrl, routes } = MOVIE_SOURCES[source];
    const url = buildUrl(baseUrl, routes.countries);
    const raw = await this.upstream.getJson<unknown>(url, 'meta');
    return this.normalizeMetadata(raw, source);
  }
  private async fetchAllYears(
    source: SourceKey,
  ): Promise<MetadataListApiResponse> {
    const { baseUrl, routes } = MOVIE_SOURCES[source];
    if (!routes.years || source !== 'vsmov') {
      throw new AppError(
        AppErrorCode.BAD_REQUEST,
        `Year metadata is not supported by ${source}.`,
      );
    }
    const url = buildUrl(baseUrl, routes.years);
    const raw = await this.upstream.getJson<VsmovMetadataResponse>(url, 'meta');
    return normalizeVsmovMetadataResponse(raw);
  }
  private async fetchFilteredList(
    source: SourceKey,
    path: string,
    filters: MovieFilterParams,
    timeoutKind: UpstreamTimeoutKind,
  ): Promise<MovieListApiResponse> {
    const { baseUrl } = MOVIE_SOURCES[source];
    const params = this.buildListParams(source, filters);
    const url = buildUrl(baseUrl, path, params);
    const raw = await this.upstream.getJson<Record<string, unknown>>(
      url,
      timeoutKind,
    );
    return this.normalizeList(raw, source);
  }
  private buildListParams(
    source: SourceKey,
    filters: MovieFilterParams,
  ): Record<string, string | number> {
    return buildUpstreamListParams(filters, {
      supportsContentFilters:
        MOVIE_SOURCES[source].capabilities.listByTypeFilters,
    });
  }
  private normalizeList(
    raw: Record<string, unknown>,
    source: SourceKey,
  ): MovieListApiResponse {
    return source === 'vsmov'
      ? normalizeVsmovListResponse(raw as unknown as VsmovListResponse)
      : normalizeListResponse(raw, source);
  }
  private normalizeMetadata(
    raw: unknown,
    source: SourceKey,
  ): MetadataListApiResponse {
    return source === 'vsmov'
      ? normalizeVsmovMetadataResponse(raw as VsmovMetadataResponse)
      : normalizeMetadataResponse(raw, source);
  }
}
