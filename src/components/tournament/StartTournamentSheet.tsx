import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, ChevronLeft } from "lucide-react";
import { useTournamentSession, TournamentType, TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];

const TOURNAMENT_TYPE_ICONS: Record<TournamentType, string> = {
  soccar: "⚽",
  pentathlon: "🏅",
  heatseeker: "🔥",
  rumble: "⚡",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StartTournamentSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startTournament } = useTournamentSession();

  const [step, setStep] = useState<"mode" | "type">("mode");
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [starting, setStarting] = useState(false);

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    setStep("type");
  };

  const handleTypeSelect = async (type: TournamentType) => {
    if (!selectedMode) return;
    setStarting(true);
    try {
      await startTournament(selectedMode, type);
      onOpenChange(false);
      setStep("mode");
      setSelectedMode(null);
      navigate("/log-game");
    } catch {
      toast({ title: "Failed to start tournament", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleBack = () => {
    setStep("mode");
    setSelectedMode(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("mode");
    setSelectedMode(null);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            {step === "type" && (
              <button onClick={handleBack} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Trophy className="w-5 h-5 text-yellow-400" />
            {step === "mode" ? "Start Tournament" : `${selectedMode} Tournament`}
          </SheetTitle>
        </SheetHeader>

        {step === "mode" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Choose your team size:</p>
            <div className="grid grid-cols-2 gap-3">
              {(["2v2", "3v3"] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border border-border/60 bg-card/60 hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <span className="font-display font-bold text-2xl text-primary">{mode}</span>
                  <span className="text-xs text-muted-foreground">Tournament</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Choose the tournament variant:</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(TOURNAMENT_TYPE_LABELS) as TournamentType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeSelect(type)}
                  disabled={starting}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-xl border border-border/60 bg-card/60",
                    "hover:border-primary/50 hover:bg-primary/5 transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {starting ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <span className="text-2xl">{TOURNAMENT_TYPE_ICONS[type]}</span>
                  )}
                  <span className="font-semibold text-sm">{TOURNAMENT_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
