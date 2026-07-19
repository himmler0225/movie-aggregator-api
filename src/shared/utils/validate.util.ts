import { AppError, AppErrorCode } from '../errors';
import { isPhimimgUrl } from '../constants/validation.constant';
import { isMovieType } from '../constants/movie-types.constant';
import { isValidYear } from '../constants/validation.constant';

export const assertMovieType = (type: string): void => {
  if (!isMovieType(type)) {
    throw new AppError(AppErrorCode.INVALID_MOVIE_TYPE);
  }
};

export const assertValidYear = (year: string): void => {
  if (!isValidYear(year)) {
    throw new AppError(AppErrorCode.INVALID_YEAR);
  }
};

export const assertKeyword = (keyword: string): void => {
  if (!keyword?.trim()) {
    throw new AppError(AppErrorCode.MISSING_KEYWORD);
  }
};

export const assertPhimimgUrl = (url: string): void => {
  if (!url || !isPhimimgUrl(url)) {
    throw new AppError(AppErrorCode.INVALID_IMAGE_URL);
  }
};
