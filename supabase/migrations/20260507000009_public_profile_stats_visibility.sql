-- Allow authenticated users to view all games and game_players rows so
-- profile pages can show full stats for any player (e.g. from leaderboard).
-- Existing owner/participant policies remain; these broaden read access.

DROP POLICY IF EXISTS "Authenticated users can view all games for profiles" ON public.games;
CREATE POLICY "Authenticated users can view all games for profiles"
ON public.games
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view all game players for profiles" ON public.game_players;
CREATE POLICY "Authenticated users can view all game players for profiles"
ON public.game_players
FOR SELECT
TO authenticated
USING (true);
