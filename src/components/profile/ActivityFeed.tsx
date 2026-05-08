import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityGame } from "@/types/profile";

function relativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  60) return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function GameCard({ game }: { game: ActivityGame }) {
  const isWin = game.result === "win";
  return (
    <div className="flex gap-3 items-stretch py-2.5">
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
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
            {relativeDate(game.playedAt)}
          </span>
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
    </div>
  );
}

type Props = {
  games: ActivityGame[];
};

export default function ActivityFeed({ games }: Props) {
  if (games.length === 0) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Recent Games
        </p>
        <div className="divide-y divide-white/[0.04]">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
