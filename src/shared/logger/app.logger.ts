import { Logger, LoggerService } from '@nestjs/common';

type LogContext = string | { name: string };

/**
 * Shared logger — wraps NestJS Logger with consistent formatting.
 *
 * @example
 * private readonly logger = AppLogger.create(MyService.name);
 * this.logger.log('started');
 * this.logger.upstreamRetry(1, 3, 500, url);
 */
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  private constructor(context: string) {
    this.logger = new Logger(context);
  }

  /** Create a logger for a class or module name. */
  static create(context: LogContext): AppLogger {
    const name = typeof context === 'string' ? context : context.name;
    return new AppLogger(name);
  }

  log(message: unknown, context?: string): void {
    if (context !== undefined) {
      this.logger.log(message, context);
      return;
    }
    this.logger.log(message);
  }

  warn(message: unknown, context?: string): void {
    if (context !== undefined) {
      this.logger.warn(message, context);
      return;
    }
    this.logger.warn(message);
  }

  error(message: unknown, trace?: string, context?: string): void {
    if (trace !== undefined) {
      this.logger.error(message, trace, context);
      return;
    }
    if (context !== undefined) {
      this.logger.error(message, undefined, context);
      return;
    }
    this.logger.error(message);
  }

  debug(message: unknown, context?: string): void {
    if (context !== undefined) {
      this.logger.debug(message, context);
      return;
    }
    this.logger.debug(message);
  }

  verbose(message: unknown, context?: string): void {
    if (context !== undefined) {
      this.logger.verbose(message, context);
      return;
    }
    this.logger.verbose(message);
  }

  /** Log upstream retry (phimapi / ophim). */
  upstreamRetry(
    attempt: number,
    maxRetries: number,
    delayMs: number,
    url: string,
  ): void {
    this.warn(
      `Upstream retry ${attempt}/${maxRetries} in ${delayMs}ms — ${url}`,
    );
  }

  /** Log upstream network / HTTP error before throw. */
  upstreamError(message: string): void {
    this.warn(`Upstream error: ${message}`);
  }

  /** Log unexpected errors with full error object. */
  unexpected(error: unknown): void {
    this.error(error);
  }

  /** Log successful incoming HTTP request. */
  httpRequest(
    method: string,
    url: string,
    status: number,
    durationMs: number,
    ip?: string,
  ): void {
    const ipSuffix = ip ? ` — ${ip}` : '';
    this.log(`${method} ${url} ${status} ${durationMs}ms${ipSuffix}`);
  }

  /** Log failed incoming HTTP request (4xx/5xx). */
  httpRequestError(
    method: string,
    url: string,
    status: number,
    durationMs: number,
    ip?: string,
  ): void {
    const ipSuffix = ip ? ` — ${ip}` : '';
    this.warn(`${method} ${url} ${status} ${durationMs}ms${ipSuffix}`);
  }

  /** Log a route registered at bootstrap. */
  logRoute(method: string, path: string): void {
    this.log(`${method.padEnd(6)} ${path}`);
  }
}
