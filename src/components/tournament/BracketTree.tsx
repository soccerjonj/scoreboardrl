import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import {
  ROUND_ORDER,
  ROUND_SHORT,
  ROUND_LABELS,
  RoundKey,
} from "@/hooks/useTournamentSession";

export type RoundResult = {
  round: RoundKey;
  games: Array<{ result: "win" | "loss"; game_number: number }>;
  isCurrentRound?: boolean;
};

interface Props {
  rounds: RoundResult[];
  outcome?: string | null;
  className?: string;
}

/**
 * Bo3 rounds (Semi-Final / Final) render as a segmented ring with three
 * colored arcs — one per game in the series. Each arc is green for a
 * win, red for a loss, and faded grey when the game hasn't been played
 * yet. Reads the entire series from the circle alone.
 */
function Bo3SegmentedRing({
  games,
  hasResult,
  isActive,
  centerContent,
}: {
  games: Array<{ result: "win" | "loss"; game_number: number }>;
  hasResult: boolean;
  isActive: boolean;
  centerContent: React.ReactNode;
}) {
  // SVG geometry — we render in a 40x40 viewBox and then size via Tailwind
  const r = 17;
  const cx = 20;
  const cy = 20;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * r;
  const segmentArc = circumference / 3;
  const gap = 5; // visual spacing between segments

  const segments = [1, 2, 3].map((n) => games.find((g) => g.game_number === n));

  return (
    <div
      className={cn(
        "relative w-9 h-9 sm:w-10 sm:h-10 z-10",
        isActive && !hasResult && "animate-pulse"
      )}
    >
      <svg viewBox="0 0 40 40" className="w-full h-full">
        {[0, 1, 2].map((i) => {
          const game = segments[i];
          const color = game
            ? (game.result === "win" ? "hsl(var(--rl-green))" : "hsl(var(--rl-red))")
            : "hsl(var(--border))";
          const opacity = game ? 1 : 0.45;

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentArc - gap} ${circumference - segmentArc + gap}`}
              strokeDashoffset={-(i * segmentArc + gap / 2)}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={opacity}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {centerContent}
      </div>
    </div>
  );
}

function RoundNode({
  roundKey,
  roundResult,
}: {
  roundKey: RoundKey;
  roundResult?: RoundResult;
}) {
  const isBo3 = roundKey === "semi_final" || roundKey === "final";
  const isActive = !!roundResult?.isCurrentRound;
  const wins = roundResult?.games.filter((g) => g.result === "win").length ?? 0;
  const losses = roundResult?.games.filter((g) => g.result === "loss").length ?? 0;
  const isEliminated = losses >= 2 || (losses >= 1 && !isBo3);
  const isWon = isBo3 ? wins >= 2 : wins >= 1;
  const hasResult = !!roundResult && roundResult.games.length > 0;

  // Center label content — same in both Bo3 and single-game variants
  const centerContent = !hasResult && !isActive ? (
    <span className="text-[10px] text-muted-foreground font-bold">?</span>
  ) : isActive && !hasResult ? (
    <span className="text-[10px] text-yellow-400 font-bold">–</span>
  ) : hasResult && isWon ? (
    <span className="text-xs font-bold text-rl-green">W</span>
  ) : hasResult && isEliminated ? (
    <span className="text-xs font-bold text-rl-red">L</span>
  ) : hasResult ? (
    <span className="text-[10px] font-bold text-yellow-400">{wins}-{losses}</span>
  ) : null;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Round label */}
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
        {ROUND_SHORT[roundKey]}
      </span>

      {isBo3 ? (
        <Bo3SegmentedRing
          games={roundResult?.games ?? []}
          hasResult={hasResult}
          isActive={isActive}
          centerContent={centerContent}
        />
      ) : (
        <div
          className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all bg-background relative z-10",
            isActive && "border-yellow-400/60 bg-yellow-400/10 animate-pulse",
            !hasResult && !isActive && "border-border/40 bg-muted/20",
            hasResult && isWon && "border-rl-green/60 bg-rl-green/10",
            hasResult && isEliminated && "border-rl-red/60 bg-rl-red/10"
          )}
        >
          {centerContent}
        </div>
      )}
    </div>
  );
}

export default function BracketTree({ rounds, outcome, className }: Props) {
  const roundMap = new Map(rounds.map((r) => [r.round, r]));

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {/* Round nodes — responsive 5-column grid (no horizontal scroll on phones) */}
      <div className="relative grid grid-cols-5 gap-1">
        {/* Single connector line drawn behind the circles. Each cell is 20%
            wide; nodes are centered within their cell, so the centers sit at
            10%, 30%, 50%, 70%, 90%. The line spans 10% to 90%. */}
        <div
          aria-hidden
          className="absolute h-[2px] bg-border/40 z-0"
          style={{
            top: "calc(0.625rem + 0.25rem + 1.125rem)", // label height + gap + half-circle (≈mid of circle)
            left: "10%",
            right: "10%",
          }}
        />
        {ROUND_ORDER.map((roundKey) => (
          <div key={roundKey} className="relative">
            <RoundNode roundKey={roundKey} roundResult={roundMap.get(roundKey)} />
          </div>
        ))}
      </div>

      {/* Full round names — same grid so labels align under their nodes */}
      <div className="grid grid-cols-5 gap-1">
        {ROUND_ORDER.map((roundKey) => {
          const result = roundMap.get(roundKey);
          const hasResult = result && result.games.length > 0;
          return (
            <p
              key={roundKey}
              className={cn(
                "text-[8px] leading-tight text-center px-0.5",
                hasResult ? "text-foreground/70" : "text-muted-foreground/40"
              )}
            >
              {ROUND_LABELS[roundKey]}
            </p>
          );
        })}
      </div>

      {/* Outcome badge */}
      {outcome === "winner" && (
        <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">Tournament Champion!</span>
        </div>
      )}
      {outcome === "eliminated" && (
        <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-rl-red/10 border border-rl-red/20">
          <span className="text-sm text-rl-red">
            Eliminated in {ROUND_LABELS[rounds.at(-1)?.round ?? "round_1"]}
          </span>
        </div>
      )}
    </div>
  );
}
