import type { WatchRoom } from '@prisma/client';
import type { WatchRoomView } from '../types';
import { parseEpisodeQueue } from '../watch-party/room-media';

export function mapWatchRoom(
  r: Pick<
    WatchRoom,
    | 'id'
    | 'code'
    | 'hostId'
    | 'movieSlug'
    | 'movieName'
    | 'thumbUrl'
    | 'episodeName'
    | 'serverIndex'
    | 'playbackTime'
    | 'isPlaying'
    | 'isPrivate'
    | 'pin'
    | 'controlMode'
    | 'coHostIds'
    | 'waitForBuffering'
    | 'episodeQueue'
    | 'autoNext'
    | 'scheduledAt'
    | 'title'
    | 'createdAt'
    | 'expiresAt'
  >,
): WatchRoomView {
  return {
    id: r.id,
    code: r.code,
    host_id: r.hostId,
    movie_slug: r.movieSlug,
    movie_name: r.movieName,
    thumb_url: r.thumbUrl,
    episode_name: r.episodeName,
    server_index: r.serverIndex,
    playback_time: r.playbackTime,
    is_playing: r.isPlaying,
    is_private: r.isPrivate,
    has_pin: !!r.pin,
    control_mode: r.controlMode === 'everyone' ? 'everyone' : 'host',
    co_host_ids: r.coHostIds,
    wait_for_buffering: r.waitForBuffering,
    episode_queue: parseEpisodeQueue(r.episodeQueue),
    auto_next: r.autoNext,
    scheduled_at: r.scheduledAt?.toISOString() ?? null,
    title: r.title,
    created_at: r.createdAt.toISOString(),
    expires_at: r.expiresAt.toISOString(),
  };
}
