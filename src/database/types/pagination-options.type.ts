export interface PaginationOptions<
  TWhere = Record<string, unknown>,
  TOrderBy = Record<string, unknown>,
> {
  where?: TWhere;
  orderBy?: TOrderBy | TOrderBy[];
  page?: number;
  pageSize?: number;
  select?: Record<string, unknown>;
}
