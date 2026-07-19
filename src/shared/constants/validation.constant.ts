import { MOVIE_SOURCE_URLS } from './url.constant';

export const YEAR_PATTERN = /^\d{4}$/;

export const PHIMIMG_HOST = new URL(MOVIE_SOURCE_URLS.kkphim.images).hostname;

export const isValidYear = (value: string): boolean => YEAR_PATTERN.test(value);

export const isPhimimgUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === PHIMIMG_HOST ||
      parsed.hostname.endsWith(`.${PHIMIMG_HOST}`)
    );
  } catch {
    return false;
  }
};
