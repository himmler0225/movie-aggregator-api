import type { WatchRoom } from '@prisma/client';
import type { WatchRoomView } from '../types';

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
    created_at: r.createdAt.toISOString(),
    expires_at: r.expiresAt.toISOString(),
  };
}
