-- Tournament tracking tables
-- Tournaments are single-elimination: R1 → R2 → QF → SF (Bo3) → Final (Bo3)
-- Supported variants: soccar, pentathlon, heatseeker, rumble
-- Team sizes: 2v2 or 3v3 only

CREATE TABLE public.tournaments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_mode        public.game_mode NOT NULL,
  tournament_type  text NOT NULL DEFAULT 'soccar'
                   CHECK (tournament_type IN ('soccar','pentathlon','heatseeker','rumble')),
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'completed')),
  outcome          text CHECK (outcome IN ('eliminated', 'winner')),
  current_round    text NOT NULL DEFAULT 'round_1'
                   CHECK (current_round IN ('round_1','round_2','quarter_final','semi_final','final')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tournaments" ON public.tournaments
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Links individual games to a tournament round
CREATE TABLE public.tournament_games (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  game_id       uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round         text NOT NULL
                CHECK (round IN ('round_1','round_2','quarter_final','semi_final','final')),
  game_number   integer NOT NULL DEFAULT 1, -- 1, 2, or 3 for Bo3 rounds
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id)
);

ALTER TABLE public.tournament_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tournament games" ON public.tournament_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own tournament games" ON public.tournament_games
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete own tournament games" ON public.tournament_games
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.user_id = auth.uid()
    )
  );
