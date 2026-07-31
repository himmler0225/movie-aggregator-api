import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PageViewsRepository } from '../../../database/repositories/page-views.repository';
import { ProfilesRepository } from '../../../database/repositories/profiles.repository';
import { WatchEventsRepository } from '../../../database/repositories/watch-events.repository';
import { WatchRoomsRepository } from '../../../database/repositories/watch-rooms.repository';
import { QUERY_LIMITS } from '../../../shared/constants';
import type {
  DashboardLinePoint,
  DashboardStats,
  TopKeywordStat,
  TopMovieStat,
} from '../../types';
import { pctChange } from '../../utils';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesRepository,
    private readonly pageViews: PageViewsRepository,
    private readonly watchEvents: WatchEventsRepository,
    private readonly watchRooms: WatchRoomsRepository,
  ) {}
  async dashboardStats(
    from: string,
    prevFrom: string,
  ): Promise<DashboardStats> {
    const [
      totalUsers,
      pageViewsNow,
      pageViewsPrev,
      watchNow,
      watchPrev,
      roomsNow,
      roomsPrev,
      usersNow,
      usersPrev,
    ] = await Promise.all([
      this.profiles.countSince('createdAt', null),
      this.pageViews.countSince('viewedAt', from),
      this.pageViews.countBetween('viewedAt', prevFrom, from),
      this.watchEvents.countSince('startedAt', from),
      this.watchEvents.countBetween('startedAt', prevFrom, from),
      this.watchRooms.countSince('createdAt', from),
      this.watchRooms.countBetween('createdAt', prevFrom, from),
      this.profiles.countSince('createdAt', from),
      this.profiles.countBetween('createdAt', prevFrom, from),
    ]);
    return {
      totalUsers,
      pageViews: {
        now: pageViewsNow,
        change: pctChange(pageViewsNow, pageViewsPrev),
      },
      watch: { now: watchNow, change: pctChange(watchNow, watchPrev) },
      rooms: { now: roomsNow, change: pctChange(roomsNow, roomsPrev) },
      users: { change: pctChange(usersNow, usersPrev) },
    };
  }
  async dashboardLineData(
    from: string,
    days: number,
  ): Promise<DashboardLinePoint[]> {
    const fromDate = new Date(from);
    const [viewRows, watchRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          day: string;
          count: number;
        }>
      >`
        SELECT to_char(viewed_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM page_views WHERE viewed_at >= ${fromDate} GROUP BY day
      `,
      this.prisma.$queryRaw<
        Array<{
          day: string;
          count: number;
        }>
      >`
        SELECT to_char(started_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM watch_events WHERE started_at >= ${fromDate} GROUP BY day
      `,
    ]);
    const buckets: Record<string, DashboardLinePoint> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key.slice(5), views: 0, watches: 0 };
    }
    for (const r of viewRows) {
      if (buckets[r.day]) buckets[r.day].views = r.count;
    }
    for (const r of watchRows) {
      if (buckets[r.day]) buckets[r.day].watches = r.count;
    }
    return Object.values(buckets);
  }
  async pageTypeDistribution(from: string) {
    const rows = await this.prisma.pageView.groupBy({
      by: ['pageType'],
      where: { viewedAt: { gte: new Date(from) } },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      const name = r.pageType ?? 'unknown';
      counts.set(name, (counts.get(name) ?? 0) + r._count._all);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }
  async topMovies(
    from: string,
    limit: number = QUERY_LIMITS.adminTopN,
  ): Promise<TopMovieStat[]> {
    const grouped = await this.prisma.watchEvent.groupBy({
      by: ['movieSlug'],
      where: { startedAt: { gte: new Date(from) } },
      _count: { _all: true },
      _sum: { watchDurationSec: true },
      orderBy: { _count: { movieSlug: 'desc' } },
      take: limit,
    });
    if (!grouped.length) return [];
    const names = await this.prisma.watchEvent.findMany({
      where: { movieSlug: { in: grouped.map((g) => g.movieSlug) } },
      select: { movieSlug: true, movieName: true },
      distinct: ['movieSlug'],
    });
    const nameBySlug = new Map(names.map((n) => [n.movieSlug, n.movieName]));
    return grouped.map((g) => {
      const views = g._count._all;
      const total = g._sum.watchDurationSec ?? 0;
      return {
        slug: g.movieSlug,
        name: nameBySlug.get(g.movieSlug) ?? g.movieSlug,
        views,
        total,
        avg: views ? total / views : 0,
      };
    });
  }
  async topKeywords(
    from: string,
    limit: number = QUERY_LIMITS.adminTopN,
  ): Promise<TopKeywordStat[]> {
    const grouped = await this.prisma.searchLog.groupBy({
      by: ['keyword'],
      where: { searchedAt: { gte: new Date(from) } },
      _count: { _all: true, clickedSlug: true },
      orderBy: { _count: { keyword: 'desc' } },
      take: limit,
    });
    return grouped.map((r) => ({
      keyword: r.keyword,
      searches: r._count._all,
      clicks: r._count.clickedSlug,
      ctr: r._count._all ? r._count.clickedSlug / r._count._all : 0,
    }));
  }
}
