import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuotaInfo } from "@/hooks/useQuota";

interface QuotaMeterProps {
  quota: QuotaInfo;
  onUpgradeClick: () => void;
}

const QuotaMeter = ({ quota, onUpgradeClick }: QuotaMeterProps) => {
  if (quota.isLoading || quota.tier !== "free") return null;

  const pct = Math.min(100, Math.round((quota.parsesUsed / quota.quota) * 100));
  const trackColor = quota.isOverLimit
    ? "bg-rl-red/20"
    : quota.nearLimit
    ? "bg-amber-400/20"
    : "bg-primary/20";
  const fillColor = quota.isOverLimit
    ? "bg-rl-red"
    : quota.nearLimit
    ? "bg-amber-400"
    : "bg-primary";
  const countColor = quota.isOverLimit
    ? "text-rl-red"
    : quota.nearLimit
    ? "text-amber-400"
    : "text-foreground";

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/30">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          <span className={cn("font-semibold", countColor)}>{quota.parsesUsed}</span>
          {" / "}
          {quota.quota} photo parses this month
        </span>
        <button
          onClick={onUpgradeClick}
          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Zap className="w-3 h-3" />
          Upgrade
        </button>
      </div>
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", trackColor)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default QuotaMeter;
