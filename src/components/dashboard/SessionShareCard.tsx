import { forwardRef } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatSessionDuration,
  type SessionSummary,
} from "@/lib/sessionSummary";

interface Props {
  summary: SessionSummary;
  rlName: string | null;
}

/**
 * The high-resolution portrait card we serialize to a PNG for sharing.
 * Rendered into the DOM but positioned off-screen — its only consumer is
 * html-to-image. Fixed 1080 × 1920 dimensions so the export is predictable
 * regardless of the user's viewport.
 *
 * Visual notes:
 *  • Heavy gradient frame so the export pops in a chat.
 *  • Stats use the same RL color tokens as the rest of the app for
 *    instant recognition.
 *  • ScoreboardRL watermark + the user's RL handle anchor it as theirs.
 */
const SessionShareCard = forwardRef<HTMLDivElement, Props>(({ summary, rlName }, ref) => {
  const winRate = Math.round(summary.winRate);
  const durationLabel = formatSessionDuration(summary.durationMs);

  // Top mode (most played) gets a hero line below the headline
  const topMode = summary.byMode[0] ?? null;
  const topModeLabel = topMode ? `${topMode.modeLabel} ${topMode.categoryLabel}` : null;

  return (
    <div
      ref={ref}
      // Off-screen by default; the parent flips visibility before capture.
      style={{ width: 1080, height: 1920, position: "fixed", left: -99999, top: 0 }}
      className="bg-background text-foreground font-sans"
    >
      {/* Outer glow frame */}
      <div className="w-full h-full p-12 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.18),_transparent_55%),_radial-gradient(ellipse_at_bottom,_hsl(var(--rl-purple)/0.15),_transparent_55%)]">
        <div className="w-full h-full rounded-[40px] border-2 border-primary/30 bg-card/95 p-14 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-9 h-9 text-primary" />
              <span className="text-[28px] uppercase tracking-[0.35em] font-bold text-primary">
                Session Recap
              </span>
            </div>
            <span className="text-[24px] text-muted-foreground font-mono">
              {durationLabel} · {summary.games} games
            </span>
          </div>

          {/* Headline W-L block */}
          <div className="mt-16 flex items-end justify-between gap-8">
            <div>
              <p className="font-display text-[160px] font-black leading-none tracking-tight">
                <span className="text-rl-green">{summary.wins}</span>
                <span className="text-muted-foreground/40 mx-3">–</span>
                <span className="text-rl-red">{summary.losses}</span>
              </p>
              <p className="text-[36px] uppercase tracking-[0.2em] text-muted-foreground font-bold mt-3">
                Wins · Losses
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-[140px] font-black text-primary leading-none tabular-nums">
                {winRate}<span className="text-[80px]">%</span>
              </p>
              <p className="text-[32px] uppercase tracking-[0.2em] text-muted-foreground font-bold mt-3">
                Win Rate
              </p>
            </div>
          </div>

          {/* W/L dots */}
          <div className="mt-10 flex items-center gap-3 flex-wrap">
            {summary.results.map((r, i) => (
              <span
                key={i}
                className={cn(
                  "w-7 h-7 rounded-full",
                  r === "win"
                    ? "bg-rl-green shadow-[0_0_20px_hsl(var(--rl-green)/0.6)]"
                    : "bg-rl-red shadow-[0_0_20px_hsl(var(--rl-red)/0.5)]"
                )}
              />
            ))}
          </div>

          {/* 5-col stat grid */}
          <div className="mt-12 grid grid-cols-5 divide-x divide-border/30">
            {[
              { label: "Goals",   value: summary.totals.goals,   avg: summary.averages.goalsPerGame,   color: "text-rl-orange" },
              { label: "Assists", value: summary.totals.assists, avg: summary.averages.assistsPerGame, color: "text-rl-blue" },
              { label: "Saves",   value: summary.totals.saves,   avg: summary.averages.savesPerGame,   color: "text-cyan-400" },
              { label: "Shots",   value: summary.totals.shots,   avg: summary.averages.shotsPerGame,   color: "text-muted-foreground" },
              { label: "MVPs",    value: summary.totals.mvps,    avg: null,                            color: "text-yellow-400" },
            ].map(({ label, value, avg, color }) => (
              <div key={label} className="flex flex-col items-center justify-center px-3">
                <span className={cn("font-display font-black text-[96px] leading-none tabular-nums", color)}>
                  {value}
                </span>
                <span className="text-[24px] uppercase tracking-[0.2em] text-muted-foreground font-bold mt-4">
                  {label}
                </span>
                {avg !== null && (
                  <span className="text-[22px] font-mono text-muted-foreground/80 mt-2 tabular-nums">
                    {avg.toFixed(1)}/g
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Friends row (only if any) */}
          {summary.friends.length > 0 && (
            <div className="mt-12">
              <p className="text-[26px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-5">
                Played With
              </p>
              <div className="space-y-3">
                {summary.friends.slice(0, 3).map((f) => (
                  <div
                    key={f.userId}
                    className="flex items-center justify-between px-6 py-4 rounded-2xl bg-muted/30 border border-border/40"
                  >
                    <div className="flex items-center gap-5">
                      {f.avatarUrl ? (
                        <img
                          src={f.avatarUrl}
                          alt=""
                          crossOrigin="anonymous"
                          className="w-16 h-16 rounded-full border-2 border-primary/40 object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-display font-bold text-[28px] text-primary">
                          {f.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[34px] font-display font-bold">
                        {f.displayName}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[36px] font-bold tabular-nums">
                        <span className="text-rl-green">{f.wins}</span>
                        <span className="text-muted-foreground/60">-</span>
                        <span className="text-rl-red">{f.losses}</span>
                      </p>
                      <p className="text-[22px] text-muted-foreground font-mono mt-1">
                        {Math.round(f.winRate)}% · {f.gamesTogether} games
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top mode hero line + badges row */}
          {(topModeLabel || summary.badges.bestStreak >= 3 || summary.badges.mvpCount > 0) && (
            <div className="mt-auto pt-12">
              <div className="flex items-end justify-between gap-6 flex-wrap">
                {topModeLabel && (
                  <p className="text-[28px] text-muted-foreground">
                    Most played: <span className="text-foreground font-bold">{topModeLabel}</span>
                    {topMode && (
                      <span className="ml-3 text-rl-green font-bold">
                        {topMode.wins}-{topMode.losses}
                      </span>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {summary.badges.bestStreak >= 3 && (
                    <span className="px-5 py-2 rounded-full bg-rl-orange/15 border border-rl-orange/40 text-rl-orange font-bold text-[24px]">
                      🔥 {summary.badges.bestStreak} streak
                    </span>
                  )}
                  {summary.badges.mvpCount > 0 && (
                    <span className="px-5 py-2 rounded-full bg-yellow-400/15 border border-yellow-400/40 text-yellow-400 font-bold text-[24px]">
                      🏆 {summary.badges.mvpCount} MVP{summary.badges.mvpCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {summary.badges.hatTrickGames > 0 && (
                    <span className="px-5 py-2 rounded-full bg-rl-purple/15 border border-rl-purple/40 text-rl-purple font-bold text-[24px]">
                      ⚡ Hat trick
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Watermark footer */}
          <div className="mt-10 pt-8 border-t-2 border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Trophy className="w-10 h-10 text-primary" />
              <span className="font-display font-black text-[34px] tracking-tight">
                ScoreboardRL
              </span>
            </div>
            {rlName && (
              <span className="text-[28px] text-muted-foreground font-mono">@{rlName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

SessionShareCard.displayName = "SessionShareCard";
export default SessionShareCard;
