import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import {
  HTTP_LOG_CONTEXT,
  HTTP_LOG_SKIP_PREFIXES,
} from '../constants/http-log.constant';
import { AppLogger } from '../logger';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = AppLogger.create(HTTP_LOG_CONTEXT);
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, ip } = req;
    if (this.shouldSkip(originalUrl)) {
      return next.handle();
    }
    const started = Date.now();
    let statusCode = 200;
    let failed = false;
    return next.handle().pipe(
      catchError((error: unknown) => {
        failed = true;
        statusCode = this.resolveErrorStatus(context, error);
        return throwError(() => error);
      }),
      finalize(() => {
        if (!failed) {
          const res = context.switchToHttp().getResponse<Response>();
          statusCode = res.statusCode;
        }
        const durationMs = Date.now() - started;
        const clientIp = ip || req.socket.remoteAddress;
        if (failed || statusCode >= 400) {
          this.logger.httpRequestError(
            method,
            originalUrl,
            statusCode,
            durationMs,
            clientIp,
          );
        } else {
          this.logger.httpRequest(
            method,
            originalUrl,
            statusCode,
            durationMs,
            clientIp,
          );
        }
      }),
    );
  }
  private shouldSkip(url: string): boolean {
    return HTTP_LOG_SKIP_PREFIXES.some((prefix) => url.startsWith(prefix));
  }
  private resolveErrorStatus(
    context: ExecutionContext,
    error: unknown,
  ): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }
    const status =
      (
        error as {
          status?: number;
          statusCode?: number;
        }
      ).status ??
      (
        error as {
          statusCode?: number;
        }
      ).statusCode;
    if (status !== undefined) {
      return status;
    }
    const res = context.switchToHttp().getResponse<Response>();
    return res.statusCode >= 400 ? res.statusCode : 500;
  }
}
