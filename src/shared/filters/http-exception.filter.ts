import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { I18nService, type SupportedLocale } from '../../i18n';
import { AppError, AppErrorCode } from '../errors';
import { AppLogger } from '../logger';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = AppLogger.create(HttpExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale = this.i18n.resolveLocale(request.headers['accept-language']);

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json({
        error: this.i18n.translate(`errors.${exception.code}`, { locale }),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const raw =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? 'errors.INTERNAL_ERROR');

      const message = Array.isArray(raw) ? raw.join(', ') : raw;
      response.status(status).json({
        error: this.translateMessage(message, locale),
      });
      return;
    }

    this.logger.unexpected(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: this.i18n.translate(`errors.${AppErrorCode.INTERNAL_ERROR}`, { locale }),
    });
  }

  private translateMessage(message: string, locale: SupportedLocale) {
    if (message.startsWith('errors.') || message.startsWith('auth.') || message.startsWith('platform.')) {
      return this.i18n.translate(message, { locale });
    }
    return message;
  }
}
