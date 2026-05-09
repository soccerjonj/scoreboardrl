-- Add banner image support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_car text;

-- Allow any authenticated user to read any tournament (for social profile viewing)
-- The existing "Users manage own tournaments" policy covers INSERT/UPDATE/DELETE for own rows
CREATE POLICY "Authenticated users read all tournaments" ON public.tournaments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow any authenticated user to read tournament_games (for bracket display on friend profiles)
CREATE POLICY "Authenticated users read all tournament games" ON public.tournament_games
  FOR SELECT USING (auth.role() = 'authenticated');
