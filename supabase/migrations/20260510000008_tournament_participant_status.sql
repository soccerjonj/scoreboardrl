-- ── Tournament invite status ────────────────────────────────────────────────
-- Adds an 'invited' / 'joined' status to tournament_participants so partners
-- have an explicit Join/Decline step before their app activates Tournament
-- Mode. Existing rows get 'joined' since they predate the invite flow.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'joined'
  CHECK (status IN ('invited', 'joined'));

-- A partner needs to be able to update their own row (status: invited → joined)
CREATE POLICY "Participant can accept invite"
  ON public.tournament_participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
