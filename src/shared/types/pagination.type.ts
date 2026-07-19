export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  totalItems: number;
  totalItemsPerPage: number;
  currentPage: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}
