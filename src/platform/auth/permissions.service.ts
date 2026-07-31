import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RolePermissionsRepository } from '../../database/repositories/role-permissions.repository';
import { RedisService } from '../../infra/redis';
import { AppLogger } from '../../shared/logger';

const REDIS_RELOAD_CHANNEL = 'permissions:reload';

const PERIODIC_REFRESH_MS = 5 * 60000;

@Injectable()
export class PermissionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = AppLogger.create(PermissionsService.name);
  private cache = new Map<string, Set<string>>();
  private subscriber: Redis | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  constructor(
    private readonly rolePermissions: RolePermissionsRepository,
    private readonly redis: RedisService,
  ) {}
  async onModuleInit() {
    await this.reloadLocal();
    this.subscriber = this.redis.createSubscriber();
    if (this.subscriber) {
      await this.subscriber.subscribe(REDIS_RELOAD_CHANNEL);
      this.subscriber.on('message', (channel) => {
        if (channel === REDIS_RELOAD_CHANNEL) void this.reloadLocal();
      });
    }
    this.refreshTimer = setInterval(
      () => void this.reloadLocal(),
      PERIODIC_REFRESH_MS,
    );
    this.refreshTimer.unref();
  }
  async onModuleDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    await this.subscriber?.quit();
  }
  async reload() {
    await this.reloadLocal();
    const client = this.redis.getClient();
    if (client) await client.publish(REDIS_RELOAD_CHANNEL, '1');
  }
  private async reloadLocal() {
    const rows = await this.rolePermissions.findMany({});
    const next = new Map<string, Set<string>>();
    for (const row of rows) {
      const scopes = next.get(row.role) ?? new Set<string>();
      scopes.add(row.scope);
      next.set(row.role, scopes);
    }
    this.cache = next;
    this.logger.log(
      `Loaded ${rows.length} role permission(s) for ${next.size} role(s)`,
    );
  }
  has(role: string, scope: string): boolean {
    return this.cache.get(role)?.has(scope) ?? false;
  }
}
