import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ROUND_LABELS, type RoundKey } from "@/hooks/useTournamentSession";
import type { TournamentSummary } from "@/types/profile";

type Props = {
  tournaments: TournamentSummary | null;
  isOwnProfile: boolean;
};

export default function TrophyShelf({ tournaments, isOwnProfile }: Props) {
  // Loading/unavailable
  if (tournaments === null) return null;

  // No tournaments yet on a friend profile — show nothing
  if (tournaments.totalEntered === 0 && !isOwnProfile) return null;

  // No tournaments yet on own profile — CTA
  if (tournaments.totalEntered === 0 && isOwnProfile) {
    return (
      <Card className="border-border/50 bg-card/80 border-dashed">
        <CardContent className="pt-4 pb-3 text-center space-y-1.5">
          <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No tournament trophies yet</p>
          <Link to="/tournaments" className="text-xs text-primary hover:underline">
            Start a tournament →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const bestRoundLabel = tournaments.highestRoundReached
    ? ROUND_LABELS[tournaments.highestRoundReached]
    : "—";

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          Tournament History
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-3 divide-x divide-white/[0.05] mb-3">
          {[
            { label: "Entered", value: tournaments.totalEntered },
            { label: "Champion", value: tournaments.wins, highlight: tournaments.wins > 0 },
            { label: "Best Round", value: bestRoundLabel, isText: true },
          ].map(({ label, value, highlight, isText }) => (
            <div key={label} className="flex flex-col items-center py-2">
              <span className={`font-display font-bold ${isText ? "text-sm" : "text-xl"} leading-tight ${highlight ? "text-yellow-400" : "text-foreground"}`}>
                {value}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Trophy icons */}
        {tournaments.wins > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: Math.min(tournaments.wins, 5) }).map((_, i) => (
              <span key={i} className="text-2xl" role="img" aria-label="trophy">🏆</span>
            ))}
            {tournaments.wins > 5 && (
              <span className="text-sm text-muted-foreground">+{tournaments.wins - 5} more</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
