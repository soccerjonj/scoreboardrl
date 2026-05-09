-- ── Add 'tournament_invite' notification type ───────────────────────────────
-- Sent to partners when an owner starts a co-op tournament with them.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'tournament_invite';
