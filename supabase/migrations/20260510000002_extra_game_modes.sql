-- ── Extra Rocket League game modes ───────────────────────────────────────────
-- Adds 5 extra competitive playlist modes to the game_mode enum.
-- These modes are tracked separately and excluded from standard profile stats
-- and the leaderboard. Dropshot uses "damage" instead of "shots".
-- ──────────────────────────────────────────────────────────────────────────────

-- Add new enum values (IF NOT EXISTS requires Postgres 9.6+; Supabase is PG15)
ALTER TYPE public.game_mode ADD VALUE IF NOT EXISTS 'rumble_3v3';
ALTER TYPE public.game_mode ADD VALUE IF NOT EXISTS 'hoops_2v2';
ALTER TYPE public.game_mode ADD VALUE IF NOT EXISTS 'snowday_3v3';
ALTER TYPE public.game_mode ADD VALUE IF NOT EXISTS 'dropshot_3v3';
ALTER TYPE public.game_mode ADD VALUE IF NOT EXISTS 'heatseeker_2v2';

-- Add nullable damage column to game_players (Dropshot only; NULL for all other modes)
ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS damage integer;

-- Update get_leaderboard to count only standard modes (1v1, 2v2, 3v3)
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_window text,
  p_stat   text DEFAULT 'games'
)
RETURNS TABLE(user_id uuid, rl_name text, avatar_url text, stat_value bigint, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH base AS (
    SELECT
      p.user_id,
      COALESCE(p.rl_account_name, p.username) AS rl_name,
      p.avatar_url,
      CASE p_stat
        WHEN 'wins'    THEN COUNT(DISTINCT g.id) FILTER (WHERE g.result = 'win')::bigint
        WHEN 'goals'   THEN COALESCE(SUM(gp.goals),   0)::bigint
        WHEN 'assists' THEN COALESCE(SUM(gp.assists),  0)::bigint
        WHEN 'saves'   THEN COALESCE(SUM(gp.saves),    0)::bigint
        WHEN 'score'   THEN COALESCE(SUM(gp.score),    0)::bigint
        ELSE                COUNT(DISTINCT g.id)::bigint
      END AS stat_value
    FROM public.profiles p
    JOIN public.game_players gp ON gp.user_id = p.user_id
    JOIN public.games        g  ON g.id = gp.game_id
    WHERE p.show_on_leaderboard = true
      AND g.logged_via_photo    = true
      AND g.game_mode IN ('1v1', '2v2', '3v3')   -- standard modes only
      AND (
        p_window = 'all'
        OR (p_window = '7d'     AND g.played_at >= now() - interval '7 days')
        OR (p_window = '28d'    AND g.played_at >= now() - interval '28 days')
        OR (p_window = 'season' AND g.played_at >= (
              SELECT starts_at FROM public.seasons WHERE is_current = true LIMIT 1))
      )
    GROUP BY p.user_id, p.rl_account_name, p.username, p.avatar_url
  )
  SELECT user_id, rl_name, avatar_url, stat_value,
         RANK() OVER (ORDER BY stat_value DESC) AS rank
  FROM base WHERE stat_value > 0
  ORDER BY stat_value DESC LIMIT 100;
$$;
