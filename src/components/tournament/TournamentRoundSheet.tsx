import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trophy, ChevronRight } from "lucide-react";
import { ROUND_LABELS, ROUND_ORDER, RoundKey, LinkGameResult } from "@/hooks/useTournamentSession";
import BracketTree, { RoundResult } from "./BracketTree";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkResult: LinkGameResult | null;
  bracketRounds: RoundResult[];
  outcome?: string | null;
}

export default function TournamentRoundSheet({
  open,
  onOpenChange,
  linkResult,
  bracketRounds,
  outcome,
}: Props) {
  const navigate = useNavigate();

  if (!linkResult) return null;

  const isChampion = linkResult.action === "champion";
  const isEliminated = linkResult.action === "eliminated";
  const isAdvanced = linkResult.action === "advanced";
  const isBo3Continue = linkResult.action === "bo3_continue";

  const handleDone = () => {
    onOpenChange(false);
    navigate("/dashboard");
  };

  const handleLogNext = () => {
    onOpenChange(false);
    navigate("/log-game");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            {isChampion && <Trophy className="w-5 h-5 text-yellow-400" />}
            {isChampion ? "Tournament Champion!" : "Round Result"}
          </SheetTitle>
        </SheetHeader>

        {/* Result banner */}
        <div className={cn(
          "rounded-xl px-4 py-3 mb-5 flex items-center gap-3",
          isChampion && "bg-yellow-400/10 border border-yellow-400/30",
          isEliminated && "bg-rl-red/10 border border-rl-red/20",
          isAdvanced && "bg-rl-green/10 border border-rl-green/20",
          isBo3Continue && "bg-primary/10 border border-primary/20",
        )}>
          {isChampion && (
            <>
              <span className="text-2xl">🏆</span>
              <div>
                <p className="font-display font-bold text-yellow-400">Champion!</p>
                <p className="text-xs text-muted-foreground">You won the tournament</p>
              </div>
            </>
          )}
          {isEliminated && (
            <>
              <span className="text-xl">✗</span>
              <div>
                <p className="font-display font-bold text-rl-red">Eliminated</p>
                <p className="text-xs text-muted-foreground">
                  In {ROUND_LABELS[linkResult.round]}
                </p>
              </div>
            </>
          )}
          {isAdvanced && (
            <>
              <span className="text-xl text-rl-green">✓</span>
              <div>
                <p className="font-display font-bold text-rl-green">WIN — Advancing!</p>
                <p className="text-xs text-muted-foreground">
                  Next up: {ROUND_LABELS[linkResult.nextRound]}
                </p>
              </div>
            </>
          )}
          {isBo3Continue && (
            <>
              <span className="text-xl">⚡</span>
              <div>
                <p className="font-display font-bold text-primary">
                  Series {linkResult.wins} – {linkResult.losses}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ROUND_LABELS[linkResult.round]} continues — log next game
                </p>
              </div>
            </>
          )}
        </div>

        {/* Mini bracket */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Your Bracket
          </p>
          <BracketTree rounds={bracketRounds} outcome={outcome} />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isBo3Continue ? (
            <>
              <Button variant="outline" className="flex-1" onClick={handleDone}>
                Dashboard
              </Button>
              <Button variant="hero" className="flex-1 gap-1.5" onClick={handleLogNext}>
                Log Next Game <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          ) : isAdvanced ? (
            <>
              <Button variant="outline" className="flex-1" onClick={handleDone}>
                Dashboard
              </Button>
              <Button variant="hero" className="flex-1 gap-1.5" onClick={handleLogNext}>
                Log {ROUND_LABELS[linkResult.nextRound]} <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button variant="hero" className="w-full" onClick={handleDone}>
              View Dashboard
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
