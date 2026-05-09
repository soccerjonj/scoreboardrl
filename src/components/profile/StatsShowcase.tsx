import { Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardStanding } from "@/types/profile";

type ProfileStats = {
  totalGames: number;
  wins: number;
  losses: number;
  recentForm: Array<"W" | "L">;
  avgScore: number;
  avgGoals: number;
  avgAssists: number;
  avgSaves: number;
  avgShots: number;
  avgContribution: number | null;
  mvpRate: number;
  bestScore: number;
  bestGoals: number;
  bestAssists: number;
  bestSaves: number;
  bestContributionScore: number;
};

type Props = {
  stats: ProfileStats;
  leaderboardStanding: LeaderboardStanding | null;
};

type StatCellProps = {
  label: string;
  value: string;
  color?: string;
};

function StatCell({ label, value, color }: StatCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("font-display font-bold text-xl leading-none tabular-nums", color ?? "text-foreground")}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  );
}

export default function StatsShowcase({ stats, leaderboardStanding }: Props) {
  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
  const isTopTen = leaderboardStanding && leaderboardStanding.rank <= 10;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3 space-y-4">

        {/* Leaderboard callout */}
        {leaderboardStanding && (
          isTopTen ? (
            <div className="relative overflow-hidden rounded-xl px-4 py-3 bg-gradient-to-r from-primary/20 via-rl-purple/15 to-transparent border border-primary/30 flex items-center gap-3">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,hsl(var(--primary)/0.15),transparent_60%)]" />
              <Crown className="w-5 h-5 text-primary shrink-0 relative z-10" />
              <div className="relative z-10">
                <p className="font-display font-bold text-base text-primary leading-tight">
                  #{leaderboardStanding.rank} in {leaderboardStanding.stat}
                </p>
                <p className="text-xs text-muted-foreground">Global leaderboard · this week</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm">
                <span className="font-bold text-primary">Top {leaderboardStanding.rank}</span>
                {" "}<span className="text-muted-foreground">in {leaderboardStanding.stat} this week</span>
              </span>
            </div>
          )
        )}

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Career Stats</p>

        {/* W/L + form strip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rl-green/10 border border-rl-green/20">
            <span className="font-display font-bold text-sm text-rl-green">{stats.wins}W</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rl-red/10 border border-rl-red/20">
            <span className="font-display font-bold text-sm text-rl-red">{stats.losses}L</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{winRate}% WR</span>
          <div className="flex-1" />
          {stats.recentForm.length > 0 && (
            <div className="flex items-center gap-1">
              {stats.recentForm.map((result, i) => (
                <div key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
                  result === "W"
                    ? "bg-rl-green/20 text-rl-green border border-rl-green/30"
                    : "bg-rl-red/20 text-rl-red border border-rl-red/30"
                }`}>{result}</div>
              ))}
            </div>
          )}
        </div>

        {/* 7-stat grid — no boxes */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-4 py-1">
          <StatCell label="Goals / game"   value={stats.avgGoals.toFixed(1)}   color="text-rl-orange" />
          <StatCell label="Assists / game" value={stats.avgAssists.toFixed(1)} color="text-rl-blue" />
          <StatCell label="Saves / game"   value={stats.avgSaves.toFixed(1)}   color="text-cyan-400" />
          <StatCell label="Score / game"   value={Math.round(stats.avgScore).toString()} />
          <StatCell label="Shots / game"   value={stats.avgShots.toFixed(1)}   color="text-muted-foreground" />
          <StatCell label="MVP Rate"        value={`${Math.round(stats.mvpRate)}%`} color="text-yellow-400" />
          {stats.avgContribution != null && (
            <StatCell label="Avg Contribution" value={Math.round(stats.avgContribution).toString()} color="text-rl-purple" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
