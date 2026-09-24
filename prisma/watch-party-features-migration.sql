ALTER TABLE public.watch_rooms
  ADD COLUMN IF NOT EXISTS control_mode text NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS co_host_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wait_for_buffering boolean NOT NULL DEFAULT true;

ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS playback_time double precision;

CREATE TABLE IF NOT EXISTS public.danmaku_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_slug text NOT NULL,
  episode_name text NOT NULL,
  playback_time double precision NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  content text NOT NULL,
  room_id uuid REFERENCES public.watch_rooms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS danmaku_comments_episode_time_idx
  ON public.danmaku_comments (movie_slug, episode_name, playback_time);

NOTIFY pgrst, 'reload schema';
