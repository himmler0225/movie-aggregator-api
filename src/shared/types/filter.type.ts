import type { SortField, SortLang, SortType } from '../constants/sort-options.constant';
import type { PaginationParams } from './pagination.type';

/** Movie list filters — shared across all list endpoints. */
export interface MovieFilterParams extends PaginationParams {
  category?: string;
  country?: string;
  year?: string;
  sort_lang?: SortLang;
  sort_field?: SortField;
  sort_type?: SortType;
}

/** Pagination only — new movies and metadata endpoints. */
export type PageQueryParams = Pick<PaginationParams, 'page'>;

/** Search — keyword + pagination. */
export interface SearchParams extends PaginationParams {
  keyword: string;
}

/** Shared sort params. */
export interface SortParams {
  sort_field?: string;
  sort_type?: SortType;
}
