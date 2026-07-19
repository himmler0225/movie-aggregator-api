-- KK-Flix platform tables (idempotent)
-- Chạy: yarn prisma:setup

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  movie_name text NOT NULL,
  thumb_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_slug)
);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id);

CREATE TABLE IF NOT EXISTS public.movie_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  content text NOT NULL,
  likes int NOT NULL DEFAULT 0,
  is_spoiler boolean NOT NULL DEFAULT false,
  episode_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movie_comments_movie_episode_idx
  ON public.movie_comments (movie_slug, episode_name);

CREATE TABLE IF NOT EXISTS public.movie_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  score int NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_slug)
);
CREATE INDEX IF NOT EXISTS movie_ratings_slug_idx ON public.movie_ratings (movie_slug);

CREATE TABLE IF NOT EXISTS public.watch_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  movie_name text NOT NULL,
  thumb_url text,
  episode_name text NOT NULL,
  episode_index int,
  server_index int NOT NULL DEFAULT 0,
  progress_sec int NOT NULL DEFAULT 0,
  duration_sec int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_slug, episode_name)
);
ALTER TABLE public.watch_history
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS watch_history_user_watched_idx
  ON public.watch_history (user_id, watched_at DESC);

CREATE TABLE IF NOT EXISTS public.user_watchlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_key text NOT NULL,
  name text NOT NULL,
  slugs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, list_key)
);
CREATE INDEX IF NOT EXISTS user_watchlists_user_idx ON public.user_watchlists (user_id);

CREATE TABLE IF NOT EXISTS public.watch_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  movie_name text,
  thumb_url text,
  episode_name text,
  server_index int NOT NULL DEFAULT 0,
  playback_time double precision NOT NULL DEFAULT 0,
  is_playing boolean NOT NULL DEFAULT false,
  is_private boolean NOT NULL DEFAULT false,
  pin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS watch_rooms_code_idx ON public.watch_rooms (code);

CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS room_members_room_idx ON public.room_members (room_id);

CREATE TABLE IF NOT EXISTS public.room_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'message',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_messages_room_created_idx
  ON public.room_messages (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_type text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx ON public.page_views (viewed_at);

CREATE TABLE IF NOT EXISTS public.watch_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  movie_slug text NOT NULL,
  movie_name text,
  thumb_url text,
  episode_name text,
  server_name text,
  username text,
  avatar_url text,
  watch_duration_sec int,
  completed boolean DEFAULT false,
  lang text,
  quality text,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_events_movie_started_idx
  ON public.watch_events (movie_slug, started_at);
CREATE INDEX IF NOT EXISTS watch_events_started_idx ON public.watch_events (started_at);

CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text NOT NULL,
  results_count int,
  clicked_slug text,
  searched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_logs_searched_at_idx ON public.search_logs (searched_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;
