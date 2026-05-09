-- Passively update a player's rank whenever a game_players row is inserted
-- with a matched user_id and a parsed rank_tier from the scoreboard.
--
-- This means that whenever anyone logs a game, all recognised teammates and
-- opponents automatically get their rank record updated — no action required
-- from the other players.
--
-- The played_at guard prevents an out-of-order game log (older screenshot
-- uploaded later) from overwriting a rank that was already set by a newer game.

CREATE OR REPLACE FUNCTION public.update_rank_from_game_player()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game_mode  public.game_mode;
  v_game_type  public.game_type;
  v_played_at  timestamptz;
BEGIN
  -- Only process rows that have both a matched user AND a parsed rank badge
  IF NEW.user_id IS NULL OR NEW.rank_tier IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the parent game's metadata
  SELECT game_mode, game_type, played_at
  INTO   v_game_mode, v_game_type, v_played_at
  FROM   public.games
  WHERE  id = NEW.game_id;

  -- Only update ranks for competitive games
  IF v_game_type IS DISTINCT FROM 'competitive' THEN
    RETURN NEW;
  END IF;

  -- Upsert the rank row, but skip if we already have a newer snapshot
  INSERT INTO public.ranks (user_id, game_mode, game_type, rank_tier, rank_division)
  VALUES (NEW.user_id, v_game_mode, 'competitive', NEW.rank_tier, NEW.rank_division)
  ON CONFLICT (user_id, game_mode, game_type)
  DO UPDATE SET
    rank_tier     = EXCLUDED.rank_tier,
    rank_division = EXCLUDED.rank_division,
    updated_at    = now()
  WHERE public.ranks.updated_at < v_played_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_game_player_inserted_update_rank
  AFTER INSERT ON public.game_players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rank_from_game_player();
