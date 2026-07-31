# ScoreboardRL

A stat tracker for Rocket League players. Snap a photo of the post-game scoreboard and an AI vision model reads it automatically — no manual entry — then tracks rank progression, computes a per-player contribution score, and lets you compare stats with friends.

**Live app:** https://scoreboardrl.vercel.app

## How it works

1. You take a photo of the in-game scoreboard after a match.
2. The browser compresses the image and sends it to a Supabase edge function.
3. The edge function calls Google Gemini 2.5 Flash Vision, which parses the screenshot into structured player stats (goals, assists, saves, shots, rank, MMR).
4. Stats are written to Postgres and shown on your dashboard — rank history, contribution score, session summaries, and friend comparisons.

The Gemini call runs server-side (never in the browser) so the API key stays secret and the server can enforce rate limits, a monthly parse quota, and response caching.

## Features

- **AI scoreboard parsing** — photo in, structured stats out
- **Contribution score** — a custom algorithm estimating each player's share of their team's performance (score, defense, offense weighted and normalized to sum to 100% per team)
- **Rank & MMR tracking** — progression over time, division changes
- **Friends & squads** — head-to-head comparisons, squad stat aggregation
- **Tournaments & seasons**
- **Charts** — stat trends via Recharts
- **Installable PWA** — works offline-first, installs like a native app
- **Companion browser extension** — auto-logs games as they finish (`extension/`)
- **Paid tier** — Stripe-backed subscription for higher parse quotas

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Router, Recharts
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions on Deno)
- **AI:** Google Gemini 2.5 Flash Vision API
- **Payments:** Stripe (checkout + webhooks)
- **Validation:** Zod, react-hook-form
- **Testing:** Vitest, Testing Library
- **PWA:** vite-plugin-pwa

## Project structure

```
src/
  pages/                 Route-level screens (Dashboard, LogGame, Friends, Stats, ...)
  components/            UI components grouped by feature
  contexts/AuthContext.tsx   Auth/session state
  hooks/                  Data hooks (quota, notifications, badges, ...)
  lib/                    Core business logic (contribution score, game modes, player matching, image compression)
  integrations/supabase/  Configured Supabase client + generated DB types

supabase/
  functions/              Deno edge functions
    parse-scoreboard/         Gemini Vision scoreboard parser
    create-checkout-session/  Stripe checkout
    stripe-webhook/           Stripe billing events
    backfill-teams/           One-off data migration job
    prune-screenshots/        Storage cleanup (keeps free-tier bucket under quota)
  migrations/             SQL schema history

extension/                Browser extension companion app

.github/workflows/        CI/scheduled jobs (Supabase keep-alive, screenshot pruning)
```

## Getting started

```bash
npm install
npm run dev
```

You'll need a `.env` with your own Supabase project credentials:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

Edge functions (`parse-scoreboard`, `create-checkout-session`, `stripe-webhook`) require their own secrets set in the Supabase dashboard (`GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, service role key, etc.) — they're not needed to run the frontend locally against an existing project.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint the codebase |

## Testing

```bash
npm run test
```
