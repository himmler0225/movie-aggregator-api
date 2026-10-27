-- Refresh rotation without lost-response logouts: a rotated token stays usable
-- until its replacement (child) is used for the first time.
ALTER TABLE public.refresh_tokens
  ADD COLUMN IF NOT EXISTS parent_id uuid;

CREATE INDEX IF NOT EXISTS refresh_tokens_parent_id_idx
  ON public.refresh_tokens (parent_id);
