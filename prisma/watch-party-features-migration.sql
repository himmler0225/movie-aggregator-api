ALTER TABLE public.watch_rooms
  ADD COLUMN IF NOT EXISTS control_mode text NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS co_host_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wait_for_buffering boolean NOT NULL DEFAULT true;
ALTER TABLE public.watch_rooms
  ADD COLUMN IF NOT EXISTS episode_queue jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS auto_next boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS title text;
CREATE INDEX IF NOT EXISTS watch_rooms_public_idx
  ON public.watch_rooms (is_private, expires_at);
CREATE INDEX IF NOT EXISTS watch_rooms_scheduled_idx
  ON public.watch_rooms (scheduled_at);

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

CREATE TABLE IF NOT EXISTS public.moment_reactions (
  movie_slug text NOT NULL,
  episode_name text NOT NULL,
  bucket int NOT NULL,
  emoji text NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (movie_slug, episode_name, bucket, emoji)
);

CREATE TABLE IF NOT EXISTS public.room_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS room_reminders_user_idx
  ON public.room_reminders (user_id);
CREATE INDEX IF NOT EXISTS room_reminders_notified_idx
  ON public.room_reminders (notified_at);

NOTIFY pgrst, 'reload schema';
