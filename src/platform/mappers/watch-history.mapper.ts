import type { WatchHistory } from '@prisma/client';
import type { WatchHistoryView } from '../types';

export function mapWatchHistory(
  h: Pick<
    WatchHistory,
    | 'id'
    | 'userId'
    | 'movieSlug'
    | 'movieName'
    | 'thumbUrl'
    | 'episodeName'
    | 'episodeIndex'
    | 'serverIndex'
    | 'progressSec'
    | 'durationSec'
    | 'completed'
    | 'watchedAt'
  >,
): WatchHistoryView {
  return {
    id: h.id,
    user_id: h.userId,
    movie_slug: h.movieSlug,
    movie_name: h.movieName,
    thumb_url: h.thumbUrl,
    episode_name: h.episodeName,
    episode_index: h.episodeIndex,
    server_index: h.serverIndex,
    progress_sec: h.progressSec,
    duration_sec: h.durationSec,
    completed: h.completed,
    watched_at: h.watchedAt.toISOString(),
  };
}
