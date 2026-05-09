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

function PlayerRow({
  player,
  isMe,
}: {
  player: ActivityGamePlayer;
  isMe: boolean;
}) {
  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 px-3 py-1.5 items-center text-xs",
      isMe ? "bg-primary/8 border-l-2 border-l-primary/60" : ""
    )}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("truncate", isMe ? "font-semibold" : "font-medium text-muted-foreground/90")}>
          {player.playerName || "—"}
        </span>
        {player.isMvp && (
          <span className="shrink-0 text-[8px] font-bold px-1 py-0.5 rounded-sm bg-yellow-400/15 text-yellow-400 leading-none">
            MVP
          </span>
        )}
      </div>
      <span className={cn("font-mono font-bold text-right w-9", isMe ? "text-foreground" : "text-foreground/70")}>{player.score}</span>
      <span className="font-mono text-rl-orange/80 text-right w-4">{player.goals}</span>
      <span className="font-mono text-rl-blue/80 text-right w-4">{player.assists}</span>
      <span className="font-mono text-cyan-400/80 text-right w-4">{player.saves}</span>
      <span className="font-mono text-muted-foreground/70 text-right w-4">{player.shots}</span>
    </div>
  );
}

function Scoreboard({
  players,
  currentUserId,
  result,
}: {
  players: ActivityGamePlayer[];
  currentUserId: string | null;
  result: "win" | "loss";
}) {
  // Group by team if team data present, otherwise show flat sorted list
  const hasTeams = players.some((p) => p.team != null);
  const myTeam = currentUserId ? players.find((p) => p.userId === currentUserId)?.team ?? null : null;

  let groups: { label: string; isMyTeam: boolean; players: ActivityGamePlayer[] }[];

  if (hasTeams && myTeam) {
    const myTeamPlayers = players.filter((p) => p.team === myTeam).sort((a, b) => b.score - a.score);
    const opponentPlayers = players.filter((p) => p.team !== myTeam).sort((a, b) => b.score - a.score);
    groups = [
      { label: result === "win" ? "Your Team  ·  WIN" : "Your Team  ·  LOSS", isMyTeam: true,  players: myTeamPlayers },
      { label: result === "win" ? "Opponents  ·  LOSS" : "Opponents  ·  WIN", isMyTeam: false, players: opponentPlayers },
    ];
  } else {
    groups = [{ label: "", isMyTeam: false, players: [...players].sort((a, b) => b.score - a.score) }];
  }

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border/30 bg-background/40">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 px-3 py-1 bg-muted/30 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Player</span>
        <span className="text-right w-9">Score</span>
        <span className="text-right w-4">G</span>
        <span className="text-right w-4">A</span>
        <span className="text-right w-4">SV</span>
        <span className="text-right w-4">SH</span>
      </div>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <div className={cn(
              "px-3 py-1 text-[9px] font-bold uppercase tracking-wider border-t border-border/20",
              group.isMyTeam
                ? "text-primary/80 bg-primary/5"
                : "text-muted-foreground bg-muted/10"
            )}>
              {group.label}
            </div>
          )}
          {group.players.map((p, i) => (
            <PlayerRow
              key={i}
              player={p}
              isMe={!!(currentUserId && p.userId === currentUserId)}
            />
          ))}
        </div>
      ))}
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
  const hasScore = game.teamGoals !== null && game.opponentGoals !== null;

  return (
    <div className="py-2.5">
      <button
        className="w-full flex gap-3 items-center text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Win/loss stripe */}
        <div className={cn("w-1 self-stretch rounded-full shrink-0", isWin ? "bg-rl-green" : "bg-rl-red")} />

        <div className="flex-1 min-w-0">
          {/* Top row: mode + time + expand indicator */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
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
            <div className="flex items-center gap-1 shrink-0 ml-2 text-muted-foreground">
              <span className="text-[10px]">{relativeDate(game.playedAt)}</span>
              {game.allPlayers.length > 0 && (
                expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
              )}
            </div>
          </div>

          {/* Main content row: goal score + player stats */}
          <div className="flex items-center gap-3">
            {/* Goal score — the game result */}
            {hasScore ? (
              <span className="font-display font-bold text-base leading-none shrink-0">
                <span className={isWin ? "text-rl-green" : "text-rl-red"}>{game.teamGoals}</span>
                <span className="text-muted-foreground mx-1">–</span>
                <span className="text-muted-foreground">{game.opponentGoals}</span>
              </span>
            ) : (
              <span className={cn("font-display font-bold text-sm shrink-0", isWin ? "text-rl-green" : "text-rl-red")}>
                {isWin ? "W" : "L"}
              </span>
            )}
            {/* Separator */}
            <span className="text-border/60 shrink-0">·</span>
            {/* Player stats */}
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="font-bold text-foreground/80">{game.score}</span>
              <span className="text-rl-orange">{game.goals}G</span>
              <span className="text-rl-blue">{game.assists}A</span>
              <span className="text-cyan-400">{game.saves}SV</span>
            </div>
          </div>
        </div>

        {/* W/L badge — only show if no numeric score */}
        {!hasScore && (
          <div className={cn(
            "flex items-center px-2 text-xs font-bold rounded-lg self-stretch shrink-0",
            isWin ? "bg-rl-green/10 text-rl-green" : "bg-rl-red/10 text-rl-red"
          )}>
            {isWin ? "W" : "L"}
          </div>
        )}
      </button>

      {/* Expanded scoreboard */}
      {expanded && game.allPlayers.length > 0 && (
        <Scoreboard
          players={game.allPlayers}
          currentUserId={currentUserId}
          result={game.result}
        />
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
          <span className="text-muted-foreground/50 normal-case font-normal">· tap to expand</span>
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
