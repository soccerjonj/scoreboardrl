import { useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROUND_LABELS, ROUND_ORDER, TOURNAMENT_TYPE_LABELS, type RoundKey } from "@/hooks/useTournamentSession";
import { relativeDate } from "@/lib/relativeDate";
import { cn } from "@/lib/utils";

export type RecentTournament = {
  id: string;
  game_mode: string;
  tournament_type: string;
  status: string;
  outcome: string | null;
  current_round: string;
  created_at: string;
};

type Props = {
  tournaments: RecentTournament[];
  isOwnProfile: boolean;
};

/**
 * Recent Tournaments feed — mirrors the Recent Games card layout but for
 * the tournaments table. Each entry is a Link that opens the full
 * tournament view at /stats?view=tournaments&focus=<id> where users can
 * see the bracket, team stats, per-game scoreboards, etc.
 */
export default function RecentTournaments({ tournaments, isOwnProfile }: Props) {
  const [showAll, setShowAll] = useState(false);

  // Empty state — show CTA only on own profile
  if (tournaments.length === 0) {
    if (!isOwnProfile) return null;
    return (
      <Card className="border-border/50 bg-card/80 border-dashed">
        <CardContent className="pt-4 pb-3 text-center space-y-1.5">
          <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No tournaments yet</p>
          <Link to="/tournaments" className="text-xs text-primary hover:underline">
            Start a tournament →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const wins = tournaments.filter((t) => t.outcome === "winner").length;
  const visible = showAll ? tournaments : tournaments.slice(0, 5);

  return (
    <div className="space-y-1.5">
      {/* Section header — matches Activity Feed style */}
      <div className="px-0.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          Tournaments
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {tournaments.length} entered
          {wins > 0 && <span className="text-yellow-400 font-bold"> · {wins} {wins === 1 ? "win" : "wins"}</span>}
        </p>
      </div>

      {/* Tournament cards */}
      <div className="space-y-2">
        {visible.map((t) => (
          <TournamentRow key={t.id} tournament={t} />
        ))}
      </div>

      {tournaments.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {showAll ? "Show less" : `Show ${tournaments.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function TournamentRow({ tournament }: { tournament: RecentTournament }) {
  const isWinner = tournament.outcome === "winner";
  const isEliminated = tournament.outcome === "eliminated";
  const isActive = tournament.status === "active";
  const isSpecial = tournament.tournament_type !== "soccar";

  // Determine which round they reached / are in for the secondary line
  const roundIdx = ROUND_ORDER.indexOf(tournament.current_round as RoundKey);
  const reachedRoundLabel = roundIdx >= 0 ? ROUND_LABELS[ROUND_ORDER[roundIdx]] : "Round 1";

  // Color stripe + accent — same visual language as Recent Games WIN/LOSS
  const stripeColor = isWinner
    ? "bg-gradient-to-r from-yellow-400/80 via-yellow-400/40 to-transparent"
    : isActive
      ? "bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"
      : isEliminated
        ? "bg-gradient-to-r from-rl-red/60 via-rl-red/20 to-transparent"
        : "bg-gradient-to-r from-border/60 via-border/20 to-transparent";

  const cardBorder = isWinner
    ? "border-yellow-400/30"
    : isActive
      ? "border-primary/30"
      : "border-border/30";

  const barColor = isWinner
    ? "bg-yellow-400 shadow-[0_0_8px_rgb(250_204_21_/_0.6)]"
    : isActive
      ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
      : isEliminated
        ? "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]"
        : "bg-border";

  const typeLabel = TOURNAMENT_TYPE_LABELS[tournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? tournament.tournament_type;

  return (
    <Link
      to={`/stats?view=tournaments&focus=${tournament.id}`}
      className={cn(
        "block transition-all duration-200 hover:scale-[1.005] active:scale-[0.995]"
      )}
    >
      <Card className={cn("overflow-hidden transition-colors hover:border-foreground/30", cardBorder)}>
        <div className={cn("h-0.5 w-full", stripeColor)} />
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Glowing vertical bar matching Recent Games */}
              <span className={cn("w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5", barColor)} />

              <div className="min-w-0 flex-1">
                {/* Top row: game mode + type + Special / Champion / Live / Out */}
                <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden mb-1">
                  <span className="font-display font-bold text-sm flex-shrink-0">
                    {tournament.game_mode} {typeLabel}
                  </span>
                  {isSpecial && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border/50 flex-shrink-0">
                      Special
                    </Badge>
                  )}
                  {isWinner && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/30 flex-shrink-0 font-bold">
                      Champion
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30 animate-pulse flex-shrink-0">
                      Live
                    </Badge>
                  )}
                </div>

                {/* Bottom row: outcome detail + date */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isWinner ? (
                    <span className="text-yellow-400/80 font-semibold">Won the final</span>
                  ) : isActive ? (
                    <span className="text-primary/80 font-semibold">In progress · {reachedRoundLabel}</span>
                  ) : isEliminated ? (
                    <span className="text-rl-red/80 font-semibold">Out in {reachedRoundLabel}</span>
                  ) : (
                    <span>{reachedRoundLabel}</span>
                  )}
                  <span className="text-border/60">·</span>
                  <span>{relativeDate(tournament.created_at)}</span>
                </div>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
