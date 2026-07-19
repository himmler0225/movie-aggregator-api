import { Injectable } from '@nestjs/common';
import { WatchHistoryRepository } from '../../database/repositories/watch-history.repository';
import { mapWatchHistory } from '../mappers';

import type { WatchHistoryUpsertInput } from '../types';

@Injectable()
export class WatchHistoryService {
  constructor(private readonly history: WatchHistoryRepository) {}

  async list(userId: string) {
    const rows = await this.history.findByUserId(userId);
    return rows.map(mapWatchHistory);
  }

  async upsert(userId: string, item: WatchHistoryUpsertInput) {
    const completed =
      item.completed ??
      (item.duration_sec > 0 && item.progress_sec / item.duration_sec >= 0.95);
    await this.history.upsert(
      {
        userId_movieSlug_episodeName: {
          userId,
          movieSlug: item.movie_slug,
          episodeName: item.episode_name,
        },
      },
      {
        userId,
        movieSlug: item.movie_slug,
        movieName: item.movie_name,
        thumbUrl: item.thumb_url ?? null,
        episodeName: item.episode_name,
        episodeIndex: item.episode_index ?? null,
        serverIndex: item.server_index ?? 0,
        progressSec: item.progress_sec,
        durationSec: item.duration_sec,
        completed,
        watchedAt: item.watched_at ? new Date(item.watched_at) : new Date(),
      },
      {
        movieName: item.movie_name,
        thumbUrl: item.thumb_url ?? null,
        episodeIndex: item.episode_index ?? null,
        serverIndex: item.server_index ?? 0,
        progressSec: item.progress_sec,
        durationSec: item.duration_sec,
        completed,
        watchedAt: item.watched_at ? new Date(item.watched_at) : new Date(),
      },
    );
  }

  async upsertMany(userId: string, items: WatchHistoryUpsertInput[]) {
    for (const item of items) {
      await this.upsert(userId, item);
    }
  }

  async remove(userId: string, movieSlug: string, episodeName: string) {
    await this.history.deleteItem(userId, movieSlug, episodeName);
    return { ok: true };
  }

  async clear(userId: string) {
    await this.history.clearByUserId(userId);
    return { ok: true };
  }
}
