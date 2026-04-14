interface ContributionMeterProps {
  score: number;       // 1–100, represents % share of team contribution
  teamSize?: number;   // helps set colour thresholds (default 2)
  size?: "sm" | "md";
}

const ContributionMeter = ({ score, teamSize = 2, size = "md" }: ContributionMeterProps) => {
  if (!score || score < 1) return null;

  // "Above average" threshold depends on team size (equal split = 100/teamSize)
  const equalShare = Math.round(100 / teamSize);
  const highThreshold = equalShare + 20; // notably above average
  const midThreshold  = equalShare - 5;  // roughly average or above

  const color =
    score >= highThreshold
      ? "bg-rl-purple"
      : score >= midThreshold
      ? "bg-primary"
      : "bg-muted-foreground";

  const barW = size === "sm" ? "w-16" : "w-24";
  const barH = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${barW} ${barH} rounded-full bg-muted overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{score}%</span>
    </div>
  );
};

export { ContributionMeter };
export { ContributionMeter as CarryMeter };
export default ContributionMeter;
