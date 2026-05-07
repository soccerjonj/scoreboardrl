-- Backfill user_id on game_players rows where player_name matches a registered
-- profile but user_id was never set (e.g. due to parse typo later corrected).
UPDATE public.game_players gp
SET user_id = p.user_id
FROM public.profiles p
WHERE gp.user_id IS NULL
  AND lower(gp.player_name) = lower(p.rl_account_name);
