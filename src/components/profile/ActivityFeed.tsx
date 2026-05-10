import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Clock, ChevronRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CarryMeter } from "@/components/game/CarryMeter";
import type { ActivityGame, ActivityGamePlayer } from "@/types/profile";
import { getGameCategory, GAME_CATEGORY_LABELS, isSeriousCategory, EXTRA_MODE_LABELS } from "@/lib/gameModes";
import { TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";
import { relativeDate } from "@/lib/relativeDate";

function PlayerRow({
  player,
  isMe,
  teamSize,
}: {
  player: ActivityGamePlayer;
  isMe: boolean;
  teamSize: number;
}) {
  const showMeter = player.contributionScore > 0 && teamSize > 1;
  return (
    <div className={cn(
      "grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 py-1.5 items-start text-xs rounded-md",
      isMe ? "bg-primary/5" : ""
    )}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {(() => {
            const nameClasses = cn(
              "truncate text-xs font-medium leading-snug",
              isMe ? "text-primary font-semibold" : "text-foreground"
            );
            const display = player.playerName || "—";
            // Link the gamertag to that user's profile when they have a
            // ScoreboardRL account AND it isn't the row's own user.
            if (player.userId && !isMe) {
              return (
                <Link
                  to={`/profile/${player.userId}`}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(nameClasses, "hover:text-primary hover:underline transition-colors")}
                  title={`View ${display}'s profile`}
                >
                  {display}
                </Link>
              );
            }
            return <span className={nameClasses}>{display}</span>;
          })()}
          {player.isMvp && (
            <span className="shrink-0 text-[9px] text-yellow-400 font-bold leading-snug flex-shrink-0">
              MVP
            </span>
          )}
        </div>
        {showMeter && (
          <CarryMeter score={player.contributionScore} teamSize={teamSize} size="sm" />
        )}
      </div>
      <span className={cn("font-mono font-bold text-right leading-snug", isMe ? "text-foreground" : "text-foreground/80")}>{player.score}</span>
      <span className="font-mono text-muted-foreground text-right leading-snug">{player.goals}</span>
      <span className="font-mono text-muted-foreground text-right leading-snug">{player.assists}</span>
      <span className="font-mono text-muted-foreground text-right leading-snug">{player.saves}</span>
      <span className="font-mono text-muted-foreground text-right leading-snug">{player.shots}</span>
    </div>
  );
}

