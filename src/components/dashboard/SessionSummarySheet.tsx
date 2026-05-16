import { useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Share2, Copy, Loader2, Trophy, Frown } from "lucide-react";
import { CarryMeter } from "@/components/game/CarryMeter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatSessionDuration,
  buildSessionSummaryText,
  type SessionSummary,
} from "@/lib/sessionSummary";
import SessionShareCard from "./SessionShareCard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SessionSummary;
  rlName: string | null;
  onDismissSession: () => void;
}

const MODE_DISPLAY: Record<string, string> = {
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
  "4v4": "4v4",
  rumble_3v3: "3v3 Rumble",
  hoops_2v2: "2v2 Hoops",
  snowday_3v3: "3v3 Snow Day",
  dropshot_3v3: "3v3 Dropshot",
  heatseeker_2v2: "2v2 Heatseeker",
};

export default function SessionSummarySheet({
  open,
  onOpenChange,
  summary,
  rlName,
  onDismissSession,
}: Props) {
  const { toast } = useToast();
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const handleShareImage = async () => {
    const node = shareCardRef.current;
    if (!node) return;
    setSharing(true);
    try {
      // Two attempts: the first includes friend avatars. If a cross-origin
      // avatar taints the canvas (Supabase Storage not returning CORS headers
      // for that object), toBlob throws a SecurityError and we'd otherwise
      // hand the user a blank/failed share. Retry once with images skipped so
      // they still get a usable card (initials fallback render in their place
      // because the <img> simply won't be cloned).
      const baseOpts = {
        width: 1080,
        height: 1920,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0b0b12",
        // Applied to the cloned root — guarantees it renders at the
        // foreignObject origin rather than wherever it sat in the DOM.
        style: { position: "relative", left: "0", top: "0", margin: "0" },
      } as const;

      let blob: Blob | null = null;
      try {
        blob = await htmlToImage.toBlob(node, baseOpts);
      } catch (inner: any) {
        if (inner?.name === "SecurityError" || /tainted|insecure/i.test(inner?.message ?? "")) {
          blob = await htmlToImage.toBlob(node, {
            ...baseOpts,
            filter: (el: HTMLElement) => el.tagName !== "IMG",
          });
        } else {
          throw inner;
        }
      }
      if (!blob) throw new Error("Could not generate image");
      const dateStr = new Date(summary.lastGameAt).toISOString().slice(0, 10);
      const file = new File([blob], `scoreboardrl-session-${dateStr}.png`, {
        type: "image/png",
      });

      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "My ScoreboardRL session" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "Session card downloaded", description: "Share it anywhere you like." });
      }
    } catch (err: any) {
      // User-cancelled native share throws AbortError; suppress that.
      if (err?.name !== "AbortError") {
        toast({
          title: "Couldn't share image",
          description: err?.message ?? "Try the Copy text option instead.",
          variant: "destructive",
        });
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopyText = async () => {
    try {
      const text = buildSessionSummaryText(summary, rlName);
      await navigator.clipboard.writeText(text);
      toast({ title: "Session summary copied", description: "Paste it anywhere." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access was blocked by the browser.",
        variant: "destructive",
      });
    }
  };

  const handleDismissAndClose = () => {
    onDismissSession();
    onOpenChange(false);
  };

  const winRate = Math.round(summary.winRate);
  const durationLabel = formatSessionDuration(summary.durationMs);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-10 max-h-[92dvh] overflow-y-auto"
      >
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Session Summary
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {durationLabel} · {summary.games} games · ends {new Date(summary.lastGameAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </SheetHeader>

        {/* ── HERO RECAP ──────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border-2 p-5 mb-4",
            winRate >= 60
              ? "bg-gradient-to-br from-rl-green/15 via-rl-green/5 to-transparent border-rl-green/40"
              : winRate <= 40
                ? "bg-gradient-to-br from-rl-red/15 via-rl-red/5 to-transparent border-rl-red/40"
                : "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-primary/40"
          )}
        >
          <Sparkles className="absolute -right-2 -top-2 w-20 h-20 text-primary opacity-[0.06]" />

          {/* W/L dot history */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {summary.results.map((r, i) => (
              <span
                key={i}
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  r === "win"
                    ? "bg-rl-green shadow-[0_0_6px_hsl(var(--rl-green)/0.55)]"
                    : "bg-rl-red shadow-[0_0_6px_hsl(var(--rl-red)/0.45)]"
                )}
                title={r === "win" ? "Win" : "Loss"}
              />
            ))}
          </div>

          {/* Big numbers row */}
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="font-display text-4xl font-black leading-none tracking-tight tabular-nums">
                <span className="text-rl-green">{summary.wins}</span>
                <span className="text-muted-foreground/40 mx-2">–</span>
                <span className="text-rl-red">{summary.losses}</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mt-1.5">
                Wins · Losses
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-black leading-none text-primary tabular-nums">
                {winRate}
                <span className="text-2xl">%</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mt-1.5">
                Win Rate
              </p>
            </div>
          </div>

          {/* 5-col stat split */}
          <div className="grid grid-cols-5 divide-x divide-foreground/[0.06]">
            {[
              { label: "G",   value: summary.totals.goals,   avg: summary.averages.goalsPerGame,   color: "text-rl-orange" },
              { label: "A",   value: summary.totals.assists, avg: summary.averages.assistsPerGame, color: "text-rl-blue" },
              { label: "SV",  value: summary.totals.saves,   avg: summary.averages.savesPerGame,   color: "text-cyan-400" },
              { label: "SH",  value: summary.totals.shots,   avg: summary.averages.shotsPerGame,   color: "text-muted-foreground/80" },
              { label: "MVP", value: summary.totals.mvps,    avg: null,                            color: "text-yellow-400" },
            ].map(({ label, value, avg, color }) => (
              <div key={label} className="flex flex-col items-center justify-center px-1">
                <span className={cn("font-display font-bold text-2xl leading-none tabular-nums", color)}>
                  {value}
                </span>
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
                  {label}
                </span>
                {avg !== null && (
                  <span className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 tabular-nums">
                    {avg.toFixed(1)}/g
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Avg contribution — normalized to 100 = even team share, so it
              makes sense across mixed-mode sessions. Colored per CarryMeter
              thresholds. */}
          {summary.averages.contributionAvg > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Avg contribution
              </span>
              <span
                className={cn(
                  "ml-auto font-mono font-bold text-sm tabular-nums",
                  summary.averages.contributionAvg >= 120
                    ? "text-rl-purple"
                    : summary.averages.contributionAvg >= 90
                      ? "text-primary"
                      : "text-muted-foreground"
                )}
              >
                {Math.round(summary.averages.contributionAvg)}
                <span className="text-muted-foreground/60 text-xs ml-1">/ 100</span>
              </span>
            </div>
          )}
        </div>

        {/* ── BADGES ──────────────────────────────────────────────────── */}
        {(summary.badges.bestStreak >= 3 ||
          summary.badges.mvpCount > 0 ||
          summary.badges.hatTrickGames > 0 ||
          summary.badges.wallGames > 0 ||
          summary.badges.sniperShootingPct !== null) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {summary.badges.bestStreak >= 3 && (
              <span className="px-2.5 py-1 rounded-full bg-rl-orange/10 border border-rl-orange/30 text-rl-orange font-semibold text-xs">
                🔥 {summary.badges.bestStreak} streak
              </span>
            )}
            {summary.badges.mvpCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 font-semibold text-xs">
                🏆 {summary.badges.mvpCount} MVP{summary.badges.mvpCount === 1 ? "" : "s"}
              </span>
            )}
            {summary.badges.hatTrickGames > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rl-purple/10 border border-rl-purple/30 text-rl-purple font-semibold text-xs">
                ⚡ Hat trick
              </span>
            )}
            {summary.badges.wallGames > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-semibold text-xs">
                🛡 Wall
              </span>
            )}
            {summary.badges.sniperShootingPct !== null && (
              <span className="px-2.5 py-1 rounded-full bg-rl-blue/10 border border-rl-blue/30 text-rl-blue font-semibold text-xs">
                🎯 Sniper {Math.round(summary.badges.sniperShootingPct)}%
              </span>
            )}
          </div>
        )}

        {/* ── MODES BREAKDOWN ─────────────────────────────────────────── */}
        {summary.byMode.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 px-0.5">
              Modes
            </p>
            <div className="space-y-1.5">
              {summary.byMode.map((m) => {
                const wr = Math.round(m.winRate);
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/30 bg-card/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-display font-bold truncate">
                        {MODE_DISPLAY[m.modeLabel] ?? m.modeLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {m.categoryLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono tabular-nums">
                        <span className="text-rl-green font-bold">{m.wins}</span>
                        <span className="text-muted-foreground/60">-</span>
                        <span className="text-rl-red font-bold">{m.losses}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">
                        {wr}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PEAKS ──────────────────────────────────────────────────── */}
        {(summary.best || summary.worst) && summary.games >= 3 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 px-0.5">
              Peaks
            </p>
            <div className="space-y-2">
              {summary.best && (
                <MomentRow
                  icon={<Trophy className="w-4 h-4 text-yellow-400 shrink-0" />}
                  label="Best game"
                  moment={summary.best}
                  accent="text-yellow-400"
                />
              )}
              {summary.worst && summary.worst.gameId !== summary.best?.gameId && (
                <MomentRow
                  icon={<Frown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  label="Toughest game"
                  moment={summary.worst}
                  accent="text-muted-foreground"
                />
              )}
            </div>
          </div>
        )}

        {/* ── PLAYED WITH ────────────────────────────────────────────── */}
        {summary.friends.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 px-0.5">
              Played With
            </p>
            <div className="space-y-1.5">
              {summary.friends.map((f) => {
                const wr = Math.round(f.winRate);
                return (
                  <div
                    key={f.userId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-card/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {f.avatarUrl ? (
                        <img
                          src={f.avatarUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-8 h-8 rounded-full border border-border/40 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-display font-bold text-xs text-primary shrink-0">
                          {f.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-display font-bold truncate">{f.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {f.gamesTogether} game{f.gamesTogether === 1 ? "" : "s"} together
                          {f.mvps > 0 && (
                            <span className="text-yellow-400 font-bold ml-1.5">
                              · {f.mvps} MVP{f.mvps === 1 ? "" : "s"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold tabular-nums">
                          <span className="text-rl-green">{f.wins}</span>
                          <span className="text-muted-foreground/60">-</span>
                          <span className="text-rl-red">{f.losses}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{wr}%</p>
                      </div>
                      {f.contributionAvg > 0 && f.teamSize > 1 && (
                        <div className="w-16 shrink-0">
                          <CarryMeter
                            score={f.contributionAvg / f.teamSize}
                            teamSize={f.teamSize}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ACTIONS ────────────────────────────────────────────────── */}
        <div className="flex gap-2 mt-5">
          <Button
            variant="hero"
            className="flex-1 gap-2"
            onClick={handleShareImage}
            disabled={sharing}
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            {sharing ? "Preparing…" : "Share session card"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleCopyText}
          >
            <Copy className="w-4 h-4" />
            Copy text
          </Button>
        </div>
        <button
          type="button"
          onClick={handleDismissAndClose}
          className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Dismiss for this session
        </button>

        {/* Off-screen share card — html-to-image source */}
        <SessionShareCard ref={shareCardRef} summary={summary} rlName={rlName} />
      </SheetContent>
    </Sheet>
  );
}

function MomentRow({
  icon,
  label,
  moment,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  moment: NonNullable<SessionSummary["best"]>;
  accent: string;
}) {
  const isWin = moment.result === "win";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border/30 bg-card/40">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-wider", accent)}>{label}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {MODE_DISPLAY[moment.gameMode] ?? moment.gameMode}{" "}
            <span className={cn("font-bold", isWin ? "text-rl-green" : "text-rl-red")}>
              {isWin ? "WIN" : "LOSS"}
            </span>{" "}
            · {moment.teamGoalsFor}-{moment.teamGoalsAgainst}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-xs font-bold tabular-nums">{moment.score}</p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {moment.goals}G {moment.assists}A {moment.saves}SV
          {moment.isMvp && <span className="text-yellow-400 ml-1">★</span>}
        </p>
      </div>
    </div>
  );
}
