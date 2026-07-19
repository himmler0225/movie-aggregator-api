export interface WatchHistoryUpsertInput {
  movie_slug: string;
  movie_name: string;
  thumb_url?: string | null;
  episode_name: string;
  episode_index?: number;
  server_index?: number;
  progress_sec: number;
  duration_sec: number;
  completed?: boolean;
  watched_at?: string;
}

export interface WatchHistoryView {
  id: string;
  user_id: string;
  movie_slug: string;
  movie_name: string;
  thumb_url: string | null;
  episode_name: string;
  episode_index: number | null;
  server_index: number | null;
  progress_sec: number;
  duration_sec: number;
  completed: boolean;
  watched_at: string;
}
