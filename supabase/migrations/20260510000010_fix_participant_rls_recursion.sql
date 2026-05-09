-- ── Fix RLS recursion on tournament_participants ───────────────────────────
-- The original SELECT policy did "EXISTS (SELECT 1 FROM tournament_participants
-- me WHERE ...)" which is self-referential. Some clients (Supabase JS) trigger
-- the recursive evaluation in a way that ends up returning no rows even when
-- the data is present. Replace it with a SECURITY DEFINER helper function
-- that bypasses RLS for the inner check.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_tournament_participant(t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_participants
    WHERE tournament_id = t_id AND user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_tournament_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tournament_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants view roster" ON public.tournament_participants;

-- A user can always see their own participant row directly (fast path)…
CREATE POLICY "Read own participant row"
  ON public.tournament_participants
  FOR SELECT
  USING (user_id = auth.uid());

-- …and can also see other participant rows for tournaments they're in
-- (to render the roster of co-pilots), via a SECURITY DEFINER helper that
-- avoids the recursive RLS evaluation.
CREATE POLICY "Read participants of my tournaments"
  ON public.tournament_participants
  FOR SELECT
  USING (public.is_tournament_participant(tournament_id));
