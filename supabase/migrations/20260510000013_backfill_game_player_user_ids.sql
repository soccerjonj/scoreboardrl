-- Backfill: link historical `game_players` rows to their owner `profiles`
-- by case-insensitive `rl_account_name` match.
--
-- Earlier versions of the log-game flow used `.in("rl_account_name", names)`
-- in PostgREST, which is EXACT-MATCH only. A profile saved as "FriendName"
-- never matched a scoreboard-parsed "friendname", so `user_id` was left
-- NULL on game_players rows even when both players were on ScoreboardRL.
-- That broke clickable gamertags, the "played with a friend" icon, and the
-- friend's own game feed.
--
-- The app code now does case-insensitive `ilike` lookups, but we still need
-- to repair the rows already inserted with NULL user_id. This update is
-- safe to run repeatedly — it only touches rows where user_id IS NULL and
-- where exactly one profile matches on the normalized name.

UPDATE public.game_players AS gp
SET user_id = sub.user_id
FROM (
  SELECT
    gp_inner.id            AS gp_id,
    matched.user_id        AS user_id
  FROM public.game_players gp_inner
  CROSS JOIN LATERAL (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.rl_account_name IS NOT NULL
      AND lower(trim(p.rl_account_name)) = lower(trim(gp_inner.player_name))
    LIMIT 2  -- LIMIT 2 lets us detect "more than one match" via the count below
  ) matched
  WHERE gp_inner.user_id IS NULL
    AND gp_inner.player_name IS NOT NULL
    AND length(trim(gp_inner.player_name)) > 0
    -- Only update when exactly one profile matches the normalized name. If
    -- two distinct profiles share the same case-insensitive name we'd
    -- rather leave the row unlinked than guess wrong.
    AND (
      SELECT count(*) FROM public.profiles p2
      WHERE p2.rl_account_name IS NOT NULL
        AND lower(trim(p2.rl_account_name)) = lower(trim(gp_inner.player_name))
    ) = 1
) sub
WHERE gp.id = sub.gp_id
  AND gp.user_id IS NULL;
