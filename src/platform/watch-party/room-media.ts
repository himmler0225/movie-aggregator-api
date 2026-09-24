import type { Prisma, WatchRoom } from '@prisma/client';
import type { EpisodeQueueItem, RoomMediaMsg, RoomMediaState } from '../types';

export const MAX_QUEUE_LENGTH = 50;
export const MAX_EPISODE_NAME_LENGTH = 200;

/** Reads the stored queue defensively; rows written by hand may be malformed. */
export function parseEpisodeQueue(
  raw: Prisma.JsonValue | undefined,
): EpisodeQueueItem[] {
  if (!Array.isArray(raw)) return [];
  const items: EpisodeQueueItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const name = entry.episode_name;
    const server = entry.server_index;
    if (typeof name !== 'string' || !name) continue;
    items.push({
      episode_name: name,
      server_index:
        typeof server === 'number' && Number.isInteger(server) && server >= 0
          ? server
          : 0,
    });
  }
  return items.slice(0, MAX_QUEUE_LENGTH);
}

export function toMediaState(
  room: Pick<
    WatchRoom,
    'movieSlug' | 'episodeName' | 'serverIndex' | 'episodeQueue' | 'autoNext'
  >,
): RoomMediaState {
  return {
    movieSlug: room.movieSlug,
    episodeName: room.episodeName,
    serverIndex: room.serverIndex,
    queue: parseEpisodeQueue(room.episodeQueue),
    autoNext: room.autoNext ?? true,
  };
}

export function toMediaMsg(media: RoomMediaState): RoomMediaMsg {
  return {
    episode_name: media.episodeName,
    server_index: media.serverIndex,
    episode_queue: media.queue,
    auto_next: media.autoNext,
  };
}

/** Drops the first queue entry for this episode, if any. */
export function removeFromQueue(
  queue: EpisodeQueueItem[],
  item: EpisodeQueueItem,
): EpisodeQueueItem[] {
  const index = queue.findIndex(
    (q) =>
      q.episode_name === item.episode_name &&
      q.server_index === item.server_index,
  );
  return index === -1
    ? queue
    : [...queue.slice(0, index), ...queue.slice(index + 1)];
}
