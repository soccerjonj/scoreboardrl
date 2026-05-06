ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS rank_tier     public.rank_tier     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rank_division public.rank_division DEFAULT NULL;
