-- ── Season 22 end date ────────────────────────────────────────────────────────
-- Psyonix confirmed Season 22 ends 2026-06-10 17:00 UTC (Season 23 begins the
-- same day). Setting ends_at activates the in-app "ending soon" banner and the
-- Dashboard season countdown — both read the seasons row with is_current = true.
UPDATE public.seasons
  SET ends_at = '2026-06-10 17:00:00+00'
  WHERE number = 22;

-- ── SEASON 23 ROLLOVER (run on 2026-06-10 when S23 goes live) ──────────────────
-- The partial unique index seasons_one_current allows only one is_current row,
-- so flip Season 22 off BEFORE inserting Season 23 as current:
--
--   UPDATE public.seasons SET is_current = false WHERE number = 22;
--
--   INSERT INTO public.seasons (number, name, starts_at, ends_at, is_current)
--   VALUES (23, 'Season 23', '2026-06-10 17:00:00+00', NULL, true);
--
-- No code deployment needed — the app reads is_current = true dynamically.
