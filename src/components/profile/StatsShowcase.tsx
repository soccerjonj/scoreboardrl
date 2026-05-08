import { Medal, Shield, Star, Target, Trophy, Zap } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BestGame, LeaderboardStanding } from "@/types/profile";

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
  bestGame: BestGame | null;
  leaderboardStanding: LeaderboardStanding | null;
};

function HeroStat({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-background/60 border border-border/40">
      <div className={cn("opacity-70", color)}>{icon}</div>
      <p className={cn("font-display font-bold text-2xl leading-none", color)}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function StatsShowcase({ stats, bestGame, leaderboardStanding }: Props) {
  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Career Stats</p>

        {/* Hero numbers */}
        <div className="grid grid-cols-3 gap-2">
          <HeroStat
            icon={<Target className="w-5 h-5" />}
            label="Goals"
            value={stats.avgGoals.toFixed(1)}
            sub="/game"
            color="text-rl-orange"
          />
          <HeroStat
            icon={<Shield className="w-5 h-5" />}
            label="Saves"
            value={stats.avgSaves.toFixed(1)}
            sub="/game"
            color="text-rl-blue"
          />
          <HeroStat
            icon={<Star className="w-5 h-5" />}
            label="MVP%"
            value={`${Math.round(stats.mvpRate)}%`}
            color="text-yellow-400"
          />
        </div>

        {/* W/L shelf + recent form */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rl-green/10 border border-rl-green/20">
            <span className="font-display font-bold text-sm text-rl-green">{stats.wins}W</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rl-red/10 border border-rl-red/20">
            <span className="font-display font-bold text-sm text-rl-red">{stats.losses}L</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{winRate}%</span>
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

        {/* Leaderboard standing */}
        {leaderboardStanding && (
          <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
            <Medal className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm">
              <span className="font-bold text-primary">Top {leaderboardStanding.rank}</span>
              {" "}<span className="text-muted-foreground">in {leaderboardStanding.stat} this week</span>
            </span>
          </div>
        )}

        {/* Best Performance */}
        {bestGame && (
          <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-rl-orange" />
              Best Performance
            </p>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(bestGame.date), "MMM d, yyyy")} · {bestGame.gameMode} {bestGame.gameType}
                </p>
                <div className="flex items-center gap-3 font-mono text-sm">
                  <span className="font-bold">{bestGame.score}</span>
                  <span className="text-rl-orange">{bestGame.goals}G</span>
                  <span className="text-rl-blue">{bestGame.assists}A</span>
                  <span className="text-cyan-400">{bestGame.saves}S</span>
                </div>
              </div>
              {bestGame.isMvp && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/15 text-yellow-400 border border-yellow-400/30">
                  MVP
                </span>
              )}
            </div>
          </div>
        )}

        {/* Personal Records */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            Personal Records
          </p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Score",  value: stats.bestScore },
              { label: "Goals",  value: stats.bestGoals },
              { label: "Assists",value: stats.bestAssists },
              { label: "Saves",  value: stats.bestSaves },
              { label: "Contrib",value: stats.bestContributionScore > 0 ? stats.bestContributionScore : null },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg bg-background/60 border border-border/30">
                <span className="font-display font-bold text-lg leading-none">
                  {value !== null ? value : <span className="text-muted-foreground text-sm">—</span>}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
