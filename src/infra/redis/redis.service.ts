import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config';
import { AppLogger } from '../../shared/logger';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = AppLogger.create(RedisService.name);
  private readonly client: Redis | null;
  constructor(private readonly appConfig: AppConfigService) {
    if (!this.appConfig.isRedisConfigured) {
      this.logger.warn(
        'REDIS_URL not set — rate limiting, permission cache sync, and ' +
          'watch-party presence are process-local. Fine for a single ' +
          'instance; set REDIS_URL before running more than one.',
      );
      this.client = null;
      return;
    }
    this.client = new Redis(this.appConfig.redisUrl, {
      maxRetriesPerRequest: 2,
    });
    this.client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`, err.stack),
    );
    this.client.on('connect', () => this.logger.log('Connected to Redis'));
  }
  get isEnabled(): boolean {
    return this.client !== null;
  }
  getClient(): Redis | null {
    return this.client;
  }
  createSubscriber(): Redis | null {
    if (!this.appConfig.isRedisConfigured) return null;
    return new Redis(this.appConfig.redisUrl);
  }
  async onModuleDestroy() {
    await this.client?.quit();
  }
}
