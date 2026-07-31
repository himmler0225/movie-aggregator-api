import { Logger, LoggerService } from '@nestjs/common';

type LogContext =
  | string
  | {
      name: string;
    };

export class AppLogger implements LoggerService {
  private readonly logger: Logger;
  private constructor(context: string) {
    this.logger = new Logger(context);
  }
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
  upstreamError(message: string): void {
    this.warn(`Upstream error: ${message}`);
  }
  unexpected(error: unknown): void {
    this.error(error);
  }
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
  logRoute(method: string, path: string): void {
    this.log(`${method.padEnd(6)} ${path}`);
  }
}
