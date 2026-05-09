# Season Management

ScoreboardRL tracks Rocket League competitive seasons. Season data lives in the `public.seasons` table in Supabase and drives the leaderboard and stats page time filters — no code deployment is required when a season changes.

---

## Current season

| # | Name | Starts | Ends |
|---|------|--------|------|
| 22 | Season 22 | March 11, 2026 | TBD |

---

## Setting the end date (once Psyonix announces it)

Run this in the **Supabase SQL Editor** (no deployment needed):

```sql
UPDATE public.seasons
  SET ends_at = '2026-06-18 17:00:00+00'   -- ← replace with actual announced date
WHERE is_current = true;
```

Within 14 days of that date, a yellow "Season ending soon" banner will appear automatically on the leaderboard for all users.

---

## Season rollover (when a new season starts)

Run both statements together in the **Supabase SQL Editor**:

```sql
-- 1. Close out the current season
UPDATE public.seasons
  SET is_current = false,
      ends_at    = now()     -- set exact end if not already set
WHERE is_current = true;

-- 2. Insert the new season (update number, name, and starts_at)
INSERT INTO public.seasons (number, name, starts_at, ends_at, is_current)
VALUES (23, 'Season 23', now(), NULL, true);
```

That's it. The leaderboard will immediately show "Season 23" as the default window with 0 entries, and the stats page will filter from the new start date forward.

---

## Notes

- `ends_at = NULL` means the end date is not yet announced — the "ending soon" banner will **not** appear.
- Only one row can have `is_current = true` at a time (enforced by a DB partial unique index).
- Past season rows are kept for historical reference and could power per-season leaderboard comparisons in the future.
