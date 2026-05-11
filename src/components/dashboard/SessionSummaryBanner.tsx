import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SESSION_GAP_MS, getSessionGames } from "@/lib/session";
import { buildSessionSummary, type SessionGame } from "@/lib/sessionSummary";
import type { PlayerMatchTarget } from "@/lib/playerMatch";
import type { FriendProfileInfo } from "@/lib/sessionSummary";

// Lazy: html-to-image (~30 kB) only loads when the user actually opens the
// sheet, keeping the initial Dashboard bundle lean.
const SessionSummarySheet = lazy(() => import("./SessionSummarySheet"));

const DISMISSED_KEY = "session_summary_dismissed_game_id";

interface Props {
  games: SessionGame[];
  userTarget: PlayerMatchTarget;
  friendProfiles: Map<string, FriendProfileInfo>;
  rlName: string | null;
}

/**
 * Compact dashboard CTA shown when the current session has ≥2 logged games.
 * One row, dashed border, dismissible. Tapping the chevron opens the full
 * session-summary sheet. Dismissal is per-latest-game (localStorage), so the
 * banner only reappears once a NEW game lands.
 */
export default function SessionSummaryBanner({
  games,
  userTarget,
  friendProfiles,
  rlName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dismissedGameId, setDismissedGameId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(DISMISSED_KEY);
  });

  const sessionGames = useMemo(() => getSessionGames(games), [games]);

  // newest-first within session — the "latest game" of the session
  const latestGameId = useMemo(() => {
    if (sessionGames.length === 0) return null;
    const sorted = [...sessionGames].sort(
      (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    );
    return sorted[0].id;
  }, [sessionGames]);

  const summary = useMemo(
    () =>
      sessionGames.length >= 2
        ? buildSessionSummary(sessionGames, userTarget, friendProfiles)
        : null,
    [sessionGames, userTarget, friendProfiles]
  );

  // Auto-show the sheet if it was just opened by code (e.g. deep-link). Not
  // needed today but here for future hookup. No-op for now.
  useEffect(() => { /* placeholder */ }, []);

  const dismiss = () => {
    if (latestGameId) {
      window.localStorage.setItem(DISMISSED_KEY, latestGameId);
      setDismissedGameId(latestGameId);
    }
  };

  // Render gates — must come AFTER all hooks
  if (!summary) return null;
  if (latestGameId && dismissedGameId === latestGameId) return null;
  // Banner is contextual — only show while the user is plausibly still in
  // (or just wrapping up) the session. If the most recent game is older
  // than SESSION_GAP_MS, the framing "done playing?" no longer fits.
  const latestPlayedMs = new Date(summary.lastGameAt).getTime();
  if (Date.now() - latestPlayedMs > SESSION_GAP_MS) return null;

  const winRate = Math.round(summary.winRate);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full rounded-xl border border-dashed border-primary/30 bg-card/60",
          "px-4 py-2.5 flex items-center justify-between gap-3 text-left",
          "hover:border-primary/50 hover:bg-card/80 transition-colors group"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Session</span>
          <span className="text-border/60 shrink-0">·</span>
          <span className="text-xs font-mono tabular-nums shrink-0">
            <span className="text-rl-green font-bold">{summary.wins}W</span>
            <span className="text-muted-foreground/60 mx-0.5">-</span>
            <span className="text-rl-red font-bold">{summary.losses}L</span>
          </span>
          <span className="text-border/60 shrink-0">·</span>
          <span className="text-xs font-semibold text-foreground shrink-0">{winRate}%</span>
          <span className="text-border/60 shrink-0 hidden sm:inline">·</span>
          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
            {summary.games} games
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
            View →
          </span>
          <span
            role="button"
            aria-label="Dismiss session summary"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                dismiss();
              }
            }}
            className="ml-1 p-1 rounded hover:bg-muted/50 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>

      {open && (
        <Suspense fallback={null}>
          <SessionSummarySheet
            open={open}
            onOpenChange={setOpen}
            summary={summary}
            rlName={rlName}
            onDismissSession={dismiss}
          />
        </Suspense>
      )}
    </>
  );
}
