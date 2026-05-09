-- ── Tournament Participants ─────────────────────────────────────────────────
-- Join table that lets multiple users (owner + up to 2 partners) share a
-- single tournament session. Auto-activates Tournament Mode for partners and
-- allows either user to log games into the same tournament.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  is_owner        boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS tournament_participants_user_id_idx       ON public.tournament_participants (user_id);
CREATE INDEX IF NOT EXISTS tournament_participants_tournament_id_idx ON public.tournament_participants (tournament_id);

-- Backfill: every existing tournament becomes a single-participant tournament
-- with the original creator as the owner.
INSERT INTO public.tournament_participants (tournament_id, user_id, is_owner)
SELECT id, user_id, true FROM public.tournaments
ON CONFLICT (tournament_id, user_id) DO NOTHING;

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- A participant can read all rows belonging to tournaments they're in
CREATE POLICY "Participants view roster"
  ON public.tournament_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_participants me
      WHERE me.tournament_id = tournament_participants.tournament_id
        AND me.user_id = auth.uid()
    )
  );

-- Only the tournament owner can add participants (owner row + invited partners)
CREATE POLICY "Owner manages roster"
  ON public.tournament_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_participants.tournament_id
        AND t.user_id = auth.uid()
    )
  );

-- A participant can remove themselves (leave the session)
CREATE POLICY "Participant can leave"
  ON public.tournament_participants
  FOR DELETE
  USING (user_id = auth.uid());
