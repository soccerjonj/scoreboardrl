-- Backfill game_type and tournament_type for games that were logged as part
-- of a tournament BEFORE the 'tournament' game_type existed.
--
-- These games are still tracked correctly in `tournament_games`, but the
-- `games` row itself was saved with game_type='competitive' and
-- tournament_type=NULL, so they currently display as "Competitive" on the
-- profile / home / activity feed.
--
-- This migration fixes the data by joining through tournament_games and
-- copying the parent tournament's tournament_type onto the game row.

UPDATE public.games AS g
SET
  game_type = 'tournament',
  tournament_type = t.tournament_type
FROM public.tournament_games AS tg
JOIN public.tournaments AS t ON t.id = tg.tournament_id
WHERE g.id = tg.game_id
  AND (g.game_type <> 'tournament' OR g.tournament_type IS NULL);
