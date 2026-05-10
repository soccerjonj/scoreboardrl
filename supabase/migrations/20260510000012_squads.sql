-- ── Squads: saved named teammate groups ─────────────────────────────────────
-- A "squad" is a personal organization tool — the user names a group of
-- teammates (e.g. "Tourney Trio") and the app aggregates chemistry stats
-- across games where ALL squad members appeared on the same team.
-- Private to the owner: members of a squad don't see it on their account.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.squads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX squads_user_id_idx ON public.squads(user_id);

CREATE TABLE public.squad_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id        uuid        NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  member_user_id  uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, member_user_id)
);
CREATE INDEX squad_members_squad_id_idx ON public.squad_members(squad_id);

ALTER TABLE public.squads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- Owner-only on both tables — squads are private personal organization
CREATE POLICY "Owner manages squads"
  ON public.squads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner manages squad members"
  ON public.squad_members
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND s.user_id = auth.uid())
  );
