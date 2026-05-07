-- Break the games↔game_players RLS recursion by using a SECURITY DEFINER
-- function that queries game_players without triggering its RLS policy.
CREATE OR REPLACE FUNCTION public.user_is_game_participant(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_players.game_id = p_game_id
      AND game_players.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Users can view own games" ON public.games;

CREATE POLICY "Users can view own games" ON public.games FOR SELECT USING (
  auth.uid() = created_by
  OR public.user_is_game_participant(id)
);
