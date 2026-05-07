-- Allow users to see ALL players in a game if they are a participant,
-- not just their own row. Reuses the SECURITY DEFINER function from migration 005
-- to avoid recursion.
DROP POLICY IF EXISTS "Game players viewable by game creator or participant" ON public.game_players;

CREATE POLICY "Game players viewable by game creator or participant" ON public.game_players FOR SELECT USING (
  -- user created the game
  EXISTS (SELECT 1 FROM public.games WHERE games.id = game_players.game_id AND games.created_by = auth.uid())
  -- user is a linked participant in the game (sees all rows in that game)
  OR public.user_is_game_participant(game_players.game_id)
);
