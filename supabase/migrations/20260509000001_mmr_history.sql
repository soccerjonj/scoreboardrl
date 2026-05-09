-- MMR history snapshots recorded whenever a user saves their ranks
CREATE TABLE public.mmr_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_mode   text NOT NULL,
  mmr         integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mmr_history ENABLE ROW LEVEL SECURITY;

-- Own user can read/insert their history
CREATE POLICY "Users read own mmr history" ON public.mmr_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mmr history" ON public.mmr_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Any authenticated user can read any profile's mmr history (for friend profile charts)
CREATE POLICY "Authenticated users read all mmr history" ON public.mmr_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX idx_mmr_history_user_mode_time
  ON public.mmr_history (user_id, game_mode, recorded_at DESC);
