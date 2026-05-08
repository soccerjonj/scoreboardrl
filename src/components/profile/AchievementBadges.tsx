import { Medal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Badge } from "@/hooks/useProfileBadges";

type Props = {
  badges: Badge[];
  earnedCount: number;
  totalCount: number;
};

export default function AchievementBadges({ badges, earnedCount, totalCount }: Props) {
  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Medal className="w-3.5 h-3.5 text-primary" />
            Achievements
          </span>
          <span>{earnedCount}/{totalCount}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            {badges.map((badge) => (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-default select-none",
                      badge.earned
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "bg-muted/30 border-border/30 text-muted-foreground opacity-40"
                    )}
                  >
                    {badge.emoji} {badge.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {badge.description}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
