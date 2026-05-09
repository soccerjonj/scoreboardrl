-- Add "tournament" as a valid game_type value
ALTER TYPE public.game_type ADD VALUE IF NOT EXISTS 'tournament';

-- Add tournament_type column to games (populated only for tournament games)
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS tournament_type text;

-- Update get_leaderboard to also count tournament Soccar 2v2/3v3 games
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
      AND (
        -- Standard competitive
        (g.game_type = 'competitive' AND g.game_mode IN ('1v1', '2v2', '3v3'))
        OR
        -- Tournament Soccar 2v2/3v3 only
        (g.game_type = 'tournament' AND g.game_mode IN ('2v2', '3v3') AND g.tournament_type = 'soccar')
      )
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
