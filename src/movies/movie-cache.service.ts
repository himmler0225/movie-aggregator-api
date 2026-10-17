import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '../infra/redis';
import { AppLogger } from '../shared/logger';
import { TtlCache } from '../shared/utils';

const KEY_PREFIX = 'cf:movies:v1:';
/** L1 is per-process; keep it short so instances sharing Redis stay in step. */
const L1_MAX_TTL_MS = 60_000;
const L1_MAX_ENTRIES = 1000;

/**
 * Two-level cache for upstream movie responses:
 * L1 in-process (bounded, with in-flight de-duplication) → L2 Redis (shared,
 * survives restarts) → upstream. Redis is optional and every Redis failure
 * degrades to a plain upstream call; errors are never cached.
 */
@Injectable()
export class MovieCacheService {
  private readonly logger = AppLogger.create(MovieCacheService.name);
  private readonly l1 = new TtlCache<unknown>(L1_MAX_ENTRIES);

  constructor(@Optional() private readonly redis?: RedisService) {}

  getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>) {
    return this.l1.getOrLoad(key, Math.min(ttlMs, L1_MAX_TTL_MS), () =>
      this.fromRedisOrLoad(key, ttlMs, load),
    ) as Promise<T>;
  }

  private async fromRedisOrLoad<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const client = this.redis?.getClient();

    if (!client || client.status !== 'ready') return load();

    const redisKey = KEY_PREFIX + key;

    try {
      const raw = await client.get(redisKey);

      if (raw !== null) return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Redis read failed: ${(error as Error).message}`);
    }

    const value = await load();

    client
      .set(redisKey, JSON.stringify(value), 'PX', ttlMs)
      .catch((error: Error) =>
        this.logger.warn(`Redis write failed: ${error.message}`),
      );

    return value;
  }
}
