import { Injectable } from '@nestjs/common';
import { PushSubscription } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PushSubscriptionsRepository extends BaseRepository<PushSubscription> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.pushSubscription);
  }
  /** A browser endpoint belongs to whoever subscribed with it last. */
  upsertForUser(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, ...sub },
      update: {
        userId,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: sub.userAgent,
      },
    });
  }
  findByUsers(userIds: string[]) {
    return this.findMany({ where: { userId: { in: userIds } } });
  }
  /** Users who can receive pushes at all. */
  async subscribedUserIds(): Promise<string[]> {
    const rows = await this.prisma.pushSubscription.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
}
