-- Add an explicit per-episode completion flag and backfill existing history.
ALTER TABLE public.watch_history
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

UPDATE public.watch_history
SET completed = duration_sec > 0
  AND progress_sec::double precision / duration_sec >= 0.95;

NOTIFY pgrst, 'reload schema';
