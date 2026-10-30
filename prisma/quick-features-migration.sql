-- Community intro/outro markers, web push subscriptions, and the state of the
-- new-episode push job. Idempotent.
CREATE TABLE IF NOT EXISTS public.skip_marks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  episode_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('intro', 'outro')),
  start_sec double precision NOT NULL,
  end_sec double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_slug, episode_name, kind)
);
CREATE INDEX IF NOT EXISTS skip_marks_episode_idx
  ON public.skip_marks (movie_slug, episode_name);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.series_episode_state (
  movie_slug text PRIMARY KEY,
  episode_current text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skip_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_episode_state ENABLE ROW LEVEL SECURITY;
