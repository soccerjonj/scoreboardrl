-- Backfill all existing games as photo-logged so they appear on the leaderboard
UPDATE public.games SET logged_via_photo = true WHERE logged_via_photo = false;
