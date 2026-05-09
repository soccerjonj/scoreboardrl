-- ── Seasons table ─────────────────────────────────────────────────────────────
-- Tracks Rocket League competitive seasons as time windows for the leaderboard
-- and stats page. Only one row should have is_current = true at any time.
--
-- ROLLOVER PROCEDURE (run in Supabase SQL editor when a new season starts):
--   UPDATE public.seasons
--     SET is_current = false,
--         ends_at    = now()
--   WHERE is_current = true;
--
--   INSERT INTO public.seasons (number, name, starts_at, ends_at, is_current)
--   VALUES (23, 'Season 23', now(), NULL, true);
--
-- No code deployment needed — the app reads is_current = true dynamically.
--
-- To enable the "ending soon" banner, once Psyonix announces the actual end date:
--   UPDATE public.seasons
--     SET ends_at = '2026-06-18 17:00:00+00'
--   WHERE is_current = true;
--
-- The banner appears automatically within 14 days of that date.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.seasons (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number     integer     NOT NULL UNIQUE,
  name       text        NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz,             -- NULL = end date not yet announced
  is_current boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce only one current season at the DB level (partial unique index)
CREATE UNIQUE INDEX seasons_one_current ON public.seasons (is_current)
  WHERE is_current = true;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read seasons"
  ON public.seasons
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed Season 22
-- starts_at = March 11 2026 (confirmed patch day)
-- ends_at left NULL until Psyonix announces the actual end date
INSERT INTO public.seasons (number, name, starts_at, ends_at, is_current)
VALUES (22, 'Season 22', '2026-03-11 17:00:00+00', NULL, true);

-- ── Updated get_leaderboard RPC ───────────────────────────────────────────────
-- Adds 'season' as a valid p_window value. The season window uses the
-- starts_at of whichever season has is_current = true.

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
        OR (p_window = '7d'     AND g.played_at >= now() - interval '7 days')
        OR (p_window = '28d'    AND g.played_at >= now() - interval '28 days')
        OR (p_window = 'season' AND g.played_at >= (
              SELECT starts_at FROM public.seasons WHERE is_current = true LIMIT 1))
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
