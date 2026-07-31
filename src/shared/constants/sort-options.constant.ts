export const SORT_LANGS = ['vietsub', 'thuyet-minh', 'long-tieng'] as const;

export type SortLang = (typeof SORT_LANGS)[number];

export const SORT_FIELDS = ['modified.time', '_id', 'year'] as const;

export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_TYPES = ['desc', 'asc'] as const;

export type SortType = (typeof SORT_TYPES)[number];
