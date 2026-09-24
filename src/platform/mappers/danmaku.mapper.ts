import type { DanmakuComment } from '@prisma/client';
import type { DanmakuView } from '../types';

export function mapDanmaku(d: DanmakuComment): DanmakuView {
  return {
    id: d.id,
    movie_slug: d.movieSlug,
    episode_name: d.episodeName,
    playback_time: d.playbackTime,
    user_id: d.userId,
    username: d.username,
    avatar_url: d.avatarUrl,
    content: d.content,
    created_at: d.createdAt.toISOString(),
  };
}
