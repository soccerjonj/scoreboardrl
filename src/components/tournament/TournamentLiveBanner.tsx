import { useState } from "react";
import { Trophy, ChevronRight } from "lucide-react";
import { useTournamentSession, ROUND_LABELS, TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";
import TournamentModeSheet from "./TournamentModeSheet";

/**
 * Persistent global banner shown at the top of every page when a tournament is active.
 * Tapping the banner opens the full-screen TournamentModeSheet for live tournament progress.
 */
export default function TournamentLiveBanner() {
  const { activeTournament, isActive, currentRound } = useTournamentSession();
  const [open, setOpen] = useState(false);

  if (!isActive || !activeTournament) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2 border-b border-yellow-400/30 bg-gradient-to-r from-yellow-400/15 via-yellow-400/8 to-yellow-400/15 hover:from-yellow-400/20 hover:via-yellow-400/12 hover:to-yellow-400/20 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-yellow-400 shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-yellow-300 truncate">
            Tournament Active
          </span>
          <span className="text-xs text-yellow-400/70 truncate">
            · {activeTournament.game_mode} {TOURNAMENT_TYPE_LABELS[activeTournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? activeTournament.tournament_type}
            {currentRound && ` · ${ROUND_LABELS[currentRound]}`}
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-yellow-300 shrink-0">
          Open <ChevronRight className="w-3 h-3" />
        </span>
      </button>

      <TournamentModeSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