function Scoreboard({
  players,
  currentUserId,
  result,
  teamSize,
}: {
  players: ActivityGamePlayer[];
  currentUserId: string | null;
  result: "win" | "loss";
  teamSize: number;
}) {
  const hasTeams = players.some((p) => p.team != null);
  const myTeam = currentUserId ? players.find((p) => p.userId === currentUserId)?.team ?? null : null;

  let groups: { label: string; isMyTeam: boolean; players: ActivityGamePlayer[] }[];

  if (hasTeams && myTeam) {
    const myTeamPlayers    = players.filter((p) => p.team === myTeam).sort((a, b) => b.score - a.score);
    const opponentPlayers  = players.filter((p) => p.team !== myTeam).sort((a, b) => b.score - a.score);
    groups = [
      { label: result === "win" ? "Your Team  ·  WIN" : "Your Team  ·  LOSS", isMyTeam: true,  players: myTeamPlayers },
      { label: result === "win" ? "Opponents  ·  LOSS" : "Opponents  ·  WIN", isMyTeam: false, players: opponentPlayers },
    ];
  } else {
    groups = [{ label: "", isMyTeam: false, players: [...players].sort((a, b) => b.score - a.score) }];
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 pb-1.5 mb-0.5 border-b border-border/20">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
        <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
        <span className="text-[9px] text-muted-foreground font-semibold text-right">G</span>
        <span className="text-[9px] text-muted-foreground font-semibold text-right">A</span>
        <span className="text-[9px] text-muted-foreground font-semibold text-right">SV</span>
        <span className="text-[9px] text-muted-foreground font-semibold text-right">SH</span>
      </div>
      {groups.map((group, gi) => (
        <div key={gi} className="mb-1">
          {group.label && (
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 px-2",
              group.isMyTeam ? "text-primary/80" : "text-muted-foreground"
            )}>
              {group.label}
            </p>
          )}
          {group.players.map((p, i) => (
            <PlayerRow
              key={i}
              player={p}
              isMe={!!(currentUserId && p.userId === currentUserId)}
              teamSize={teamSize}
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
  viewerFriendIds,
}: {
  game: ActivityGame;
  currentUserId: string | null;
  viewerFriendIds?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isWin     = game.result === "win";
  const hasScore  = game.teamGoals !== null && game.opponentGoals !== null;
  const teamSize  = game.gameMode === "1v1" ? 1 : game.gameMode === "2v2" ? 2 : game.gameMode === "3v3" ? 3 : 4;

  // Determine the profile owner's team in this game (the row that matches currentUserId).
  // Then check if any other player on that team is a viewer's friend.
  const ownerTeam = currentUserId
    ? game.allPlayers.find((p) => p.userId === currentUserId)?.team ?? null
    : null;
  const hasFriendOnTeam = !!(viewerFriendIds && ownerTeam && game.allPlayers.some(
    (p) => p.team === ownerTeam && p.userId && p.userId !== currentUserId && viewerFriendIds.has(p.userId)
  ));

  // Derive game category for clear labeling
  const category = getGameCategory({
    game_type: game.gameType,
    game_mode: game.gameMode,
    tournament_type: game.tournamentType ?? null,
  });
  const categoryLabel = GAME_CATEGORY_LABELS[category];
  const isSerious = isSeriousCategory(category);

  // Detail line: "3v3 Soccar" for tournaments, "3v3 Rumble" for extra modes
  const detailLine = (() => {
    if (category === "tournament" || category === "special_tournament") {
      const ttLabel = game.tournamentType
        ? (TOURNAMENT_TYPE_LABELS[game.tournamentType as keyof typeof TOURNAMENT_TYPE_LABELS] ?? game.tournamentType)
        : "Tournament";
      return `${game.gameMode} ${ttLabel}`;
    }
    if (category === "extra_mode") {
      return EXTRA_MODE_LABELS[game.gameMode as keyof typeof EXTRA_MODE_LABELS] ?? game.gameMode;
    }
    return null;
  })();

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      isWin ? "border-rl-green/20" : "border-rl-red/20"
    )}>
      {/* Gradient top stripe */}
      <div className={cn(
        "h-0.5 w-full",
        isWin
          ? "bg-gradient-to-r from-rl-green/80 via-rl-green/40 to-transparent"
          : "bg-gradient-to-r from-rl-red/80 via-rl-red/40 to-transparent"
      )} />

      <CardContent className="py-3 px-4">
        {/* Main clickable row */}
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Glowing vertical bar */}
            <span className={cn(
              "w-1.5 h-8 rounded-full flex-shrink-0",
              isWin
                ? "bg-rl-green shadow-[0_0_8px_hsl(var(--rl-green)/0.6)]"
                : "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]"
            )} />

            <div className="min-w-0">
              {/* Top row: WIN/LOSS + mode badge + MVP + time */}
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={cn(
                  "font-display font-bold text-sm flex-shrink-0",
                  isWin ? "text-rl-green" : "text-rl-red"
                )}>
                  {isWin ? "WIN" : "LOSS"}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {game.gameMode}
                </Badge>
                <span
                  className={cn(
                    "text-[10px] flex-shrink-0",
                    isSerious ? "text-foreground/70 font-semibold" : "text-muted-foreground"
                  )}
                >
                  {categoryLabel}
                </span>
                {game.isMvp && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 flex-shrink-0">
                    MVP
                  </span>
                )}
                {hasFriendOnTeam && (
                  <Users className="w-3 h-3 text-primary/60 flex-shrink-0" aria-label="Played with a friend" />
                )}
              </div>

              {/* Stats row: goal score + player stats */}
              <div className="flex items-center gap-2">
                {hasScore && (
                  <>
                    <span className="font-display font-bold text-base leading-none shrink-0">
                      <span className={isWin ? "text-rl-green" : "text-rl-red"}>{game.teamGoals}</span>
                      <span className="text-muted-foreground mx-1">–</span>
                      <span className="text-muted-foreground">{game.opponentGoals}</span>
                    </span>
                    <span className="text-border/60 shrink-0">·</span>
                  </>
                )}
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span className="font-bold text-foreground/80">{game.score}</span>
                  <span className="text-rl-orange">{game.goals}G</span>
                  <span className="text-rl-blue">{game.assists}A</span>
                  <span className="text-cyan-400">{game.saves}SV</span>
                  {game.shots != null && <span className="text-muted-foreground">{game.shots}SH</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Right side: time + expand chevron */}
          <div className="flex items-center gap-2 shrink-0 ml-3 text-muted-foreground">
            <span className="text-xs">{relativeDate(game.playedAt)}</span>
            {game.allPlayers.length > 0 && (
              expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {/* Expanded scoreboard */}
        {expanded && game.allPlayers.length > 0 && (
          <>
            {detailLine && (
              <div className={cn(
                "mt-3 px-3 py-1.5 rounded-md border text-[11px] inline-flex items-center gap-1.5",
                category === "tournament"         && "bg-yellow-400/8 border-yellow-400/25 text-yellow-300",
                category === "special_tournament" && "bg-muted/40 border-border/40 text-muted-foreground",
                category === "extra_mode"         && "bg-muted/40 border-border/40 text-muted-foreground",
              )}>
                <span className="font-semibold">{categoryLabel}</span>
                <span className="opacity-60">·</span>
                <span>{detailLine}</span>
              </div>
            )}

            {/* Full-width "View tournament" CTA — very obvious affordance for
                navigating to the dedicated tournament page. Only shown for
                tournament games where we have the tournament id linked. */}
            {(category === "tournament" || category === "special_tournament") && game.tournamentId && (
              <Link
                to={`/tournaments?focus=${game.tournamentId}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "mt-2 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors",
                  category === "tournament"
                    ? "bg-yellow-400/8 border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/15 hover:border-yellow-400/50"
                    : "bg-card/60 border-border/50 text-foreground hover:bg-card/90 hover:border-border"
                )}
              >
                <span className="text-xs font-semibold">View full tournament stats</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
            <Scoreboard
              players={game.allPlayers}
              currentUserId={currentUserId}
              result={game.result}
              teamSize={teamSize}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Props = {
  games: ActivityGame[];
  currentUserId?: string | null;
  /** IDs of the viewer's accepted friends — used to flag games where one of them appeared on the profile owner's team. */
  viewerFriendIds?: Set<string>;
};

export default function ActivityFeed({ games, currentUserId = null, viewerFriendIds }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (games.length === 0) return null;

  const visible = showAll ? games : games.slice(0, 10);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
        <Clock className="w-3.5 h-3.5" />
        Recent Games
      </p>
      <div className="space-y-2">
        {visible.map((game) => (
          <GameCard key={game.id} game={game} currentUserId={currentUserId} viewerFriendIds={viewerFriendIds} />
        ))}
      </div>
      {games.length > 10 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {showAll ? "Show less" : `Show ${games.length - 10} more`}
        </button>
      )}
    </div>
  );
}
