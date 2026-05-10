-- ── Open tournament visibility to all authenticated users ──────────────────
-- ScoreboardRL is a social app — anyone with an account should be able to
-- click into someone else's tournament from their recent games and see how
-- they did. SELECT on `tournaments` was already wide open via the
-- 'Authenticated users read all tournaments' policy (alongside a redundant
-- participant-gated one). This migration tidies that up and also opens
-- `tournament_participants` so the roster can be surfaced socially.
--
-- Owner-only INSERT / UPDATE / DELETE policies on tournaments are unchanged
-- so a non-owner still can't modify someone else's tournament.
-- ──────────────────────────────────────────────────────────────────────────────

-- tournaments — drop the now-redundant participant-gated SELECT (the
-- 'Authenticated users read all tournaments' policy is wider and already
-- exists, so this is a cleanup only)
DROP POLICY IF EXISTS "Participants view tournament" ON public.tournaments;

-- tournament_participants — add a global authenticated read so a friend's
-- roster shows when you click into their tournament. Keep "Read own
-- participant row" since it's harmless and "Read participants of my
-- tournaments" since it uses the SECURITY DEFINER helper.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tournament_participants'
      AND policyname = 'Authenticated users read all participants'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users read all participants"
      ON public.tournament_participants
      FOR SELECT
      USING (auth.role() = ''authenticated'')';
  END IF;
END$$;
