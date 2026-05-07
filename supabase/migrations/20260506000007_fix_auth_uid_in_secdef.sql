-- auth.uid() can return NULL inside SECURITY DEFINER with a restricted search_path.
-- Fix: pass the caller's uid as a parameter so it's evaluated in policy context,
-- not inside the definer function.

CREATE OR REPLACE FUNCTION public.user_is_game_participant(p_game_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_id = p_game_id
      AND user_id = p_user_id
  );
$$;

-- games: allow owner OR participant
DROP POLICY IF EXISTS "Users can view own games" ON public.games;
CREATE POLICY "Users can view own games" ON public.games FOR SELECT USING (
  auth.uid() = created_by
  OR public.user_is_game_participant(id, auth.uid())
);

-- game_players: allow game owner OR any participant to see all rows in that game
DROP POLICY IF EXISTS "Game players viewable by game creator or participant" ON public.game_players;
CREATE POLICY "Game players viewable by game creator or participant" ON public.game_players FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = game_players.game_id
      AND games.created_by = auth.uid()
  )
  OR public.user_is_game_participant(game_players.game_id, auth.uid())
);
