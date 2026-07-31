import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RoomMembersRepository } from '../../../database/repositories/room-members.repository';
import { RoomMessagesRepository } from '../../../database/repositories/room-messages.repository';
import { WatchEventsRepository } from '../../../database/repositories/watch-events.repository';
import { WatchRoomsRepository } from '../../../database/repositories/watch-rooms.repository';

const SEARCH_TOP_LIMIT = 20;

const SEARCH_NO_RESULTS_LIMIT = 30;

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly watchEvents: WatchEventsRepository,
    private readonly watchRooms: WatchRoomsRepository,
    private readonly roomMembers: RoomMembersRepository,
    private readonly roomMessages: RoomMessagesRepository,
  ) {}
  async searchAnalytics(from: string) {
    const fromDate = new Date(from);
    const [top, noResults] = await Promise.all([
      this.prisma.searchLog.groupBy({
        by: ['keyword'],
        where: { searchedAt: { gte: fromDate } },
        _count: { _all: true, clickedSlug: true },
        _sum: { resultsCount: true },
        orderBy: { _count: { keyword: 'desc' } },
        take: SEARCH_TOP_LIMIT,
      }),
      this.prisma.searchLog.groupBy({
        by: ['keyword'],
        where: {
          searchedAt: { gte: fromDate },
          OR: [{ resultsCount: 0 }, { resultsCount: null }],
        },
        _count: { _all: true },
        orderBy: { _count: { keyword: 'desc' } },
        take: SEARCH_NO_RESULTS_LIMIT,
      }),
    ]);
    return {
      top: top.map((r) => ({
        keyword: r.keyword,
        searches: r._count._all,
        avgResults: r._count._all
          ? Math.round(((r._sum.resultsCount ?? 0) / r._count._all) * 10) / 10
          : 0,
        ctr: r._count._all ? r._count.clickedSlug / r._count._all : 0,
      })),
      noResults: noResults.map((r) => ({
        keyword: r.keyword,
        searches: r._count._all,
      })),
    };
  }
  async hourlyWatchViews(from: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        hour: number;
        views: number;
      }>
    >`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS views
      FROM watch_events
      WHERE started_at >= ${new Date(from)}
      GROUP BY hour
    `;
    const byHour = new Map(rows.map((r) => [r.hour, r.views]));
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}h`,
      views: byHour.get(h) ?? 0,
    }));
    const peak = hours.reduce(
      (best, cur) => (cur.views > best.views ? cur : best),
      hours[0],
    );
    return { hours, peak };
  }
  async roomAnalytics(from: string) {
    const fromDate = new Date(from);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const roomWhere = { createdAt: { gte: fromDate } };
    const [roomCount, today, memberCount, msgCount, durationRows, dayRows] =
      await Promise.all([
        this.watchRooms.count(roomWhere),
        this.watchRooms.count({ createdAt: { gte: todayStart } }),
        this.roomMembers.count({ room: roomWhere }),
        this.roomMessages.count({ room: roomWhere }),
        this.prisma.$queryRaw<
          Array<{
            avg_minutes: number | null;
          }>
        >`
          SELECT AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 60)::float8 AS avg_minutes
          FROM watch_rooms WHERE created_at >= ${fromDate}
        `,
        this.prisma.$queryRaw<
          Array<{
            day: string;
            value: number;
          }>
        >`
          SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS value
          FROM watch_rooms WHERE created_at >= ${fromDate}
          GROUP BY day ORDER BY day
        `,
      ]);
    const denom = roomCount || 1;
    const avgDuration = Math.round(durationRows[0]?.avg_minutes ?? 0);
    const days = dayRows.map((r) => ({
      date: r.day.slice(5),
      value: r.value,
    }));
    return {
      today,
      avgMembers: Math.round((memberCount / denom) * 10) / 10,
      avgMsgs: Math.round((msgCount / denom) * 10) / 10,
      avgDuration,
      days,
    };
  }
  async langQualityDistribution(from: string) {
    const fromDate = new Date(from);
    const [langRows, qualityRows] = await Promise.all([
      this.prisma.watchEvent.groupBy({
        by: ['lang'],
        where: { startedAt: { gte: fromDate } },
        _count: { _all: true },
      }),
      this.prisma.watchEvent.groupBy({
        by: ['quality'],
        where: { startedAt: { gte: fromDate } },
        _count: { _all: true },
      }),
    ]);
    const langCounts = new Map<string, number>();
    for (const r of langRows) {
      const name = r.lang?.trim() || 'unknown';
      langCounts.set(name, (langCounts.get(name) ?? 0) + r._count._all);
    }
    const qualityCounts = new Map<string, number>();
    for (const r of qualityRows) {
      const name = r.quality?.trim() || 'unknown';
      qualityCounts.set(name, (qualityCounts.get(name) ?? 0) + r._count._all);
    }
    return {
      lang: [...langCounts.entries()].map(([name, value]) => ({ name, value })),
      quality: [...qualityCounts.entries()].map(([name, value]) => ({
        name,
        value,
      })),
    };
  }
  async movieWatchEvents(slug: string, from: string) {
    const rows = await this.watchEvents.findByMovieSlug(slug, new Date(from));
    return rows.map((r) => ({
      started_at: r.startedAt.toISOString(),
      episode_name: r.episodeName,
      server_name: r.serverName,
      username: r.username,
      avatar_url: r.avatarUrl,
    }));
  }
}
