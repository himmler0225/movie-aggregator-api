import { Injectable } from '@nestjs/common';
import * as webpush from 'web-push';
import { AppConfigService } from '../../config';
import { PushSubscriptionsRepository } from '../../database/repositories/push-subscriptions.repository';
import { AppLogger } from '../../shared/logger';

export interface PushPayload {
  title: string;
  body: string;
  /** Path opened when the notification is tapped. */
  url: string;
  icon?: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
}

const SEND_CONCURRENCY = 8;

@Injectable()
export class PushService {
  private readonly logger = AppLogger.create(PushService.name);
  private readonly vapid: {
    publicKey: string;
    privateKey: string;
    subject: string;
  } | null;

  constructor(
    private readonly subs: PushSubscriptionsRepository,
    appConfig: AppConfigService,
  ) {
    this.vapid = appConfig.vapid;
    if (!this.vapid) {
      this.logger.warn(
        'VAPID keys not set — web push notifications are disabled.',
      );
    }
  }

  get enabled() {
    return this.vapid !== null;
  }

  get publicKey() {
    return this.vapid?.publicKey ?? null;
  }

  subscribe(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ) {
    return this.subs.upsertForUser(userId, sub);
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.subs.deleteMany({ userId, endpoint });
  }

  /** Sends to every device of these users; returns how many deliveries succeeded. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.vapid || userIds.length === 0) return 0;
    const targets = await this.subs.findByUsers([...new Set(userIds)]);
    let delivered = 0;
    for (let i = 0; i < targets.length; i += SEND_CONCURRENCY) {
      const batch = targets.slice(i, i + SEND_CONCURRENCY);
      const results = await Promise.all(
        batch.map((t) => this.sendOne(t, payload)),
      );
      delivered += results.filter(Boolean).length;
    }
    return delivered;
  }

  private async sendOne(
    target: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<boolean> {
    if (!this.vapid) return false;
    try {
      await webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        JSON.stringify(payload),
        {
          TTL: 12 * 3600,
          urgency: 'normal',
          vapidDetails: this.vapid,
        },
      );
      await this.subs.update({ id: target.id }, { lastSuccessAt: new Date() });
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410: the browser dropped this subscription (uninstalled, permission revoked).
      if (status === 404 || status === 410) {
        await this.subs.deleteMany({ id: target.id });
      } else {
        this.logger.warn(
          `Push failed (${status ?? 'network'}): ${(error as Error).message}`,
        );
      }
      return false;
    }
  }
}
