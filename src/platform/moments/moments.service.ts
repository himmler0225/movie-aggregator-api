import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { MomentReaction } from '@prisma/client';
import { DanmakuCommentsRepository } from '../../database/repositories/danmaku-comments.repository';
import { MomentReactionsRepository } from '../../database/repositories/moment-reactions.repository';
import { AppLogger } from '../../shared/logger';
import type {
  HeatmapBucketView,
  HeatmapView,
  RecordReactionInput,
} from '../types';
import {
  DANMAKU_WEIGHT,
  HEATMAP_BUCKET_SECONDS,
  HOT_MOMENT_COUNT,
  HOT_MOMENT_MIN_GAP_SECONDS,
  isReactionEmoji,
  MAX_REACTION_TIME_SECONDS,
} from './moments.constants';

const FLUSH_INTERVAL_MS = 15_000;
const MAX_PENDING_KEYS = 10_000;
const HEATMAP_CACHE_MS = 60_000;
const MAX_CACHED_HEATMAPS = 500;

/**
 * Reactions from every room and solo viewer, bucketed by episode time.
 * Counts are batched in memory and flushed to the DB every few seconds, so
 * a burst of emoji costs one upsert per bucket instead of one per click.
 */
@Injectable()
export class MomentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = AppLogger.create(MomentsService.name);
  private readonly pending = new Map<string, MomentReaction>();
  private readonly heatmapCache = new Map<
    string,
    { expiresAt: number; view: HeatmapView }
  >();
  private flushTimer?: NodeJS.Timeout;
  private flushing?: Promise<void>;
  constructor(
    private readonly reactions: MomentReactionsRepository,
    private readonly danmaku: DanmakuCommentsRepository,
  ) {}
  onModuleInit() {
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }
  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
  /** Queues one reaction; false when the input is not a valid reaction. */
  record(input: RecordReactionInput): boolean {
    if (!isReactionEmoji(input.emoji)) return false;
    if (!input.movieSlug || !input.episodeName) return false;
    const time = input.time;
    if (!Number.isFinite(time) || time < 0) return false;
    if (time > MAX_REACTION_TIME_SECONDS) return false;
    const bucket = Math.floor(time / HEATMAP_BUCKET_SECONDS);
    this.add({
      movieSlug: input.movieSlug,
      episodeName: input.episodeName,
      bucket,
      emoji: input.emoji,
      count: 1,
    });
    return true;
  }
  flush(): Promise<void> {
    this.flushing ??= this.flushPending().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }
  async heatmap(movieSlug: string, episodeName: string): Promise<HeatmapView> {
    const key = JSON.stringify([movieSlug, episodeName]);
    const cached = this.heatmapCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.view;
    const [reactionRows, danmakuRows] = await Promise.all([
      this.reactions.findByEpisode(movieSlug, episodeName),
      this.danmaku.countByBucket(
        movieSlug,
        episodeName,
        HEATMAP_BUCKET_SECONDS,
      ),
    ]);
    const view = buildHeatmap(
      movieSlug,
      episodeName,
      reactionRows,
      danmakuRows,
    );
    if (this.heatmapCache.size >= MAX_CACHED_HEATMAPS) {
      const [oldest] = this.heatmapCache.keys();
      if (oldest !== undefined) this.heatmapCache.delete(oldest);
    }
    this.heatmapCache.set(key, {
      expiresAt: Date.now() + HEATMAP_CACHE_MS,
      view,
    });
    return view;
  }
  private add(row: MomentReaction) {
    const key = JSON.stringify([
      row.movieSlug,
      row.episodeName,
      row.bucket,
      row.emoji,
    ]);
    const existing = this.pending.get(key);
    if (existing) {
      existing.count += row.count;
      return;
    }
    if (this.pending.size >= MAX_PENDING_KEYS) return;
    this.pending.set(key, { ...row });
  }
  private async flushPending() {
    if (!this.pending.size) return;
    const rows = [...this.pending.values()];
    this.pending.clear();
    try {
      await this.reactions.incrementMany(rows);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Failed to flush ${rows.length} reaction bucket(s): ${error.message}`,
        error.stack,
      );
      // Keep the counts for the next attempt.
      for (const row of rows) this.add(row);
    }
  }
}

export function buildHeatmap(
  movieSlug: string,
  episodeName: string,
  reactionRows: Pick<MomentReaction, 'bucket' | 'emoji' | 'count'>[],
  danmakuRows: { bucket: number; count: number }[],
): HeatmapView {
  const byBucket = new Map<
    number,
    { reactions: number; danmaku: number; emojis: Map<string, number> }
  >();
  const entry = (bucket: number) => {
    let e = byBucket.get(bucket);
    if (!e) {
      e = { reactions: 0, danmaku: 0, emojis: new Map() };
      byBucket.set(bucket, e);
    }
    return e;
  };
  for (const row of reactionRows) {
    const e = entry(row.bucket);
    e.reactions += row.count;
    e.emojis.set(row.emoji, (e.emojis.get(row.emoji) ?? 0) + row.count);
  }
  for (const row of danmakuRows) entry(row.bucket).danmaku += row.count;
  const raw = [...byBucket.entries()].map(([bucket, e]) => {
    let top: string | null = null;
    let topCount = 0;
    for (const [emoji, count] of e.emojis) {
      if (count > topCount) [top, topCount] = [emoji, count];
    }
    return {
      start: bucket * HEATMAP_BUCKET_SECONDS,
      reactions: e.reactions,
      danmaku: e.danmaku,
      weight: e.reactions + e.danmaku * DANMAKU_WEIGHT,
      top_emoji: top,
    };
  });
  const max = Math.max(0, ...raw.map((b) => b.weight));
  const buckets: HeatmapBucketView[] = raw
    .filter((b) => b.weight > 0)
    .sort((a, b) => a.start - b.start)
    .map(({ weight, ...b }) => ({
      ...b,
      score: Math.round((weight / max) * 1000) / 1000,
    }));
  const hot: HeatmapBucketView[] = [];
  for (const b of [...buckets].sort((a, b) => b.score - a.score)) {
    if (hot.length >= HOT_MOMENT_COUNT) break;
    const tooClose = hot.some(
      (h) => Math.abs(h.start - b.start) < HOT_MOMENT_MIN_GAP_SECONDS,
    );
    if (!tooClose) hot.push(b);
  }
  return {
    movie_slug: movieSlug,
    episode_name: episodeName,
    bucket_seconds: HEATMAP_BUCKET_SECONDS,
    buckets,
    hot_moments: hot.sort((a, b) => a.start - b.start),
  };
}
