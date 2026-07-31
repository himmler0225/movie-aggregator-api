import type { MovieApiResponse } from '../../shared/types/movie.types';
import type { PaginationMeta } from '../../shared/types/pagination.type';

export const buildSourceResponse = <T>(
  source: string,
  data: T,
  pagination?: PaginationMeta,
): MovieApiResponse<T> =>
  pagination !== undefined ? { source, data, pagination } : { source, data };
