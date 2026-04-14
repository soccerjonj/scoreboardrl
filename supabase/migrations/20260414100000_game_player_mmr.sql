ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS mmr integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mmr_change integer DEFAULT NULL;
