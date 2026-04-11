
-- Create enums
CREATE TYPE public.game_mode AS ENUM ('1v1', '2v2', '3v3');
CREATE TYPE public.game_type AS ENUM ('competitive', 'casual');
CREATE TYPE public.rank_tier AS ENUM ('unranked', 'bronze_1', 'bronze_2', 'bronze_3', 'silver_1', 'silver_2', 'silver_3', 'gold_1', 'gold_2', 'gold_3', 'platinum_1', 'platinum_2', 'platinum_3', 'diamond_1', 'diamond_2', 'diamond_3', 'champion_1', 'champion_2', 'champion_3', 'grand_champion_1', 'grand_champion_2', 'grand_champion_3', 'supersonic_legend');
CREATE TYPE public.rank_division AS ENUM ('I', 'II', 'III', 'IV');
CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE public.stat_submission_status AS ENUM ('pending', 'approved', 'rejected');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  rl_account_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ranks table
CREATE TABLE public.ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_mode public.game_mode NOT NULL,
  game_type public.game_type NOT NULL DEFAULT 'competitive',
  rank_tier public.rank_tier NOT NULL DEFAULT 'unranked',
  rank_division public.rank_division,
  mmr INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_mode, game_type)
);
ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranks viewable by everyone" ON public.ranks FOR SELECT USING (true);
CREATE POLICY "Users can insert own ranks" ON public.ranks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ranks" ON public.ranks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ranks" ON public.ranks FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_ranks_updated_at BEFORE UPDATE ON public.ranks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_mode public.game_mode NOT NULL,
  game_type public.game_type NOT NULL DEFAULT 'competitive',
  result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
  division_change TEXT CHECK (division_change IN ('up', 'down', 'none')),
  screenshot_url TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own games" ON public.games FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can insert own games" ON public.games FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own games" ON public.games FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own games" ON public.games FOR DELETE USING (auth.uid() = created_by);

-- Game players
CREATE TABLE public.game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  shots INTEGER NOT NULL DEFAULT 0,
  is_mvp BOOLEAN NOT NULL DEFAULT false,
  submission_status public.stat_submission_status NOT NULL DEFAULT 'approved',
  submitted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game players viewable by game creator or participant" ON public.game_players FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.games WHERE games.id = game_players.game_id AND games.created_by = auth.uid())
  OR game_players.user_id = auth.uid()
);
CREATE POLICY "Users can insert game players for own games" ON public.game_players FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.games WHERE games.id = game_players.game_id AND games.created_by = auth.uid())
);
CREATE POLICY "Users can update own stats or submitted stats" ON public.game_players FOR UPDATE USING (
  auth.uid() = user_id OR auth.uid() = submitted_by
);

-- Friend requests
CREATE TABLE public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.friend_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own friend requests" ON public.friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send friend requests" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update received requests" ON public.friend_requests FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Users can delete own sent requests" ON public.friend_requests FOR DELETE USING (auth.uid() = sender_id);
CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
