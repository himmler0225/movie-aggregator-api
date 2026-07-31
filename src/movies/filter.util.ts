import { PAGINATION } from '../shared/constants/pagination.constant';
import type {
  MovieFilterParams,
  SearchParams,
} from '../shared/types/filter.type';
import type { PaginationParams } from '../shared/types/pagination.type';
import type { MovieFilterDto } from './dto/movie-filter.dto';
import type { SearchQueryDto } from './dto/search-query.dto';
import { cleanParams } from '../shared/utils/url.util';

export const resolvePagination = (
  params: PaginationParams = {},
): Required<Pick<PaginationParams, 'page' | 'limit'>> => ({
  page: params.page ?? PAGINATION.defaultPage,
  limit: params.limit ?? PAGINATION.defaultLimit,
});

export const toMovieFilterParams = (
  dto: MovieFilterDto,
): MovieFilterParams => ({
  page: dto.page,
  limit: dto.limit,
  category: dto.category,
  country: dto.country,
  year: dto.year,
  sort_lang: dto.sort_lang,
  sort_field: dto.sort_field,
  sort_type: dto.sort_type,
});

export const toSearchParams = (dto: SearchQueryDto): SearchParams => ({
  keyword: dto.keyword.trim(),
  page: dto.page,
  limit: dto.limit,
});

export const pickContentFilters = (
  filters: MovieFilterParams,
): Omit<MovieFilterParams, 'page' | 'limit'> => ({
  category: filters.category,
  country: filters.country,
  year: filters.year,
  sort_lang: filters.sort_lang,
  sort_field: filters.sort_field,
  sort_type: filters.sort_type,
});

export const buildUpstreamListParams = (
  filters: MovieFilterParams,
  options: {
    supportsContentFilters: boolean;
  },
): Record<string, string | number> => {
  const { page, limit } = resolvePagination(filters);
  if (!options.supportsContentFilters) {
    return { page, limit };
  }
  return cleanParams({
    page,
    limit,
    ...pickContentFilters(filters),
  });
};
