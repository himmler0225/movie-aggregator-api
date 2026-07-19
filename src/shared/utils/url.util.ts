import { LEADING_SLASH_PATTERN } from '../constants';

type QueryRecord = Record<string, string | number | undefined>;

export const cleanParams = (
  obj: QueryRecord,
): Record<string, string | number> =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  ) as Record<string, string | number>;

export const buildUrl = (
  baseUrl: string,
  path: string,
  params?: QueryRecord,
): string => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(LEADING_SLASH_PATTERN, '');
  const url = new URL(normalizedPath, normalizedBase);
  if (params) {
    for (const [key, value] of Object.entries(cleanParams(params))) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};
