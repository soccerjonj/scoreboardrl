import { useState } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTournamentSession } from "@/hooks/useTournamentSession";
import StartTournamentSheet from "./StartTournamentSheet";

export default function TournamentBannerCard() {
  const { isActive } = useTournamentSession();
  const [showStart, setShowStart] = useState(false);

  // Active state is now handled by the global TournamentLiveBanner in AppLayout
  if (isActive) return null;

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
