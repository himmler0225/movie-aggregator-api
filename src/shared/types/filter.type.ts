import type {
  SortField,
  SortLang,
  SortType,
} from '../constants/sort-options.constant';
import type { PaginationParams } from './pagination.type';

export interface MovieFilterParams extends PaginationParams {
  category?: string;
  country?: string;
  year?: string;
  sort_lang?: SortLang;
  sort_field?: SortField;
  sort_type?: SortType;
}

export interface SearchParams extends PaginationParams {
  keyword: string;
}
