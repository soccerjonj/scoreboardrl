-- ── 1. Notifications ─────────────────────────────────────────────────────────
CREATE TYPE public.notification_type AS ENUM (
  'game_shared',        -- a teammate logged a game that includes you
  'stat_conflict',      -- a duplicate game was found with different stats
  'stat_edit',          -- a teammate edited your stat row
  'friend_request'      -- someone sent you a friend request
);

CREATE TABLE public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         public.notification_type NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  payload      JSONB DEFAULT '{}',
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (TRUE);

-- ── 2. Auto-approve per friendship ───────────────────────────────────────────
ALTER TABLE public.friend_requests
  ADD COLUMN IF NOT EXISTS sender_auto_approve   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS receiver_auto_approve BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 3. Duplicate game linking ─────────────────────────────────────────────────
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.games(id) ON DELETE SET NULL;

-- Index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS games_duplicate_of_idx ON public.games(duplicate_of);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, read) WHERE read = FALSE;
