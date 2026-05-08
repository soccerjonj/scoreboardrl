import { useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTournamentSession, ROUND_LABELS, TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";
import StartTournamentSheet from "./StartTournamentSheet";

export default function TournamentBannerCard() {
  const { activeTournament, isActive, currentRound } = useTournamentSession();
  const [showStart, setShowStart] = useState(false);

  if (isActive && activeTournament && currentRound) {
    return (
      <Card className="border-yellow-400/25 bg-yellow-400/5">
        <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-yellow-300 truncate">
                Tournament in progress
              </p>
              <p className="text-xs text-yellow-400/60 truncate">
                {activeTournament.game_mode} {TOURNAMENT_TYPE_LABELS[activeTournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS]}
                {" · "}{ROUND_LABELS[currentRound]}
              </p>
            </div>
          </div>
          <Link to="/tournaments" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-1 text-xs border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/10">
              View <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/40 bg-card/60 border-dashed">
        <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">Playing in a tournament?</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0 text-xs"
            onClick={() => setShowStart(true)}
          >
            <Trophy className="w-3 h-3" />
            Start
          </Button>
        </CardContent>
      </Card>

      <StartTournamentSheet open={showStart} onOpenChange={setShowStart} />
    </>
  );
}
