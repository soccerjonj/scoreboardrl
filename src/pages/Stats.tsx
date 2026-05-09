import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Loader2, BarChart2, LineChart as LineChartIcon, FilterX,
  ChevronDown, ChevronUp, Trophy, Target, Shield, Zap, Star,
  TrendingUp, TrendingDown, Activity, Crosshair, ExternalLink,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarryMeter } from "@/components/game/CarryMeter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Area, AreaChart, XAxis, YAxis } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import LeaderboardView from "@/components/leaderboard/LeaderboardView";
import { isStandardGame } from "@/lib/gameModes";
import TournamentHistoryPanel from "@/components/tournament/TournamentHistoryPanel";

type GameMode = Database["public"]["Enums"]["game_mode"];
type GameType = Database["public"]["Enums"]["game_type"];
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
type GameWithPlayers = GameRow & { game_players: GamePlayerRow[] };

type FriendProfile = { user_id: string; username: string; rl_account_name: string | null; avatar_url: string | null };

type ChartDatum = {
  label: string;
  fullLabel: string;
  points: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  mvpRate: number;
  carryScore: number;
  teammatePoints?: number | null;
  teammateGoals?: number | null;
  teammateAssists?: number | null;
  teammateSaves?: number | null;
  teammateShots?: number | null;
  teammateMvpRate?: number | null;
};

type SummaryStats = {
  games: number;
  wins: number;
  winRate: number | null;
  pointsPerGame: number | null;
  goalsPerGame: number | null;
  assistsPerGame: number | null;
  savesPerGame: number | null;
  shotsPerGame: number | null;
  mvpRate: number | null;
  teamGoalsForPerGame: number | null;
  teamGoalsAgainstPerGame: number | null;
  avgContributionScore: number | null;
};

type TimeRange = "season" | "7d" | "30d" | "all";
type TogetherRange = "session" | "7d" | "28d" | "season" | "all";
type ViewMode = "summary" | "charts";

const SESSION_GAP_MS = 3 * 60 * 60 * 1000; // 3 hours — max gap within a session

const normalizeName = (v?: string | null) => v?.trim().toLowerCase() ?? "";
const safeNumber = (v: number | null | undefined) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

const formatAverage = (value: number | null, decimals = 1) =>
  value === null || Number.isNaN(value) ? "--" : value.toFixed(decimals);
const formatPercent = (value: number | null) =>
  value === null || Number.isNaN(value) ? "--" : `${Math.round(value)}%`;

type PlayerMatchTarget = { userId?: string | null; names: string[] };

const buildTarget = (userId: string | null | undefined, names: Array<string | null | undefined>): PlayerMatchTarget => ({
  userId,
  names: names.map(normalizeName).filter(Boolean),
});

const matchesTarget = (player: GamePlayerRow, target: PlayerMatchTarget) => {
  if (target.userId && player.user_id === target.userId) return true;
  if (!target.names.length) return false;
  return target.names.includes(normalizeName(player.player_name));
};

const findPlayer = (players: GamePlayerRow[] | null | undefined, target: PlayerMatchTarget) =>
  players?.find((p) => matchesTarget(p, target)) ?? null;

const buildSummary = (t: {
  games: number; wins: number; points: number; goals: number; assists: number;
  saves: number; shots: number; mvp: number; teamGoalsFor: number;
  teamGoalsAgainst: number; carryTotal: number; carryGames: number;
}): SummaryStats => {
  if (!t.games) return {
    games: 0, wins: 0, winRate: null, pointsPerGame: null, goalsPerGame: null,
    assistsPerGame: null, savesPerGame: null, shotsPerGame: null, mvpRate: null,
    teamGoalsForPerGame: null, teamGoalsAgainstPerGame: null, avgContributionScore: null,
  };
  return {
    games: t.games,
    wins: t.wins,
    winRate: (t.wins / t.games) * 100,
    pointsPerGame: t.points / t.games,
    goalsPerGame: t.goals / t.games,
    assistsPerGame: t.assists / t.games,
    savesPerGame: t.saves / t.games,
    shotsPerGame: t.shots / t.games,
    mvpRate: (t.mvp / t.games) * 100,
    teamGoalsForPerGame: t.teamGoalsFor / t.games,
    teamGoalsAgainstPerGame: t.teamGoalsAgainst / t.games,
    avgContributionScore: t.carryGames > 0 ? t.carryTotal / t.carryGames : null,
  };
};

// ─── Stat definitions ─────────────────────────────────────────────────────────

type StatRowDef = {
  key: keyof SummaryStats;
  label: string;
  formatter: (v: number | null) => string;
  highlight?: "higher" | "lower";
  icon: React.ElementType;
  color: string;
  bg: string;
};

const STAT_ROWS: StatRowDef[] = [
  { key: "winRate",                 label: "Win Rate",          formatter: formatPercent,               highlight: "higher", icon: Trophy,      color: "text-rl-green",   bg: "from-rl-green/15 to-transparent" },
  { key: "pointsPerGame",           label: "Avg Score",         formatter: (v) => formatAverage(v, 1), highlight: "higher", icon: BarChart2,   color: "text-primary",    bg: "from-primary/15 to-transparent" },
  { key: "goalsPerGame",            label: "Avg Goals",         formatter: (v) => formatAverage(v, 2), highlight: "higher", icon: Target,      color: "text-rl-orange",  bg: "from-rl-orange/15 to-transparent" },
  { key: "assistsPerGame",          label: "Avg Assists",       formatter: (v) => formatAverage(v, 2), highlight: "higher", icon: TrendingUp,  color: "text-secondary",  bg: "from-secondary/15 to-transparent" },
  { key: "savesPerGame",            label: "Avg Saves",         formatter: (v) => formatAverage(v, 2), highlight: "higher", icon: Shield,      color: "text-rl-purple",  bg: "from-rl-purple/15 to-transparent" },
  { key: "shotsPerGame",            label: "Avg Shots",         formatter: (v) => formatAverage(v, 2), highlight: "higher", icon: Crosshair,   color: "text-yellow-400", bg: "from-yellow-400/15 to-transparent" },
  { key: "mvpRate",                 label: "MVP Rate",          formatter: formatPercent,               highlight: "higher", icon: Star,        color: "text-yellow-400", bg: "from-yellow-400/15 to-transparent" },
  { key: "teamGoalsForPerGame",     label: "Team Goals For",    formatter: (v) => formatAverage(v, 2), highlight: "higher", icon: Zap,         color: "text-rl-green",   bg: "from-rl-green/15 to-transparent" },
  { key: "teamGoalsAgainstPerGame", label: "Team Goals Against",formatter: (v) => formatAverage(v, 2), highlight: "lower",  icon: TrendingDown,color: "text-rl-red",     bg: "from-rl-red/15 to-transparent" },
  { key: "avgContributionScore",    label: "Avg Contribution",  formatter: (v) => v === null ? "--" : Math.round(v).toString(), highlight: "higher", icon: Activity, color: "text-rl-purple", bg: "from-rl-purple/15 to-transparent" },
];

// ─── Solo summary list ────────────────────────────────────────────────────────

