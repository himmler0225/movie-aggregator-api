import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RoomRemindersRepository } from '../../database/repositories/room-reminders.repository';
import { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import { AppLogger } from '../../shared/logger';
import { mapWatchRoom } from '../mappers';
import { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyStore } from './watch-party.store';

const TICK_MS = 30_000;
/** Reminders go out this long before the start. */
export const REMIND_BEFORE_MS = 5 * 60_000;
/** Reminders missed by a late tick or a restart are still sent this long after the start. */
const LATE_REMINDER_MS = 10 * 60_000;
/** `room:starting` fires for rooms whose start fell within this window. */
const STARTING_WINDOW_MS = 2 * 60_000;
const BATCH_SIZE = 500;

/**
 * Sends `reminder:due` to people who asked to be reminded and
 * `room:starting` to rooms whose scheduled time has come. Safe to run on
 * several instances: each reminder and start is claimed once.
 */
@Injectable()
export class WatchPartySchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = AppLogger.create(WatchPartySchedulerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly rooms: WatchRoomsRepository,
    private readonly reminders: RoomRemindersRepository,
    private readonly gateway: WatchPartyGateway,
    private readonly store: WatchPartyStore,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendDueReminders(now);
      await this.announceStarts(now);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Scheduler tick failed: ${error.message}`, error.stack);
    } finally {
      this.running = false;
    }
  }
  private async sendDueReminders(now: Date) {
    const due = await this.reminders.findDue(
      new Date(now.getTime() - LATE_REMINDER_MS),
      new Date(now.getTime() + REMIND_BEFORE_MS),
      BATCH_SIZE,
    );
    for (const reminder of due) {
      if (!(await this.reminders.claim(reminder.id, now))) continue;
      const startsAt = reminder.room.scheduledAt?.getTime() ?? now.getTime();
      this.gateway.emitToUser(reminder.userId, 'reminder:due', {
        room: mapWatchRoom(reminder.room),
        starts_in_seconds: Math.max(
          0,
          Math.round((startsAt - now.getTime()) / 1000),
        ),
        server_time: now.toISOString(),
      });
    }
  }
  private async announceStarts(now: Date) {
    const starting = await this.rooms.findMany({
      where: {
        scheduledAt: {
          gt: new Date(now.getTime() - STARTING_WINDOW_MS),
          lte: now,
        },
      },
      take: BATCH_SIZE,
    });
    for (const room of starting) {
      const claimed = await this.store.claimOnce(
        `starting:${room.id}`,
        (STARTING_WINDOW_MS * 2) / 1000,
      );
      if (!claimed) continue;
      this.gateway.emitRoomStarting(room.code, {
        scheduled_at: room.scheduledAt?.toISOString() ?? null,
        server_time: now.toISOString(),
      });
    }
  }
}
