interface ContributionMeterProps {
  score: number;
  size?: "sm" | "md";
}

const ContributionMeter = ({ score, size = "md" }: ContributionMeterProps) => {
  if (!score || score < 1) return null;

  const color =
    score >= 70
      ? "bg-rl-purple"
      : score >= 40
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
      <span className="text-xs font-mono text-muted-foreground">{score}</span>
    </div>
  );
};

export { ContributionMeter };
export { ContributionMeter as CarryMeter };
export default ContributionMeter;
