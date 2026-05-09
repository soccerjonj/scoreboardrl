import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ActivityGame, ActivityGamePlayer } from "@/types/profile";

function relativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  60) return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  return format(new Date(isoString), "MMM d");
}

function Scoreboard({
  players,
  currentUserId,
}: {
  players: ActivityGamePlayer[];
  currentUserId: string | null;
}) {
  // Sort by score descending
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border/30">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Player</span>
        <span className="text-right w-9">Score</span>
        <span className="text-right w-5">G</span>
        <span className="text-right w-5">A</span>
        <span className="text-right w-5">S</span>
      </div>
      {sorted.map((p, i) => {
        const isMe = currentUserId && p.userId === currentUserId;
        return (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 items-center text-xs border-t border-border/20",
              isMe
                ? "bg-primary/5 border-l-2 border-l-primary/50"
                : "bg-background/30"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate">{p.playerName || "—"}</span>
              {p.isMvp && (
                <span className="shrink-0 text-[8px] font-bold px-1 py-0.5 rounded-sm bg-yellow-400/15 text-yellow-400 leading-none">
                  MVP
                </span>
              )}
            </div>
            <span className="font-mono font-bold text-right w-9">{p.score}</span>
            <span className="font-mono text-rl-orange text-right w-5">{p.goals}</span>
            <span className="font-mono text-rl-blue text-right w-5">{p.assists}</span>
            <span className="font-mono text-cyan-400 text-right w-5">{p.saves}</span>
          </div>
        );
      })}
    </div>
  );
}

function GameCard({
  game,
  currentUserId,
}: {
  game: ActivityGame;
  currentUserId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isWin = game.result === "win";

  return (
    <div className="py-2.5">
      <button
        className="w-full flex gap-3 items-stretch text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Win/loss stripe */}
        <div className={cn("w-1 rounded-full shrink-0", isWin ? "bg-rl-green" : "bg-rl-red")} />

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                {game.gameMode}
              </span>
              <span className="text-[10px] text-muted-foreground capitalize">{game.gameType}</span>
              {game.isMvp && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400">
                  MVP
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span className="text-[10px] text-muted-foreground">{relativeDate(game.playedAt)}</span>
              {game.allPlayers.length > 0 && (
                expanded
                  ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                  : <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </div>
          {/* Stats row */}
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="font-bold text-foreground/90">{game.score}</span>
            <span className="text-rl-orange">{game.goals}G</span>
            <span className="text-rl-blue">{game.assists}A</span>
            <span className="text-cyan-400">{game.saves}S</span>
          </div>
        </div>

        {/* W/L badge */}
        <div className={cn(
          "flex items-center px-2.5 text-xs font-bold rounded-lg self-stretch shrink-0",
          isWin ? "bg-rl-green/10 text-rl-green" : "bg-rl-red/10 text-rl-red"
        )}>
          {isWin ? "W" : "L"}
        </div>
      </button>

      {/* Expanded scoreboard */}
      {expanded && game.allPlayers.length > 0 && (
        <Scoreboard players={game.allPlayers} currentUserId={currentUserId} />
      )}
    </div>
  );
}

type Props = {
  games: ActivityGame[];
  currentUserId?: string | null;
};

export default function ActivityFeed({ games, currentUserId = null }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (games.length === 0) return null;

  const visible = showAll ? games : games.slice(0, 10);

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Recent Games
          <span className="text-muted-foreground/60 normal-case font-normal">· tap to expand scoreboard</span>
        </p>
        <div className="divide-y divide-white/[0.04]">
          {visible.map((game) => (
            <GameCard key={game.id} game={game} currentUserId={currentUserId} />
          ))}
        </div>
        {games.length > 10 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            {showAll ? "Show less" : `Show ${games.length - 10} more`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
