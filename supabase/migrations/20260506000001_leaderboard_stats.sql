-- ── Extended leaderboard RPC with stat categories ────────────────────────────
-- Replaces the original get_leaderboard with a version that accepts p_stat
-- so the frontend can switch between: games, wins, goals, assists, saves, score

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_window text,
  p_stat   text DEFAULT 'games'
)
RETURNS TABLE(
  user_id    uuid,
  rl_name    text,
  avatar_url text,
  stat_value bigint,
  rank       bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
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
        ELSE                COUNT(DISTINCT g.id)::bigint   -- 'games'
      END AS stat_value
    FROM public.profiles p
    JOIN public.game_players gp ON gp.user_id = p.user_id
    JOIN public.games        g  ON g.id = gp.game_id
    WHERE p.show_on_leaderboard = true
      AND g.logged_via_photo    = true
      AND (
        p_window = 'all'
        OR (p_window = '7d'  AND g.played_at >= now() - interval '7 days')
        OR (p_window = '28d' AND g.played_at >= now() - interval '28 days')
      )
    GROUP BY p.user_id, p.rl_account_name, p.username, p.avatar_url
  )
  SELECT
    user_id,
    rl_name,
    avatar_url,
    stat_value,
    RANK() OVER (ORDER BY stat_value DESC) AS rank
  FROM base
  WHERE stat_value > 0
  ORDER BY stat_value DESC
  LIMIT 100;
$$;
