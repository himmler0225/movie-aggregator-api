import { HttpStatus } from '@nestjs/common';

export enum AppErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  MISSING_KEYWORD = 'MISSING_KEYWORD',
  INVALID_MOVIE_TYPE = 'INVALID_MOVIE_TYPE',
  INVALID_YEAR = 'INVALID_YEAR',
  INVALID_IMAGE_URL = 'INVALID_IMAGE_URL',
  MOVIE_NOT_FOUND = 'MOVIE_NOT_FOUND',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
}

const APP_ERROR_STATUS: Record<AppErrorCode, HttpStatus> = {
  [AppErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [AppErrorCode.MISSING_KEYWORD]: HttpStatus.BAD_REQUEST,
  [AppErrorCode.INVALID_MOVIE_TYPE]: HttpStatus.BAD_REQUEST,
  [AppErrorCode.INVALID_YEAR]: HttpStatus.BAD_REQUEST,
  [AppErrorCode.INVALID_IMAGE_URL]: HttpStatus.BAD_REQUEST,
  [AppErrorCode.MOVIE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AppErrorCode.UPSTREAM_ERROR]: HttpStatus.BAD_GATEWAY,
  [AppErrorCode.UPSTREAM_TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
  [AppErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [AppErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [AppErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: HttpStatus;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = APP_ERROR_STATUS[code];
  }

  toResponse(): { error: string } {
    return { error: this.code };
  }

  static fromUpstreamStatus(status: number, fallbackMessage?: string): AppError {
    if (status === 404) {
      return new AppError(AppErrorCode.MOVIE_NOT_FOUND);
    }
    if (status >= 400 && status < 500) {
      return new AppError(AppErrorCode.BAD_REQUEST, fallbackMessage ?? `HTTP ${status}`);
    }
    return new AppError(AppErrorCode.UPSTREAM_ERROR, fallbackMessage);
  }
}
