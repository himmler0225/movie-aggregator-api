import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RedisService } from '../../infra/redis';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

export const RateLimit = (opts: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, opts);

type Bucket = {
  count: number;
  resetAt: number;
};

const localBuckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function checkLocal(
  key: string,
  opts: RateLimitOptions,
):
  | {
      ok: true;
    }
  | {
      ok: false;
      retryAfterSec: number;
    } {
  const now = Date.now();
  const existing = localBuckets.get(key);
  if (!existing || now >= existing.resetAt) {
    localBuckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true };
}

function pruneLocal(now = Date.now()) {
  if (localBuckets.size < 500) return;
  for (const [key, bucket] of localBuckets) {
    if (now >= bucket.resetAt) localBuckets.delete(key);
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const key = `ratelimit:${opts.keyPrefix}:${clientKey(req)}`;
    const result = await this.check(key, opts);
    if (!result.ok) {
      throw new HttpException(
        { message: 'Rate limit exceeded', retryAfterSec: result.retryAfterSec },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
  private async check(
    key: string,
    opts: RateLimitOptions,
  ): Promise<
    | {
        ok: true;
      }
    | {
        ok: false;
        retryAfterSec: number;
      }
  > {
    const client = this.redis.getClient();
    if (!client) {
      pruneLocal();
      return checkLocal(key, opts);
    }
    const count = await client.incr(key);
    if (count === 1) {
      await client.pexpire(key, opts.windowMs);
    }
    if (count > opts.limit) {
      const ttlMs = await client.pttl(key);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)) };
    }
    return { ok: true };
  }
}
