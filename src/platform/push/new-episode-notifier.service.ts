import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SeriesEpisodeStateRepository } from '../../database/repositories/series-episode-state.repository';
import { PushSubscriptionsRepository } from '../../database/repositories/push-subscriptions.repository';
import { RedisService } from '../../infra/redis';
import { MoviesService } from '../../movies/movies.service';
import { AppLogger } from '../../shared/logger';
import type { MovieDetail } from '../../shared/types/movie.types';
import { PushService } from './push.service';

const TICK_MS = 20 * 60_000;
const FIRST_TICK_MS = 60_000;
/** Series checked per run; the oldest-checked go first. */
const MAX_SLUGS_PER_TICK = 300;
const FETCH_CONCURRENCY = 4;
/** Unfinished episodes watched within this window count as "following". */
const HISTORY_WINDOW_MS = 30 * 24 * 3600_000;
const LOCK_KEY = 'cf:job:new-episodes';
const SERIES_TYPES = new Set(['series', 'hoathinh', 'tvshows']);

/**
 * Every 20 minutes: for series that push-enabled users follow (favourites,
 * watchlists, unfinished history), compare the upstream `episode_current` with
 * the last value seen and push "new episode" to the followers when it changed.
 * The first sighting of a series only records its state (no notification).
 */
@Injectable()
export class NewEpisodeNotifierService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = AppLogger.create(NewEpisodeNotifierService.name);
  private timer?: NodeJS.Timeout;
  private firstTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly states: SeriesEpisodeStateRepository,
    private readonly subs: PushSubscriptionsRepository,
    private readonly movies: MoviesService,
    private readonly push: PushService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    if (!this.push.enabled) return;
    this.firstTimer = setTimeout(() => void this.tick(), FIRST_TICK_MS);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.firstTimer.unref();
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.firstTimer) clearTimeout(this.firstTimer);
  }

  async tick() {
    if (this.running || !(await this.acquireLock())) return;
    this.running = true;
    try {
      const followers = await this.followersBySlug();
      if (followers.size === 0) return;
      const notified = await this.checkSeries(followers);
      if (notified)
        this.logger.log(`New-episode pushes sent for ${notified} series`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `New-episode check failed: ${error.message}`,
        error.stack,
      );
    } finally {
      this.running = false;
    }
  }

  /** Only one instance runs the job when several share Redis. */
  private async acquireLock() {
    const client = this.redis.getClient();
    if (!client || client.status !== 'ready') return true;
    try {
      return (
        (await client.set(LOCK_KEY, '1', 'PX', TICK_MS - 60_000, 'NX')) === 'OK'
      );
    } catch {
      return true;
    }
  }

  async followersBySlug(): Promise<Map<string, Set<string>>> {
    const userIds = await this.subs.subscribedUserIds();
    const map = new Map<string, Set<string>>();
    if (userIds.length === 0) return map;
    const add = (slug: string, userId: string) => {
      const set = map.get(slug) ?? new Set<string>();
      set.add(userId);
      map.set(slug, set);
    };
    const [favorites, lists, history] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, movieSlug: true },
      }),
      this.prisma.userWatchlist.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, slugs: true },
      }),
      this.prisma.watchHistory.findMany({
        where: {
          userId: { in: userIds },
          completed: false,
          watchedAt: { gte: new Date(Date.now() - HISTORY_WINDOW_MS) },
        },
        select: { userId: true, movieSlug: true },
      }),
    ]);
    favorites.forEach((f) => add(f.movieSlug, f.userId));
    lists.forEach((l) => l.slugs.forEach((slug) => add(slug, l.userId)));
    history.forEach((h) => add(h.movieSlug, h.userId));
    return map;
  }

  async checkSeries(followers: Map<string, Set<string>>): Promise<number> {
    const slugs = [...followers.keys()];
    const known = new Map(
      (await this.states.findBySlugs(slugs)).map((s) => [s.movieSlug, s]),
    );
    // Never-seen series first, then the ones checked longest ago.
    const ordered = slugs
      .sort(
        (a, b) =>
          (known.get(a)?.checkedAt.getTime() ?? 0) -
          (known.get(b)?.checkedAt.getTime() ?? 0),
      )
      .slice(0, MAX_SLUGS_PER_TICK);

    let notified = 0;
    for (let i = 0; i < ordered.length; i += FETCH_CONCURRENCY) {
      const batch = ordered.slice(i, i + FETCH_CONCURRENCY);
      const results = await Promise.all(
        batch.map((slug) =>
          this.checkOne(
            slug,
            known.get(slug)?.episodeCurrent,
            followers.get(slug)!,
          ),
        ),
      );
      notified += results.filter(Boolean).length;
    }
    return notified;
  }

  private async checkOne(
    slug: string,
    previous: string | undefined,
    userIds: Set<string>,
  ): Promise<boolean> {
    let movie: MovieDetail;
    try {
      movie = (await this.movies.getMovieDetail(slug)).data.movie;
    } catch {
      return false; // upstream hiccup or removed movie: try again next run
    }
    if (movie.type && !SERIES_TYPES.has(movie.type)) return false;
    const current = movie.episode_current?.trim();
    if (!current) return false;
    await this.states.save(slug, current);
    if (!previous || previous === current) return false;
    await this.push.sendToUsers([...userIds], {
      title: movie.name,
      body: `Đã có ${current}`,
      url: `/movie/${slug}`,
      icon: movie.thumb_url || movie.poster_url || undefined,
      tag: `episode:${slug}`,
    });
    return true;
  }
}
