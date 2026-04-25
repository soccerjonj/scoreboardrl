interface ContributionMeterProps {
  score: number;       // 1–100, represents % share of team contribution
  teamSize?: number;   // helps set colour thresholds (default 2)
  size?: "sm" | "md";
}

const ContributionMeter = ({ score, teamSize = 2, size = "md" }: ContributionMeterProps) => {
  if (!score || score < 1 || teamSize <= 1) return null;

  // Normalized: equal contribution = 100, regardless of team size
  const normalized = Math.round(score * teamSize);

  const color =
    normalized >= 120
      ? "bg-rl-purple"
      : normalized >= 90
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
      <span className="text-xs font-mono text-muted-foreground">{normalized}</span>
    </div>
  );
};

export { ContributionMeter };
export { ContributionMeter as CarryMeter };
export default ContributionMeter;
