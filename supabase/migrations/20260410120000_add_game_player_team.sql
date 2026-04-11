-- Add team color enum and column for team-based goals against
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_color') THEN
    CREATE TYPE public.team_color AS ENUM ('blue', 'orange');
  END IF;
END$$;

ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS team public.team_color;
