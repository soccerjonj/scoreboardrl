-- ── Subscription tier enum ────────────────────────────────────────────────────
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'lifetime');

-- ── Subscriptions table ────────────────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                   public.subscription_tier NOT NULL DEFAULT 'free',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ── Parse usage tracking ──────────────────────────────────────────────────────
CREATE TABLE public.parse_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month       date NOT NULL,
  parse_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, month)
);
ALTER TABLE public.parse_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own usage"
  ON public.parse_usage FOR SELECT USING (auth.uid() = user_id);

-- ── Atomic increment RPC ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_parse_count(
  p_user_id uuid,
  p_month   date,
  p_quota   integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.parse_usage (user_id, month, parse_count)
  VALUES (p_user_id, p_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET parse_count = parse_usage.parse_count + 1
  RETURNING parse_count INTO v_count;
  RETURN jsonb_build_object('allowed', v_count <= p_quota, 'count', v_count);
END; $$;

-- ── Auto-create free subscription on signup ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_subscription();

-- ── Backfill existing users ───────────────────────────────────────────────────
INSERT INTO public.subscriptions (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ── logged_via_photo flag on games ────────────────────────────────────────────
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS logged_via_photo boolean NOT NULL DEFAULT false;

-- ── Leaderboard opt-out on profiles ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean NOT NULL DEFAULT true;

-- ── Leaderboard RPC ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_window text)
RETURNS TABLE(
  user_id    uuid,
  rl_name    text,
  avatar_url text,
  game_count bigint,
  rank       bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.user_id,
    COALESCE(p.rl_account_name, p.username) AS rl_name,
    p.avatar_url,
    COUNT(g.id) AS game_count,
    RANK() OVER (ORDER BY COUNT(g.id) DESC) AS rank
  FROM public.profiles p
  JOIN public.games g ON g.created_by = p.user_id
  WHERE p.show_on_leaderboard = true
    AND g.logged_via_photo = true
    AND (
      p_window = 'all'
      OR (p_window = '7d'  AND g.played_at >= now() - interval '7 days')
      OR (p_window = '28d' AND g.played_at >= now() - interval '28 days')
    )
  GROUP BY p.user_id, p.rl_account_name, p.username, p.avatar_url
  ORDER BY game_count DESC
  LIMIT 100;
$$;
