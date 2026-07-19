import { Injectable } from '@nestjs/common';
import { CommentsRepository } from '../../database/repositories/comments.repository';
import { PageViewsRepository } from '../../database/repositories/page-views.repository';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { RoomMembersRepository } from '../../database/repositories/room-members.repository';
import { RoomMessagesRepository } from '../../database/repositories/room-messages.repository';
import { SearchLogsRepository } from '../../database/repositories/search-logs.repository';
import { WatchEventsRepository } from '../../database/repositories/watch-events.repository';
import { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import { CommentsService } from '../comments/comments.service';
import { mapProfile } from '../mappers';
import type {
  AdminRoomRow,
  CommentStats,
  DashboardLinePoint,
  DashboardStats,
  ListCommentsOptions,
  ListUsersOptions,
  TopKeywordStat,
  TopMovieStat,
} from '../types';
import { pctChange } from '../utils';

@Injectable()
export class AdminService {
  constructor(
    private readonly profiles: ProfilesRepository,
    private readonly pageViews: PageViewsRepository,
    private readonly watchEvents: WatchEventsRepository,
    private readonly watchRooms: WatchRoomsRepository,
    private readonly roomMembers: RoomMembersRepository,
    private readonly roomMessages: RoomMessagesRepository,
    private readonly comments: CommentsRepository,
    private readonly searchLogs: SearchLogsRepository,
    private readonly commentsService: CommentsService,
  ) {}

  async dashboardStats(from: string, prevFrom: string): Promise<DashboardStats> {
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
      pageViews: { now: pageViewsNow, change: pctChange(pageViewsNow, pageViewsPrev) },
      watch: { now: watchNow, change: pctChange(watchNow, watchPrev) },
      rooms: { now: roomsNow, change: pctChange(roomsNow, roomsPrev) },
      users: { change: pctChange(usersNow, usersPrev) },
    };
  }

  async dashboardLineData(from: string, days: number): Promise<DashboardLinePoint[]> {
    const [pv, we] = await Promise.all([
      this.pageViews.findMany({ where: { viewedAt: { gte: new Date(from) } } }),
      this.watchEvents.findMany({ where: { startedAt: { gte: new Date(from) } } }),
    ]);

    const buckets: Record<string, DashboardLinePoint> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key.slice(5), views: 0, watches: 0 };
    }

    for (const r of pv) {
      const k = r.viewedAt.toISOString().slice(0, 10);
      if (buckets[k]) buckets[k].views++;
    }
    for (const r of we) {
      const k = r.startedAt.toISOString().slice(0, 10);
      if (buckets[k]) buckets[k].watches++;
    }

    return Object.values(buckets);
  }

  async pageTypeDistribution(from: string) {
    const rows = await this.pageViews.findMany({
      where: { viewedAt: { gte: new Date(from) } },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const k = r.pageType ?? 'unknown';
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }

  async topMovies(from: string, limit = 10): Promise<TopMovieStat[]> {
    const rows = await this.watchEvents.findMany({
      where: { startedAt: { gte: new Date(from) } },
      take: 5000,
    });
    const map = new Map<string, Omit<TopMovieStat, 'avg'>>();
    for (const r of rows) {
      const ent = map.get(r.movieSlug) ?? {
        slug: r.movieSlug,
        name: r.movieName ?? r.movieSlug,
        views: 0,
        total: 0,
      };
      ent.views++;
      ent.total += r.watchDurationSec ?? 0;
      map.set(r.movieSlug, ent);
    }
    return [...map.values()]
      .map((e) => ({ ...e, avg: e.views ? e.total / e.views : 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  async topKeywords(from: string, limit = 10): Promise<TopKeywordStat[]> {
    const rows = await this.searchLogs.findMany({
      where: { searchedAt: { gte: new Date(from) } },
      take: 5000,
    });
    const map = new Map<string, Omit<TopKeywordStat, 'ctr'>>();
    for (const r of rows) {
      const ent = map.get(r.keyword) ?? { keyword: r.keyword, searches: 0, clicks: 0 };
      ent.searches++;
      if (r.clickedSlug) ent.clicks++;
      map.set(r.keyword, ent);
    }
    return [...map.values()]
      .map((e) => ({ ...e, ctr: e.searches ? e.clicks / e.searches : 0 }))
      .sort((a, b) => b.searches - a.searches)
      .slice(0, limit);
  }

  async listUsers(opts: ListUsersOptions) {
    const where: Record<string, unknown> = {};
    if (opts.query) {
      where.OR = [
        { fullName: { contains: opts.query, mode: 'insensitive' } },
        { email: { contains: opts.query, mode: 'insensitive' } },
      ];
    }
    if (opts.filter === 'admin') where.role = 'admin';
    else if (opts.filter === 'premium') where.role = 'premium';
    else if (opts.filter === 'free') where.role = 'user';

    const orderBy =
      opts.sort === 'new' ? { createdAt: 'desc' as const } : { fullName: 'asc' as const };

    const result = await this.profiles.paginate({
      where,
      orderBy,
      page: opts.page + 1,
      pageSize: opts.pageSize,
    });

    return {
      rows: result.data.map(mapProfile),
      total: result.total,
    };
  }

  async updateUserRole(userId: string, role: string) {
    await this.profiles.update({ id: userId }, { role });
    return { ok: true };
  }

  async recentUsers(limit = 8) {
    const rows = await this.profiles.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapProfile);
  }

  async commentStats(): Promise<CommentStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [today, week, month, top] = await Promise.all([
      this.comments.count({ createdAt: { gte: todayStart } }),
      this.comments.count({ createdAt: { gte: weekAgo } }),
      this.comments.count({ createdAt: { gte: monthAgo } }),
      this.comments.findMany({ take: 5000, select: { movieSlug: true } }),
    ]);

    const counts = new Map<string, number>();
    for (const c of top) {
      counts.set(c.movieSlug, (counts.get(c.movieSlug) ?? 0) + 1);
    }
    const topMovie = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { today, week, month, topMovie };
  }

  async listComments(opts: ListCommentsOptions) {
    const where: Record<string, unknown> = {};
    if (opts.query) where.content = { contains: opts.query, mode: 'insensitive' };
    if (opts.movie) where.movieSlug = opts.movie;

    const orderBy =
      opts.sort === 'likes' ? { likes: 'desc' as const } : { createdAt: 'desc' as const };

    const result = await this.comments.paginate({
      where,
      orderBy,
      page: opts.page + 1,
      pageSize: opts.pageSize,
    });

    return {
      rows: await this.commentsService.mapCommentRows(result.data),
      total: result.total,
    };
  }

  async deleteComments(ids: string[]) {
    await this.comments.deleteMany({ id: { in: ids } });
    return { ok: true };
  }

  async recentComments(limit = 5) {
    const rows = await this.comments.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return this.commentsService.mapCommentRows(rows);
  }

  async roomStats() {
    const now = new Date();
    const [active, members, msgs] = await Promise.all([
      this.watchRooms.count({ expiresAt: { gt: now } }),
      this.roomMembers.count(),
      this.roomMessages.count(),
    ]);
    return { active, members, msgs };
  }

  async listRooms(showHistory: boolean): Promise<AdminRoomRow[]> {
    const where = showHistory ? undefined : { expiresAt: { gt: new Date() } };
    const rows = await this.watchRooms.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      host_id: r.hostId,
      movie_name: r.movieName,
      movie_slug: r.movieSlug,
      created_at: r.createdAt.toISOString(),
      expires_at: r.expiresAt.toISOString(),
    }));
  }

  async deleteRoom(roomId: string) {
    await this.watchRooms.delete({ id: roomId });
    return { ok: true };
  }
}
