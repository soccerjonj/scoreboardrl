-- Launch hardening: runtime kill-switch, parse rate-limit, cross-session parse
-- cache, storage bucket limits, and hot-path indexes. Aimed at surviving a
-- traffic spike while staying inside the Supabase free tier.

-- ── Runtime config (kill-switch) ───────────────────────────────────────────
-- Read-only to clients; flip values from the dashboard (service role) to change
-- app behavior without a redeploy. e.g. set screenshots_enabled=false to stop
-- accepting uploads when the storage bucket nears the 1 GB cap.
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
drop policy if exists "anyone can read app_config" on public.app_config;
create policy "anyone can read app_config" on public.app_config
  for select using (true);
insert into public.app_config (key, value)
  values ('screenshots_enabled', 'true'::jsonb)
  on conflict (key) do nothing;

-- ── Per-user parse rate limit ──────────────────────────────────────────────
-- Sliding fixed-window counter so one user can't hammer the shared Gemini key
-- and 429 everyone else. Touched only by the parse-scoreboard edge function via
-- the SECURITY DEFINER function below (service role), so no client policies.
create table if not exists public.parse_rate_limit (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table public.parse_rate_limit enable row level security;

create or replace function public.check_parse_rate(
  p_user_id uuid,
  p_limit int,
  p_window_seconds int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_now   timestamptz := now();
begin
  insert into public.parse_rate_limit as prl (user_id, window_start, count)
  values (p_user_id, v_now, 1)
  on conflict (user_id) do update
    set window_start = case
          when prl.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now else prl.window_start end,
        count = case
          when prl.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1 else prl.count + 1 end
  returning prl.count into v_count;

  return jsonb_build_object('allowed', v_count <= p_limit, 'count', v_count);
end;
$$;
grant execute on function public.check_parse_rate(uuid, int, int) to service_role;

-- ── Cross-session parse cache ──────────────────────────────────────────────
-- Identical (image + player name) → return the saved parse for free. Keyed by a
-- hash computed in the edge function. Service-role only.
create table if not exists public.parse_cache (
  image_hash text primary key,
  result     jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.parse_cache enable row level security;

-- ── Storage bucket limits ──────────────────────────────────────────────────
-- Cap per-object size and restrict to image types so one huge or wrong-type
-- upload can't blow the bucket.
update storage.buckets
   set file_size_limit   = 5242880, -- 5 MB
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/heic','image/heif'
       ]
 where id = 'screenshots';

-- ── Hot-path indexes ───────────────────────────────────────────────────────
create index if not exists games_created_by_played_at_idx
  on public.games (created_by, played_at desc);
create index if not exists game_players_game_id_idx
  on public.game_players (game_id);
create index if not exists game_players_user_id_idx
  on public.game_players (user_id);
create index if not exists ranks_user_type_idx
  on public.ranks (user_id, game_type);
create index if not exists tournament_games_game_id_idx
  on public.tournament_games (game_id);
create index if not exists tournament_games_tournament_id_idx
  on public.tournament_games (tournament_id);
