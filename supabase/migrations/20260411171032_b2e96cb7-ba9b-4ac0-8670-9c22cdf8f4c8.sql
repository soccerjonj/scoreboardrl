ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS carry_score numeric;