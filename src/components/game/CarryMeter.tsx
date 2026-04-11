import { cn } from "@/lib/utils";

interface CarryMeterProps {
  score: number;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Renders a carry score as a labelled fill bar.
 * Returns null when score is 0 (player did not carry).
 */
export function CarryMeter({ score, className, size = "md" }: CarryMeterProps) {
  if (!score) return null;

  const barColor =
    score >= 70 ? "bg-rl-purple" :
    score >= 40 ? "bg-primary"   :
                  "bg-muted-foreground";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-full bg-muted overflow-hidden flex-shrink-0",
          size === "sm" ? "h-1.5 w-16" : "h-2 w-24"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono font-bold tabular-nums leading-none",
          size === "sm" ? "text-xs" : "text-sm"
        )}
      >
        {score}
      </span>
    </div>
  );
}
