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

function GameDot({ result }: { result: "win" | "loss" }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        result === "win" ? "bg-rl-green" : "bg-rl-red"
      )}
    />
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
  const isActive = roundResult?.isCurrentRound;
  const wins = roundResult?.games.filter((g) => g.result === "win").length ?? 0;
  const losses = roundResult?.games.filter((g) => g.result === "loss").length ?? 0;
  const isEliminated = losses >= 2 || (losses >= 1 && !isBo3);
  const isWon = isBo3 ? wins >= 2 : wins >= 1;
  const hasResult = !!roundResult && roundResult.games.length > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Round label */}
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
        {ROUND_SHORT[roundKey]}
      </span>

      {/* Result circle */}
      <div
        className={cn(
          "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all bg-background relative z-10",
          isActive && "border-yellow-400/60 bg-yellow-400/10 animate-pulse",
          !hasResult && !isActive && "border-border/40 bg-muted/20",
          hasResult && isWon && "border-rl-green/60 bg-rl-green/10",
          hasResult && isEliminated && "border-rl-red/60 bg-rl-red/10"
        )}
      >
        {!hasResult && !isActive && (
          <span className="text-[10px] text-muted-foreground font-bold">?</span>
        )}
        {isActive && !hasResult && (
          <span className="text-[10px] text-yellow-400 font-bold">–</span>
        )}
        {hasResult && isWon && (
          <span className="text-xs font-bold text-rl-green">W</span>
        )}
        {hasResult && isEliminated && (
          <span className="text-xs font-bold text-rl-red">L</span>
        )}
        {hasResult && !isWon && !isEliminated && (
          <span className="text-[10px] font-bold text-yellow-400">{wins}-{losses}</span>
        )}
      </div>

      {/* Bo3 game dots */}
      {isBo3 && hasResult && (
        <div className="flex gap-0.5 items-center">
          {[1, 2, 3].map((n) => {
            const game = roundResult?.games.find((g) => g.game_number === n);
            if (!game) return <span key={n} className="inline-block w-2 h-2 rounded-full bg-border/30" />;
            return <GameDot key={n} result={game.result} />;
          })}
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
