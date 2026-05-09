-- ── Relax tournament RLS for co-op ──────────────────────────────────────────
-- Replace the strict "owner-only" policies with participant-aware policies so
-- partners can read the tournament + read/write tournament_games.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── tournaments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own tournaments" ON public.tournaments;

CREATE POLICY "Participants view tournament"
  ON public.tournaments
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = tournaments.id
        AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner inserts tournament" ON public.tournaments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates tournament" ON public.tournaments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner deletes tournament" ON public.tournaments
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── tournament_games ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view own tournament games"   ON public.tournament_games;
DROP POLICY IF EXISTS "Users insert own tournament games" ON public.tournament_games;
DROP POLICY IF EXISTS "Users delete own tournament games" ON public.tournament_games;

CREATE POLICY "Participants read tournament games"
  ON public.tournament_games
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = tournament_games.tournament_id
        AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants insert tournament games"
  ON public.tournament_games
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = tournament_games.tournament_id
        AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants update tournament games"
  ON public.tournament_games
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = tournament_games.tournament_id
        AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants delete tournament games"
  ON public.tournament_games
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = tournament_games.tournament_id
        AND tp.user_id = auth.uid()
    )
  );