const STAT_GROUPS: Array<{ label: string; keys: Array<keyof SummaryStats>; accent: string }> = [
  { label: "Attacking",   keys: ["goalsPerGame", "assistsPerGame", "shotsPerGame"],                           accent: "hsl(25, 95%, 60%)"  },
  { label: "Defensive",   keys: ["savesPerGame", "teamGoalsForPerGame", "teamGoalsAgainstPerGame"],           accent: "hsl(270, 70%, 65%)" },
  { label: "Performance", keys: ["pointsPerGame", "mvpRate", "avgContributionScore"],                        accent: "hsl(212, 95%, 58%)" },
];

const SoloSummaryList = ({ summary }: { summary: SummaryStats }) => {
  const wins    = summary.wins;
  const losses  = summary.games - wins;
  const winRate = summary.winRate ?? 0;
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Record hero ── */}
      <Card className="overflow-hidden">
        <div className={cn("h-0.5 w-full", winRate >= 50
          ? "bg-gradient-to-r from-rl-green/70 via-rl-green/30 to-transparent"
          : "bg-gradient-to-r from-rl-red/70 via-rl-red/30 to-transparent"
        )} />
        <CardContent className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-4xl text-rl-green">{wins}W</span>
              <span className="text-muted-foreground/40 text-2xl">—</span>
              <span className="font-display font-bold text-4xl text-rl-red">{losses}L</span>
            </div>
            <div className="text-right">
              <p className={cn("font-display font-bold text-2xl", winRate >= 50 ? "text-rl-green" : "text-rl-red")}>{Math.round(winRate)}%</p>
              <p className="text-[10px] text-muted-foreground">{summary.games} game{summary.games !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", winRate >= 50 ? "bg-rl-green" : "bg-rl-red")}
              style={{ width: `${winRate}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Stat groups ── */}
      {STAT_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-0.5">{group.label}</p>
          <Card className="overflow-hidden border-l-2" style={{ borderLeftColor: group.accent }}>
            <CardContent className="p-0 divide-y divide-border/20">
              {group.keys.map((key) => {
                const row = STAT_ROWS.find((r) => r.key === key)!;
                const val = summary[key] as number | null;
                return (
                  <div key={String(key)} className="flex items-center px-4 py-3">
                    <span className="text-sm text-muted-foreground flex-1">{row.label}</span>
                    <span className={cn("font-display font-bold text-base tabular-nums", val !== null ? row.color : "text-muted-foreground/40")}>
                      {row.formatter(val)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
};

// ─── Comparison table ─────────────────────────────────────────────────────────

const AvatarCircle = ({ url, name, size = "md" }: { url: string | null; name: string; size?: "sm" | "md" }) => {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div className={cn(dim, "rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border/40")}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="font-bold text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  );
};

const ComparisonTable = ({
  userSummary, teammateSummary, teammateName,
  userAvatarUrl, teammateAvatarUrl, overallWinRate,
}: {
  userSummary: SummaryStats; teammateSummary: SummaryStats; teammateName: string;
  userAvatarUrl?: string | null; teammateAvatarUrl?: string | null; overallWinRate?: number | null;
}) => {
  const wins    = userSummary.wins;
  const losses  = userSummary.games - wins;
  const winRate = userSummary.winRate ?? 0;
  const betterDelta = overallWinRate != null ? winRate - overallWinRate : null;

  return (
    <Card className="overflow-hidden animate-fade-in-up">
      <CardContent className="p-0">
        {/* ── Header: avatars + win rate bar ── */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          {/* Player labels */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AvatarCircle url={userAvatarUrl ?? null} name="You" />
              <span className="text-sm font-semibold text-primary">You</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {userSummary.games} game{userSummary.games !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-right">{teammateName}</span>
              <AvatarCircle url={teammateAvatarUrl ?? null} name={teammateName} />
            </div>
          </div>

          {/* Win rate bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full overflow-hidden bg-muted/50 flex">
              <div
                className="bg-rl-green rounded-l-full transition-all duration-500"
                style={{ width: `${winRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="text-rl-green font-semibold">{wins}W</span>
              <span className="font-semibold text-foreground">{Math.round(winRate)}% win rate</span>
              <span className="text-rl-red font-semibold">{losses}L</span>
            </div>
          </div>

          {/* Better together callout */}
          {betterDelta != null && Math.abs(betterDelta) >= 5 && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg",
              betterDelta > 0
                ? "bg-rl-green/10 text-rl-green"
                : "bg-rl-red/10 text-rl-red"
            )}>
              <span>
                You win <span className="font-bold">{Math.round(Math.abs(betterDelta))}%</span>
                {betterDelta > 0 ? " more" : " less"} with {teammateName} than your overall average.
              </span>
            </div>
          )}
        </div>

        {/* ── Stat rows ── */}
        <div className="border-t border-border/30">
          <div className="grid grid-cols-3 px-4 py-2 bg-muted/30 text-[10px] font-semibold uppercase tracking-wide">
            <span className="text-primary">You</span>
            <span className="text-center text-muted-foreground">Stat</span>
            <span className="text-right text-muted-foreground">{teammateName}</span>
          </div>
          {STAT_ROWS.map((row) => {
            const uVal = userSummary[row.key] as number | null;
            const tVal = teammateSummary[row.key] as number | null;
            let uWins = false, tWins = false;
            if (uVal !== null && tVal !== null && row.highlight) {
              if (row.highlight === "higher") { uWins = uVal > tVal; tWins = tVal > uVal; }
              else { uWins = uVal < tVal; tWins = tVal < uVal; }
            }
            return (
              <div key={row.key} className="grid grid-cols-3 px-4 py-2.5 text-sm border-b border-border/20 last:border-0">
                <span className={cn("font-mono font-bold", uWins ? "text-rl-green" : tWins ? "text-muted-foreground/50" : "")}>
                  {row.formatter(uVal)}
                </span>
                <span className="text-center text-xs text-muted-foreground">{row.label}</span>
                <span className={cn("text-right font-mono font-bold", tWins ? "text-rl-green" : uWins ? "text-muted-foreground/50" : "")}>
                  {row.formatter(tVal)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Chart card ───────────────────────────────────────────────────────────────

const TEAMMATE_COLOR = "hsl(25, 95%, 60%)";

const StatChart = ({ title, description, data, userKey, teammateKey, teammateLabel, yAxisFormatter, yAxisDomain, accentColor = "hsl(212, 95%, 58%)" }: {
  title: string; description: string; data: ChartDatum[];
  userKey: keyof ChartDatum; teammateKey?: keyof ChartDatum;
  teammateLabel?: string; yAxisFormatter?: (v: number) => string;
  yAxisDomain?: [number, number]; accentColor?: string;
}) => {
  const hasTeammate = Boolean(teammateKey && teammateLabel);
  const gradId = `grad-${String(userKey)}`;
  const gradIdTeam = `grad-team-${String(teammateKey)}`;
  const chartConfig = {
    [userKey]: { label: "You", color: accentColor },
    ...(teammateKey && teammateLabel ? { [teammateKey]: { label: teammateLabel, color: TEAMMATE_COLOR } } : {}),
  };

  return (
    <Card className="overflow-hidden animate-fade-in-up">
      {/* Colored accent line */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(to right, ${accentColor}, transparent)` }} />
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-display">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden pt-0">
        <ChartContainer config={chartConfig} className="h-52 w-full max-w-full">
          <AreaChart data={data} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
                <stop offset="90%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
              {hasTeammate && (
                <linearGradient id={gradIdTeam} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAMMATE_COLOR} stopOpacity={0.2} />
                  <stop offset="90%" stopColor={TEAMMATE_COLOR} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border)/0.25)" />
            <XAxis dataKey="label" hide />
            <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={yAxisFormatter} domain={yAxisDomain} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} />} />
            <Area
              type="monotone"
              dataKey={userKey}
              stroke={accentColor}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: accentColor, fill: "hsl(var(--background))", style: { filter: `drop-shadow(0 0 6px ${accentColor})` } }}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            />
            {hasTeammate && (
              <Area
                type="monotone"
                dataKey={teammateKey}
                stroke={TEAMMATE_COLOR}
                strokeWidth={2.5}
                fill={`url(#${gradIdTeam})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: TEAMMATE_COLOR, fill: "hsl(var(--background))", style: { filter: `drop-shadow(0 0 6px ${TEAMMATE_COLOR})` } }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
            )}
            {hasTeammate && <ChartLegend content={<ChartLegendContent />} />}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// ─── Best Contribution Card ───────────────────────────────────────────────────

const BestContributionCard = ({
  bestContributionGames, userTarget, expandedGameId, onToggleGame,
}: {
  bestContributionGames: Array<{ game: GameWithPlayers; contributionScore: number }>;
  userTarget: PlayerMatchTarget; expandedGameId: string | null; onToggleGame: (id: string) => void;
}) => (
  <Card className="animate-fade-in-up">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-display">Best Contribution Games</CardTitle>
      <CardDescription className="text-xs">Your top 5 contribution performances</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      {bestContributionGames.map(({ game, contributionScore }) => {
        const userRow = findPlayer(game.game_players || [], userTarget);
        const isWin   = game.result === "win";
        const isOpen  = expandedGameId === game.id;
        const teamSize = game.game_mode === "1v1" ? 1 : (game.game_mode === "2v2" || game.game_mode === "hoops_2v2" || game.game_mode === "heatseeker_2v2") ? 2 : 3;
        const userTeamFirst  = userRow?.team ?? "blue";
        const teamOrder      = [userTeamFirst, userTeamFirst === "blue" ? "orange" : "blue"] as const;
        const sortedPlayers  = [...(game.game_players || [])].sort((a, b) => {
          const aIdx = teamOrder.indexOf((a.team ?? "blue") as typeof teamOrder[number]);
          const bIdx = teamOrder.indexOf((b.team ?? "blue") as typeof teamOrder[number]);
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (b.contribution_score ?? 0) - (a.contribution_score ?? 0);
        });

        return (
          <div
            key={game.id}
            className="rounded-xl overflow-hidden bg-muted/20 border border-border/30 cursor-pointer hover:bg-muted/30 transition-all"
            onClick={() => onToggleGame(game.id)}
          >
            {/* Colored top stripe */}
            <div className={cn("h-0.5 w-full", isWin ? "bg-gradient-to-r from-rl-green/60 to-transparent" : "bg-gradient-to-r from-rl-red/60 to-transparent")} />

            <div className="flex items-center justify-between py-2.5 px-3">
              <div className="flex items-center gap-3">
                <span className={cn("w-1 h-7 rounded-full flex-shrink-0", isWin ? "bg-rl-green shadow-[0_0_8px_hsl(var(--rl-green)/0.6)]" : "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]")} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-display font-bold", isWin ? "text-rl-green" : "text-rl-red")}>{isWin ? "WIN" : "LOSS"}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{game.game_mode}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(game.played_at), "MMM d, yyyy")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {userRow && (
                  <p className="text-xs text-muted-foreground font-mono hidden sm:block">
                    {userRow.goals}G {userRow.assists}A {userRow.saves}S · {userRow.score}pts
                  </p>
                )}
                <CarryMeter score={contributionScore} teamSize={teamSize} size="md" />
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>

            {isOpen && (
              <div className="px-3 pb-3 pt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 pb-1.5 mb-0.5 border-b border-border/20">
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">G</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">A</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Sv</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Sh</span>
                </div>
                {teamOrder.map((teamColor) => {
                  const teamRows = sortedPlayers.filter((p) => (p.team ?? "blue") === teamColor);
                  if (!teamRows.length) return null;
                  return (
                    <div key={teamColor} className="mb-1">
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5", teamColor === "blue" ? "text-blue-400" : "text-orange-400")}>{teamColor}</p>
                      {teamRows.map((p) => {
                        const isUser = matchesTarget(p, userTarget);
                        return (
                          <div key={p.id} className={cn("grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 items-start py-1.5 rounded-md", isUser && "bg-primary/5 px-2 -mx-2")}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {p.user_id && !isUser ? (
                                  <Link
                                    to={`/profile/${p.user_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 text-xs font-medium leading-snug break-words min-w-0 text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary hover:decoration-primary/60 transition-colors"
                                  >
                                    {p.player_name}
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                                  </Link>
                                ) : (
                                  <span className={cn("text-xs font-medium leading-snug break-words min-w-0", isUser ? "text-primary" : "text-foreground")}>{p.player_name}</span>
                                )}
                                {p.is_mvp && <span className="text-[9px] text-yellow-400 font-bold leading-snug flex-shrink-0">MVP</span>}
                              </div>
                              {p.contribution_score != null && p.contribution_score > 0 && (
                                <div className="mt-0.5"><CarryMeter score={p.contribution_score} teamSize={teamSize} size="sm" /></div>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-right leading-snug">{p.score}</span>
                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.goals}</span>
                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.assists}</span>
                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.saves}</span>
                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.shots}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </CardContent>
  </Card>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const Stats = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GameWithPlayers[]>([]);

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [userRlName, setUserRlName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode | "all">("all");
  const [selectedType, setSelectedType] = useState<GameType | "all">("all");
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("season");
  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [expandedContribGameId, setExpandedContribGameId] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<"stats" | "leaderboard">("stats");
  const [statsView, setStatsView] = useState<"stats" | "tournaments">("stats");
  const [showOthersPanel, setShowOthersPanel] = useState(false);
  const [togetherRange, setTogetherRange] = useState<TogetherRange>("all");
  const [togetherVisibleCount, setTogetherVisibleCount] = useState(5);
  const [togetherExpandedGameId, setTogetherExpandedGameId] = useState<string | null>(null);
  const [seasonStartsAt, setSeasonStartsAt] = useState<string | null>(null);
  const [currentSeasonName, setCurrentSeasonName] = useState<string>("This Season");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // One-time fetch of the current season (separate from game data — stable, no reruns)
  useEffect(() => {
    supabase
      .from("seasons")
      .select("name, starts_at")
      .eq("is_current", true)
      .single()
      .then(({ data }) => {
        if (data) {
          setSeasonStartsAt(data.starts_at);
          setCurrentSeasonName(data.name);
        }
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, friendsRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name, avatar_url").eq("user_id", user.id).single(),
          supabase.from("friend_requests").select("sender_id, receiver_id").eq("status", "accepted").or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (friendsRes.error) throw friendsRes.error;

        const { data: playerGameRows } = await supabase.from("game_players").select("game_id").eq("user_id", user.id);
        const allIds = Array.from(new Set((playerGameRows || []).map((r) => r.game_id)));

        const gamesRes = allIds.length > 0
          ? await supabase.from("games").select("id, played_at, game_mode, game_type, tournament_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id, mmr, mmr_change)").or(`created_by.eq.${user.id},id.in.(${allIds.join(",")})`).order("played_at", { ascending: true })
          : await supabase.from("games").select("id, played_at, game_mode, game_type, tournament_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id, mmr, mmr_change)").eq("created_by", user.id).order("played_at", { ascending: true });

        if (gamesRes.error) throw gamesRes.error;

        const friendIds = new Set<string>();
        (friendsRes.data || []).forEach((r) => { const fid = r.sender_id === user.id ? r.receiver_id : r.sender_id; if (fid) friendIds.add(fid); });

        let friendProfiles: FriendProfile[] = [];
        if (friendIds.size > 0) {
          const { data } = await supabase.from("profiles").select("user_id, username, rl_account_name, avatar_url").in("user_id", Array.from(friendIds));
          friendProfiles = data || [];
        }

        setUserRlName(profileRes.data?.rl_account_name ?? null);
        setUserAvatarUrl((profileRes.data as any)?.avatar_url ?? null);
        setFriends(friendProfiles);
        setGames((gamesRes.data || []) as GameWithPlayers[]);
      } catch (err: any) {
        toast({ title: "Failed to load stats", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, toast]);

  const friendOptions = useMemo(() => friends.map((f) => ({ id: f.user_id, label: f.rl_account_name?.trim() || f.username, rlName: f.rl_account_name, username: f.username })), [friends]);
  const selectedFriend = friendOptions.find((f) => f.id === selectedFriendId) || null;

  // Auto-select friend from ?friend= URL param (e.g. arriving from a friend profile "Together" button)
  useEffect(() => {
    const friendIdFromUrl = searchParams.get("friend");
    if (!friendIdFromUrl || friendOptions.length === 0) return;
    if (friendOptions.some((f) => f.id === friendIdFromUrl)) {
      setSelectedFriendId(friendIdFromUrl);
      setPageTab("stats");
    }
  }, [friendOptions, searchParams]);

  // Reset together range + visible count whenever the selected friend changes
  useEffect(() => {
    setTogetherRange("all");
    setTogetherVisibleCount(5);
    setTogetherExpandedGameId(null);
  }, [selectedFriendId]);

  // Reset visible count when range changes
  useEffect(() => {
    setTogetherVisibleCount(5);
    setTogetherExpandedGameId(null);
  }, [togetherRange]);
  const userTarget = useMemo(() => buildTarget(user?.id, [userRlName]), [user?.id, userRlName]);
  const teammateTarget = useMemo(() => selectedFriend ? buildTarget(selectedFriend.id, [selectedFriend.rlName, selectedFriend.username]) : null, [selectedFriend]);

  const isOthersActive = selectedType === "casual" || !["all", "1v1", "2v2", "3v3"].includes(selectedMode);

  const filteredGames = useMemo(() => games
    .filter((g) => {
      if (selectedMode === "all") return isStandardGame(g as any);
      // Standard mode pill selected (no Others): exclude casual unless explicitly chosen
      if (["1v1", "2v2", "3v3"].includes(selectedMode) && selectedType === "all")
        return g.game_mode === selectedMode && g.game_type !== "casual";
      return g.game_mode === selectedMode;
    })
    .filter((g) => selectedType === "all" || g.game_type === selectedType)
    .filter((g) => !teammateTarget || Boolean(findPlayer(g.game_players, teammateTarget))),
  [games, selectedMode, selectedType, teammateTarget]);

  // Last continuous play session — games within SESSION_GAP_MS of each other,
  // walking backwards from the most recent game.
  const sessionGames = useMemo(() => {
    if (!selectedFriend) return [] as GameWithPlayers[];
    const sorted = [...filteredGames].sort(
      (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    );
    if (sorted.length === 0) return [] as GameWithPlayers[];
    const sessionIds = new Set<string>([sorted[0].id]);
    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i - 1].played_at).getTime() - new Date(sorted[i].played_at).getTime();
      if (gap > SESSION_GAP_MS) break;
      sessionIds.add(sorted[i].id);
    }
    return filteredGames.filter((g) => sessionIds.has(g.id));
  }, [filteredGames, selectedFriend]);

  const rangeFilteredGames = useMemo(() => {
    if (selectedFriend) {
      // Together view uses its own time range
      if (togetherRange === "session") return sessionGames;
      if (togetherRange === "all") return filteredGames;
      if (togetherRange === "season") {
        if (!seasonStartsAt) return filteredGames;
        const cutoff = new Date(seasonStartsAt);
        return filteredGames.filter((g) => new Date(g.played_at) >= cutoff);
      }
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (togetherRange === "7d" ? 7 : 28));
      return filteredGames.filter((g) => new Date(g.played_at) >= cutoff);
    }
    // Solo stats — use the global time range
    if (timeRange === "all") return filteredGames;
    if (timeRange === "season") {
      if (!seasonStartsAt) return filteredGames; // fallback while season loads
      const cutoff = new Date(seasonStartsAt);
      return filteredGames.filter((g) => new Date(g.played_at) >= cutoff);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (timeRange === "7d" ? 7 : 30));
    return filteredGames.filter((g) => new Date(g.played_at) >= cutoff);
  }, [filteredGames, timeRange, togetherRange, seasonStartsAt, selectedFriend, sessionGames]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isOthersActive) count++;
    else if (selectedMode !== "all") count++;
    if (selectedFriendId !== "all") count++;
    return count;
  }, [selectedMode, selectedType, selectedFriendId, isOthersActive]);

  const { chartData, userSummary, teammateSummary } = useMemo(() => {
    const ut = { games: 0, wins: 0, points: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvp: 0, teamGoalsFor: 0, teamGoalsAgainst: 0, carryTotal: 0, carryGames: 0 };
    const tt = { games: 0, wins: 0, points: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvp: 0, teamGoalsFor: 0, teamGoalsAgainst: 0, carryTotal: 0, carryGames: 0 };
    const data: ChartDatum[] = [];
    const perGame = rangeFilteredGames.length < 20;

    if (perGame) {
      let uGames = 0, uMvp = 0, tGames = 0, tMvp = 0;
      rangeFilteredGames.forEach((game, idx) => {
        const players = game.game_players || [];
        const userRow = findPlayer(players, userTarget);
        if (!userRow) return;
        const gameNum = idx + 1;
        const userTeam = userRow.team;
        const teamFor = players.filter((p) => p.team === userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
        const teamAgainst = players.filter((p) => p.team !== userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
        const uScore = safeNumber(userRow.score), uGoals = safeNumber(userRow.goals), uAssists = safeNumber(userRow.assists), uSaves = safeNumber(userRow.saves), uShots = safeNumber(userRow.shots), uContrib = safeNumber(userRow.contribution_score);
        const gTeamSize = game.game_mode === "1v1" ? 1 : (game.game_mode === "2v2" || game.game_mode === "hoops_2v2" || game.game_mode === "heatseeker_2v2") ? 2 : 3;
        ut.games++; ut.points += uScore; ut.goals += uGoals; ut.assists += uAssists; ut.saves += uSaves; ut.shots += uShots;
        ut.teamGoalsFor += teamFor; ut.teamGoalsAgainst += teamAgainst;
        if (game.result === "win") ut.wins++;
        if (userRow.is_mvp) ut.mvp++;
        if (uContrib > 0 && gTeamSize > 1) { ut.carryTotal += uContrib * gTeamSize; ut.carryGames++; }
        uGames++; if (userRow.is_mvp) uMvp++;
        let teammateRow: GamePlayerRow | null = null;
        if (teammateTarget) {
          teammateRow = findPlayer(players, teammateTarget);
          if (teammateRow) {
            const tScore = safeNumber(teammateRow.score), tGoals = safeNumber(teammateRow.goals), tAssists = safeNumber(teammateRow.assists), tSaves = safeNumber(teammateRow.saves), tShots = safeNumber(teammateRow.shots), tContrib = safeNumber(teammateRow.contribution_score);
            const tTeam = teammateRow.team;
            tt.games++; tt.points += tScore; tt.goals += tGoals; tt.assists += tAssists; tt.saves += tSaves; tt.shots += tShots;
            tt.teamGoalsFor += players.filter((p) => p.team === tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
            tt.teamGoalsAgainst += players.filter((p) => p.team !== tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
            if (game.result === "win") tt.wins++;
            if (teammateRow.is_mvp) tt.mvp++;
            if (tContrib > 0 && gTeamSize > 1) { tt.carryTotal += tContrib * gTeamSize; tt.carryGames++; }
            tGames++; if (teammateRow.is_mvp) tMvp++;
          }
        }
        data.push({
          label: `#${gameNum}`, fullLabel: `Game ${gameNum} · ${format(new Date(game.played_at), "MMM d, yyyy")}`,
          points: uScore, goals: uGoals, assists: uAssists, saves: uSaves, shots: uShots,
          mvpRate: uGames ? (uMvp / uGames) * 100 : 0, carryScore: gTeamSize > 1 ? uContrib * gTeamSize : 0,
          teammatePoints: teammateRow ? safeNumber(teammateRow.score) : null,
          teammateGoals: teammateRow ? safeNumber(teammateRow.goals) : null,
          teammateAssists: teammateRow ? safeNumber(teammateRow.assists) : null,
          teammateSaves: teammateRow ? safeNumber(teammateRow.saves) : null,
          teammateShots: teammateRow ? safeNumber(teammateRow.shots) : null,
          teammateMvpRate: teammateRow ? (tGames ? (tMvp / tGames) * 100 : 0) : null,
        });
      });
    } else {
      const dateMap = new Map<string, { games: GameWithPlayers[] }>();
      rangeFilteredGames.forEach((game) => {
        const dk = format(new Date(game.played_at), "yyyy-MM-dd");
        if (!dateMap.has(dk)) dateMap.set(dk, { games: [] });
        dateMap.get(dk)!.games.push(game);
      });
      let uGames = 0, uMvp = 0, tGames = 0, tMvp = 0;
      Array.from(dateMap.entries()).forEach(([dateKey, { games: dayGames }]) => {
        const date = new Date(dateKey); const count = dayGames.length;
        let dayUScore = 0, dayUGoals = 0, dayUAssists = 0, dayUSaves = 0, dayUShots = 0, dayUNormContrib = 0, dayUNormCount = 0, dayUValid = 0;
        let dayTScore = 0, dayTGoals = 0, dayTAssists = 0, dayTSaves = 0, dayTShots = 0, dayTValid = 0;
        dayGames.forEach((game) => {
          const players = game.game_players || [];
          const userRow = findPlayer(players, userTarget);
          if (!userRow) return;
          const userTeam = userRow.team;
          const uScore = safeNumber(userRow.score), uGoals = safeNumber(userRow.goals), uAssists = safeNumber(userRow.assists), uSaves = safeNumber(userRow.saves), uShots = safeNumber(userRow.shots), uContrib = safeNumber(userRow.contribution_score);
          const gTeamSize = game.game_mode === "1v1" ? 1 : (game.game_mode === "2v2" || game.game_mode === "hoops_2v2" || game.game_mode === "heatseeker_2v2") ? 2 : 3;
          ut.games++; ut.points += uScore; ut.goals += uGoals; ut.assists += uAssists; ut.saves += uSaves; ut.shots += uShots;
          ut.teamGoalsFor += players.filter((p) => p.team === userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
          ut.teamGoalsAgainst += players.filter((p) => p.team !== userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
          if (game.result === "win") ut.wins++;
          if (userRow.is_mvp) ut.mvp++;
          if (uContrib > 0 && gTeamSize > 1) { ut.carryTotal += uContrib * gTeamSize; ut.carryGames++; }
          uGames++; if (userRow.is_mvp) uMvp++;
          dayUScore += uScore; dayUGoals += uGoals; dayUAssists += uAssists; dayUSaves += uSaves; dayUShots += uShots; dayUValid++;
          if (uContrib > 0 && gTeamSize > 1) { dayUNormContrib += uContrib * gTeamSize; dayUNormCount++; }
          if (teammateTarget) {
            const tr = findPlayer(players, teammateTarget);
            if (tr) {
              const tScore = safeNumber(tr.score), tGoals = safeNumber(tr.goals), tAssists = safeNumber(tr.assists), tSaves = safeNumber(tr.saves), tShots = safeNumber(tr.shots), tContrib = safeNumber(tr.contribution_score);
              const tTeam = tr.team;
              tt.games++; tt.points += tScore; tt.goals += tGoals; tt.assists += tAssists; tt.saves += tSaves; tt.shots += tShots;
              tt.teamGoalsFor += players.filter((p) => p.team === tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
              tt.teamGoalsAgainst += players.filter((p) => p.team !== tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
              if (game.result === "win") tt.wins++;
              if (tr.is_mvp) tt.mvp++;
              if (tContrib > 0 && gTeamSize > 1) { tt.carryTotal += tContrib * gTeamSize; tt.carryGames++; }
              tGames++; if (tr.is_mvp) tMvp++;
              dayTScore += tScore; dayTGoals += tGoals; dayTAssists += tAssists; dayTSaves += tSaves; dayTShots += tShots; dayTValid++;
            }
          }
        });
        if (dayUValid === 0) return;
        data.push({
          label: format(date, "MMM d"), fullLabel: format(date, "MMM d, yyyy") + (count > 1 ? ` (${count} games)` : ""),
          points: dayUScore / dayUValid, goals: dayUGoals / dayUValid, assists: dayUAssists / dayUValid,
          saves: dayUSaves / dayUValid, shots: dayUShots / dayUValid, carryScore: dayUNormCount > 0 ? dayUNormContrib / dayUNormCount : 0,
          mvpRate: uGames ? (uMvp / uGames) * 100 : 0,
          teammatePoints: dayTValid > 0 ? dayTScore / dayTValid : null,
          teammateGoals: dayTValid > 0 ? dayTGoals / dayTValid : null,
          teammateAssists: dayTValid > 0 ? dayTAssists / dayTValid : null,
          teammateSaves: dayTValid > 0 ? dayTSaves / dayTValid : null,
          teammateShots: dayTValid > 0 ? dayTShots / dayTValid : null,
          teammateMvpRate: dayTValid > 0 ? (tGames ? (tMvp / tGames) * 100 : 0) : null,
        });
      });
    }

    return { chartData: data, userSummary: buildSummary(ut), teammateSummary: teammateTarget ? buildSummary(tt) : null };
  }, [rangeFilteredGames, teammateTarget, userTarget]);

  const chartDefinitions = [
    { id: "points",     title: "Points",       description: "Score output per match.",       userKey: "points"     as const, teammateKey: "teammatePoints"   as const, accentColor: "hsl(212, 95%, 58%)"  },
    { id: "goals",      title: "Goals",        description: "Finishing stats per match.",    userKey: "goals"      as const, teammateKey: "teammateGoals"    as const, accentColor: "hsl(25, 95%, 60%)"   },
    { id: "assists",    title: "Assists",       description: "Playmaking trend.",             userKey: "assists"    as const, teammateKey: "teammateAssists"  as const, accentColor: "hsl(160, 60%, 50%)"  },
    { id: "saves",      title: "Saves",        description: "Defensive stops.",              userKey: "saves"      as const, teammateKey: "teammateSaves"    as const, accentColor: "hsl(270, 70%, 65%)"  },
    { id: "shots",      title: "Shots",        description: "Shot volume.",                  userKey: "shots"      as const, teammateKey: "teammateShots"    as const, accentColor: "hsl(48, 95%, 58%)"   },
    { id: "mvpRate",    title: "MVP Rate",     description: "Cumulative MVP %.",             userKey: "mvpRate"    as const, teammateKey: "teammateMvpRate"  as const, accentColor: "hsl(48, 95%, 58%)",  yAxisFormatter: (v: number) => `${Math.round(v)}%`, yAxisDomain: [0, 100] as [number, number] },
    { id: "carryScore", title: "Contribution", description: "Contribution score per game. 100 = equal share.", userKey: "carryScore" as const, accentColor: "hsl(270, 70%, 65%)", yAxisDomain: [0, 200] as [number, number] },
  ];

  const bestContributionGames = useMemo(() =>
    rangeFilteredGames
      .map((game) => ({ game, contributionScore: safeNumber(findPlayer(game.game_players || [], userTarget)?.contribution_score) }))
      .filter((g) => g.contributionScore > 0)
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .slice(0, 5),
  [rangeFilteredGames, userTarget]);

  // Overall (unfiltered) win rate — used for "Better Together" delta
  const overallWinRate = useMemo(() => {
    const played = games.filter((g) => findPlayer(g.game_players || [], userTarget));
    if (!played.length) return null;
    return (played.filter((g) => g.result === "win").length / played.length) * 100;
  }, [games, userTarget]);

  // Recent shared games — all games where both played, newest first
  const recentSharedGames = useMemo(() => {
    if (!teammateTarget) return [];
    return [...rangeFilteredGames]
      .filter((g) => findPlayer(g.game_players || [], userTarget) && findPlayer(g.game_players || [], teammateTarget))
      .reverse();
  }, [rangeFilteredGames, userTarget, teammateTarget]);

  // MMR history — multi-mode overlay from game_players.mmr (per-game values)
  const mmrChartData = useMemo(() => {
    const MODES = ["1v1", "2v2", "3v3"] as const;
    const MODE_COLORS: Record<string, string> = {
      "1v1": "hsl(271, 81%, 65%)",
      "2v2": "hsl(212, 95%, 58%)",
      "3v3": "hsl(142, 71%, 45%)",
    };

    // Collect per-game MMR points grouped by mode (oldest→newest, already sorted)
    const byMode = new Map<string, Array<{ mmr: number; date: string }>>();
    rangeFilteredGames.forEach((game) => {
      const userRow = findPlayer(game.game_players || [], userTarget);
      const mmrVal = (userRow as any)?.mmr;
      if (mmrVal == null || typeof mmrVal !== "number") return;
      const mode = game.game_mode as string;
      if (!byMode.has(mode)) byMode.set(mode, []);
      byMode.get(mode)!.push({ mmr: mmrVal, date: game.played_at });
    });

    const activeModes = MODES.filter((m) => (byMode.get(m)?.length ?? 0) >= 2);
    if (activeModes.length === 0) return { points: [], activeModes: [], colors: MODE_COLORS };

    // Build unified timeline across all active modes
    const allDates = Array.from(
      new Set(activeModes.flatMap((m) => byMode.get(m)!.map((p) => p.date)))
    ).sort();

    const lastKnown: Record<string, number | null> = {};
    activeModes.forEach((m) => { lastKnown[m] = null; });

    const points = allDates.map((date) => {
      activeModes.forEach((m) => {
        const pt = byMode.get(m)!.find((p) => p.date === date);
        if (pt) lastKnown[m] = pt.mmr;
      });
      const entry: Record<string, string | number | null> = {
        label: format(new Date(date), "MMM d"),
        fullLabel: format(new Date(date), "MMM d, yyyy"),
      };
      activeModes.forEach((m) => { entry[m] = lastKnown[m]; });
      return entry;
    });

    return { points, activeModes, colors: MODE_COLORS };
  }, [rangeFilteredGames, userTarget]);

  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!user) return null;

  const timeRangePills: Array<{ value: TimeRange; label: string }> = [
    { value: "season", label: currentSeasonName },
    { value: "7d",     label: "7D"              },
    { value: "30d",    label: "30D"             },
    { value: "all",    label: "All"             },
  ];

  const togetherRangePills: Array<{ value: TogetherRange; label: string }> = [
    { value: "session", label: "Session"        },
    { value: "7d",      label: "7D"             },
    { value: "28d",     label: "28D"            },
    { value: "season",  label: currentSeasonName},
    { value: "all",     label: "All"            },
  ];

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* ── Page tab switcher ── */}
        <div className="flex p-1 rounded-xl bg-muted/50 border border-border/40 animate-fade-in-up">
          <button
            onClick={() => setPageTab("stats")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              pageTab === "stats"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 className="w-3.5 h-3.5" /> My Stats
          </button>
          <button
            onClick={() => setPageTab("leaderboard")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              pageTab === "leaderboard"
                ? "bg-yellow-400/15 text-yellow-300 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </button>
        </div>

        {pageTab === "leaderboard" ? (
          <LeaderboardView
            currentUserId={user?.id}
            friendUserIds={friends.map((f) => f.user_id)}
          />
        ) : (<>

        {/* ── My Stats sub-view toggle: Stats / Tournaments ── */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/30 w-fit animate-fade-in-up">
          <button
            onClick={() => setStatsView("stats")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              statsView === "stats"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 className="w-3 h-3" /> Stats
          </button>
          <button
            onClick={() => setStatsView("tournaments")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              statsView === "tournaments"
                ? "bg-yellow-400/15 text-yellow-300 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="w-3 h-3" /> Tournaments
          </button>
        </div>

        {statsView === "tournaments" ? (
          user ? <TournamentHistoryPanel userId={user.id} /> : null
        ) : (<>

        {/* ── Filters — always visible, no accordion; hidden in together view ── */}
        {!selectedFriend && (
          <div className="space-y-2 animate-fade-in-up">
            {/* Row 1: time range pills + Summary/Charts toggle */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {timeRangePills.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setTimeRange(pill.value)}
                    className={cn(
                      "flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0",
                      timeRange === pill.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-0.5 bg-muted/50 border border-border/30 rounded-lg p-0.5 shrink-0">
                {([
                  { v: "summary" as ViewMode, icon: BarChart2,      label: "Summary" },
                  { v: "charts"  as ViewMode, icon: LineChartIcon,  label: "Charts"  },
                ] as const).map(({ v, icon: Icon, label }) => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    title={label}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                      viewMode === v
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Mode pill row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Standard mode pills */}
              {([
                { value: "all", label: "All" },
                { value: "1v1", label: "1v1" },
                { value: "2v2", label: "2v2" },
                { value: "3v3", label: "3v3" },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setSelectedMode(value); setSelectedType("all"); setShowOthersPanel(false); }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0",
                    selectedMode === value && !isOthersActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                  )}
                >{label}</button>
              ))}
              <button
                onClick={() => setShowOthersPanel((p) => !p)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0",
                  isOthersActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                )}
              >
                Others {showOthersPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {/* Spacer + friend filter */}
              <div className="flex-1" />
              <Select value={selectedFriendId} onValueChange={setSelectedFriendId} disabled={friendOptions.length === 0}>
                <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 w-auto px-2.5 gap-1">
                  <SelectValue placeholder="All teammates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teammates</SelectItem>
                  {friendOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {(isOthersActive || selectedFriendId !== "all") && (
                <button
                  onClick={() => { setSelectedMode("all"); setSelectedType("all"); setSelectedFriendId("all"); setShowOthersPanel(false); }}
                  className="h-8 flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FilterX className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Others sub-panel */}
            {showOthersPanel && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Casual Soccer</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { mode: "1v1", label: "1v1", type: "casual" },
                      { mode: "2v2", label: "2v2", type: "casual" },
                      { mode: "3v3", label: "3v3", type: "casual" },
                      { mode: "4v4", label: "4v4", type: "casual" },
                    ] as const).map(({ mode, label, type }) => {
                      const isActive = selectedMode === mode && selectedType === type;
                      return (
                        <button
                          key={mode}
                          onClick={() => { setSelectedMode(mode as GameMode); setSelectedType(type as GameType); }}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                          )}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Extra Competitive</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { mode: "rumble_3v3",     label: "3v3 Rumble"    },
                      { mode: "hoops_2v2",      label: "2v2 Hoops"     },
                      { mode: "snowday_3v3",    label: "3v3 Snow Day"  },
                      { mode: "dropshot_3v3",   label: "3v3 Dropshot"  },
                      { mode: "heatseeker_2v2", label: "2v2 Heatseeker"},
                    ] as const).map(({ mode, label }) => {
                      const isActive = selectedMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => { setSelectedMode(mode as GameMode); setSelectedType("all"); }}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                          )}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Content ── */}
        {userSummary.games === 0 ? (
          games.length === 0 ? (
            <Card className="border-dashed border-border/50 animate-fade-in-up">
              <CardContent className="py-14 text-center space-y-4">
                <BarChart2 className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="font-display font-semibold text-base">No games yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Log your first game to start tracking stats</p>
                </div>
                <Link to="/log-game"><Button variant="hero" size="sm">Log a Game</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-border/50 animate-fade-in-up">
              <CardContent className="py-14 text-center space-y-4">
                <FilterX className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="font-display font-semibold text-base">No games match your filters</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting the filters above</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSelectedMode("all"); setSelectedType("all"); setSelectedFriendId("all"); }}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )
        ) : viewMode === "summary" ? (
          <div className="space-y-4">
            {selectedFriend && teammateSummary ? (
              <>
                {/* Back link + together time range pills — single compact row */}
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    to={`/profile/${selectedFriend.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <span className="text-sm leading-none">←</span>
                    {selectedFriend.label}
                  </Link>
                  <div className="w-px h-3.5 bg-border/50 shrink-0" />
                  <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {togetherRangePills.map((pill) => (
                      <button
                        key={pill.value}
                        onClick={() => setTogetherRange(pill.value)}
                        className={cn(
                          "flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0",
                          togetherRange === pill.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                        )}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ComparisonTable
                  userSummary={userSummary}
                  teammateSummary={teammateSummary}
                  teammateName={selectedFriend.label}
                  userAvatarUrl={userAvatarUrl}
                  teammateAvatarUrl={selectedFriend.avatar_url}
                  overallWinRate={overallWinRate}
                />

                {/* Recent games together — Dashboard-style */}
                {recentSharedGames.length > 0 && (
                  <div className="space-y-2 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-base">Recent Games Together</h3>
                      <span className="text-xs text-muted-foreground">{recentSharedGames.length} game{recentSharedGames.length !== 1 ? "s" : ""}</span>
                    </div>
                    {recentSharedGames.slice(0, togetherVisibleCount).map((g) => {
                      const isWin       = g.result === "win";
                      const isExpanded  = togetherExpandedGameId === g.id;
                      const players     = g.game_players || [];
                      const userRow     = findPlayer(players, userTarget)!;
                      const teammateRow = findPlayer(players, teammateTarget!);
                      const userTeam    = userRow?.team ?? null;
                      const teamGoals   = userTeam !== null ? players.filter((p) => p.team === userTeam).reduce((s, p) => s + safeNumber(p.goals), 0) : null;
                      const oppGoals    = userTeam !== null ? players.filter((p) => p.team !== userTeam && p.team != null).reduce((s, p) => s + safeNumber(p.goals), 0) : null;
                      const hasScore    = teamGoals !== null && oppGoals !== null;
                      const teamSize    = g.game_mode === "1v1" ? 1 : (g.game_mode === "2v2" || g.game_mode === "hoops_2v2" || g.game_mode === "heatseeker_2v2") ? 2 : 3;
                      const userCarry      = userRow?.contribution_score ?? 0;
                      const userTeamFirst  = userRow?.team ?? "blue";
                      const teamOrder      = [userTeamFirst, userTeamFirst === "blue" ? "orange" : "blue"] as const;
                      const sortedPlayers  = [...players].sort((a, b) => {
                        const aIdx = teamOrder.indexOf((a.team ?? "blue") as typeof teamOrder[number]);
                        const bIdx = teamOrder.indexOf((b.team ?? "blue") as typeof teamOrder[number]);
                        if (aIdx !== bIdx) return aIdx - bIdx;
                        return safeNumber(b.contribution_score) - safeNumber(a.contribution_score);
                      });
                      return (
                        <Card key={g.id} className={cn("overflow-hidden transition-all duration-200", isWin ? "border-rl-green/20" : "border-rl-red/20")}>
                          {/* Colored top stripe */}
                          <div className={cn("h-0.5 w-full", isWin ? "bg-gradient-to-r from-rl-green/80 via-rl-green/40 to-transparent" : "bg-gradient-to-r from-rl-red/80 via-rl-red/40 to-transparent")} />
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={cn("w-1.5 h-8 rounded-full flex-shrink-0", isWin ? "bg-rl-green shadow-[0_0_8px_hsl(var(--rl-green)/0.6)]" : "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]")} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-nowrap">
                                    <span className={cn("font-display font-bold text-sm flex-shrink-0", isWin ? "text-rl-green" : "text-rl-red")}>{isWin ? "WIN" : "LOSS"}</span>
                                    {hasScore && (
                                      <span className="font-display font-bold text-sm flex-shrink-0">
                                        <span className={isWin ? "text-rl-green" : "text-rl-red"}>{teamGoals}</span>
                                        <span className="text-muted-foreground mx-0.5">–</span>
                                        <span className="text-muted-foreground">{oppGoals}</span>
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">{g.game_mode}</Badge>
                                    {userRow?.is_mvp && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 flex-shrink-0">MVP</span>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{format(new Date(g.played_at), "MMM d, h:mm a")}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {userRow && (
                                  <div className="text-right">
                                    <p className="font-mono text-sm font-bold">{userRow.score} pts</p>
                                    <p className="text-xs text-muted-foreground">{userRow.goals}G {userRow.assists}A {userRow.saves}SV{userRow.shots != null ? ` ${userRow.shots}SH` : ""}</p>
                                    {userCarry > 0 && (
                                      <div className="flex items-center gap-1.5 mt-1 justify-end">
                                        <CarryMeter score={userCarry} teamSize={teamSize} size="sm" />
                                      </div>
                                    )}
                                  </div>
                                )}
                                <button onClick={() => setTogetherExpandedGameId(isExpanded ? null : g.id)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded player breakdown */}
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-border/40">
                                <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 pb-1.5 mb-0.5 border-b border-border/20">
                                  <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
                                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
                                  <span className="text-[9px] text-muted-foreground font-semibold text-right">G</span>
                                  <span className="text-[9px] text-muted-foreground font-semibold text-right">A</span>
                                  <span className="text-[9px] text-muted-foreground font-semibold text-right">SV</span>
                                  <span className="text-[9px] text-muted-foreground font-semibold text-right">SH</span>
                                </div>
                                {teamOrder.map((teamColor) => {
                                  const teamRows = sortedPlayers.filter((p) => (p.team ?? "blue") === teamColor);
                                  if (!teamRows.length) return null;
                                  return (
                                    <div key={teamColor} className="mb-1">
                                      <p className={cn("text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 px-2", teamColor === "blue" ? "text-blue-400" : "text-orange-400")}>{teamColor}</p>
                                      {teamRows.map((p) => {
                                        const isMe = matchesTarget(p, userTarget);
                                        const isFriend = teammateTarget ? matchesTarget(p, teammateTarget) : false;
                                        return (
                                          <div key={p.id} className={cn("grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 items-start py-1.5 px-2 rounded-md", isMe && "bg-primary/5", isFriend && !isMe && "bg-secondary/5")}>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                {p.user_id && !isMe ? (
                                                  <Link
                                                    to={`/profile/${p.user_id}`}
                                                    className="inline-flex items-center gap-0.5 text-xs font-medium leading-snug break-words min-w-0 text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary hover:decoration-primary/60 transition-colors"
                                                  >
                                                    {p.player_name}
                                                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                                                  </Link>
                                                ) : (
                                                  <span className={cn("text-xs font-medium leading-snug break-words min-w-0", isMe ? "text-primary" : isFriend ? "text-secondary" : "text-foreground")}>{p.player_name}</span>
                                                )}
                                                {p.is_mvp && <span className="text-[9px] text-yellow-400 font-bold leading-snug flex-shrink-0">MVP</span>}
                                              </div>
                                              {safeNumber(p.contribution_score) > 0 && (
                                                <div className="mt-0.5"><CarryMeter score={safeNumber(p.contribution_score)} teamSize={teamSize} size="sm" /></div>
                                              )}
                                            </div>
                                            <span className="text-xs font-mono font-bold text-right leading-snug">{p.score}</span>
                                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.goals}</span>
                                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.assists}</span>
                                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.saves}</span>
                                            <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.shots}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {recentSharedGames.length > togetherVisibleCount && (
                      <button
                        onClick={() => setTogetherVisibleCount((n) => n + 10)}
                        className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Show more ({recentSharedGames.length - togetherVisibleCount} remaining)
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <SoloSummaryList summary={userSummary} />
            )}
            {bestContributionGames.length > 0 && (
              <BestContributionCard
                bestContributionGames={bestContributionGames}
                userTarget={userTarget}
                expandedGameId={expandedContribGameId}
                onToggleGame={(id) => setExpandedContribGameId((v) => v === id ? null : id)}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2 overflow-x-hidden">
              {chartDefinitions.map((c) => (
                <StatChart
                  key={c.id}
                  title={c.title}
                  description={c.description}
                  data={chartData}
                  userKey={c.userKey}
                  teammateKey={selectedFriend && "teammateKey" in c ? c.teammateKey : undefined}
                  teammateLabel={selectedFriend?.label}
                  yAxisFormatter={c.yAxisFormatter}
                  yAxisDomain={c.yAxisDomain}
                  accentColor={c.accentColor}
                />
              ))}
            </div>

            {mmrChartData.activeModes.length > 0 && (
              <Card className="overflow-hidden animate-fade-in-up">
                <div className="h-[2px] w-full" style={{ background: "linear-gradient(to right, hsl(212, 95%, 58%), transparent)" }} />
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base font-display">MMR History</CardTitle>
                  <CardDescription className="text-xs">Competitive MMR per game · filtered by selected time range</CardDescription>
                </CardHeader>
                <CardContent className="overflow-hidden pt-0">
                  <ChartContainer
                    config={Object.fromEntries(mmrChartData.activeModes.map((m) => [m, { label: m, color: mmrChartData.colors[m] }]))}
                    className="h-56 w-full max-w-full"
                  >
                    <AreaChart data={mmrChartData.points} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
                      <defs>
                        {mmrChartData.activeModes.map((m) => (
                          <linearGradient key={m} id={`grad-mmr-${m}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={mmrChartData.colors[m]} stopOpacity={0.25} />
                            <stop offset="90%" stopColor={mmrChartData.colors[m]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border)/0.25)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} width={50} domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} />} />
                      {mmrChartData.activeModes.map((m) => (
                        <Area
                          key={m}
                          type="monotone"
                          dataKey={m}
                          stroke={mmrChartData.colors[m]}
                          strokeWidth={2}
                          fill={`url(#grad-mmr-${m})`}
                          dot={false}
                          connectNulls
                          activeDot={{ r: 4, strokeWidth: 2, stroke: mmrChartData.colors[m], fill: "hsl(var(--background))" }}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      ))}
                      {mmrChartData.activeModes.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {bestContributionGames.length > 0 && (
              <BestContributionCard
                bestContributionGames={bestContributionGames}
                userTarget={userTarget}
                expandedGameId={expandedContribGameId}
                onToggleGame={(id) => setExpandedContribGameId((v) => v === id ? null : id)}
              />
            )}
          </div>
        )}
        </>)}
        </>)}
      </div>
    </AppLayout>
  );
};

export default Stats;
