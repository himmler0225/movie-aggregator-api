import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { AppError, AppErrorCode } from '../shared/errors';
import {
  UPSTREAM_RETRY,
  UPSTREAM_RETRYABLE_STATUS,
  UPSTREAM_TIMEOUT,
  UpstreamTimeoutKind,
} from '../shared/constants/upstream.constant';
import { UPSTREAM_NETWORK_ERROR_PATTERN } from '../shared/constants';
import { AppLogger } from '../shared/logger';

@Injectable()
export class UpstreamClientService {
  private readonly logger = AppLogger.create(UpstreamClientService.name);
  constructor(private readonly http: HttpService) {}
  async getJson<T>(
    url: string,
    timeoutKind: UpstreamTimeoutKind,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.executeWithRetry(url, timeoutKind, async (timeout) => {
      const response = await firstValueFrom(
        this.http.get<T>(url, {
          ...config,
          timeout,
          headers: {
            Accept: 'application/json',
            ...config?.headers,
          },
          validateStatus: () => true,
        }),
      );
      return this.handleResponse(response);
    });
  }
  async getBinary(
    url: string,
    timeoutKind: UpstreamTimeoutKind,
    config?: AxiosRequestConfig,
  ): Promise<{
    data: Buffer;
    contentType: string;
  }> {
    return this.executeWithRetry(url, timeoutKind, async (timeout) => {
      const response = await firstValueFrom(
        this.http.get<ArrayBuffer>(url, {
          ...config,
          timeout,
          responseType: 'arraybuffer',
          validateStatus: () => true,
        }),
      );
      if (response.status >= 400) {
        throw AppError.fromUpstreamStatus(response.status);
      }
      return {
        data: Buffer.from(response.data),
        contentType:
          (response.headers['content-type'] as string) ??
          'application/octet-stream',
      };
    });
  }
  private async executeWithRetry<T>(
    url: string,
    timeoutKind: UpstreamTimeoutKind,
    request: (timeout: number) => Promise<T>,
  ): Promise<T> {
    const timeout = UPSTREAM_TIMEOUT[timeoutKind];
    let lastError: unknown;
    for (let attempt = 0; attempt <= UPSTREAM_RETRY.maxRetries; attempt++) {
      try {
        return await request(timeout);
      } catch (error) {
        lastError = error;
        if (!this.shouldRetry(error, attempt)) {
          break;
        }
        const delay = this.getRetryDelay(attempt);
        this.logger.upstreamRetry(
          attempt + 1,
          UPSTREAM_RETRY.maxRetries,
          delay,
          url,
        );
        await this.sleep(delay);
      }
    }
    throw this.toAppError(lastError);
  }
  private handleResponse<T>(response: AxiosResponse<T>): T {
    if (response.status >= 500) {
      throw new AppError(AppErrorCode.UPSTREAM_ERROR);
    }
    if (response.status >= 400) {
      throw AppError.fromUpstreamStatus(response.status);
    }
    return response.data;
  }
  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= UPSTREAM_RETRY.maxRetries) {
      return false;
    }
    if (error instanceof AppError) {
      return (
        error.code === AppErrorCode.UPSTREAM_ERROR ||
        error.code === AppErrorCode.UPSTREAM_TIMEOUT
      );
    }
    if (error instanceof AxiosError) {
      if (this.isNetworkOrTimeoutError(error)) {
        return true;
      }
      const status = error.response?.status;
      return status !== undefined && UPSTREAM_RETRYABLE_STATUS.has(status);
    }
    return false;
  }
  private isNetworkOrTimeoutError(error: AxiosError): boolean {
    if (UPSTREAM_NETWORK_ERROR_PATTERN.test(error.code ?? '')) {
      return true;
    }
    return error.message.toLowerCase().includes('timeout');
  }
  private getRetryDelay(attempt: number): number {
    return Math.min(
      UPSTREAM_RETRY.backoffMs[attempt] ?? UPSTREAM_RETRY.maxBackoffMs,
      UPSTREAM_RETRY.maxBackoffMs,
    );
  }
  private toAppError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }
    if (error instanceof AxiosError) {
      if (this.isNetworkOrTimeoutError(error)) {
        return new AppError(AppErrorCode.UPSTREAM_TIMEOUT);
      }
      if (error.response?.status) {
        return AppError.fromUpstreamStatus(error.response.status);
      }
      this.logger.upstreamError(error.message);
      return new AppError(AppErrorCode.UPSTREAM_ERROR);
    }
    this.logger.unexpected(error);
    return new AppError(AppErrorCode.UPSTREAM_ERROR);
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
