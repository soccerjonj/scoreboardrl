-- Allow users to view games they appear in as a player, not just games they created
DROP POLICY IF EXISTS "Users can view own games" ON public.games;

CREATE POLICY "Users can view own games" ON public.games FOR SELECT USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_players.game_id = games.id
      AND game_players.user_id = auth.uid()
  )
);
