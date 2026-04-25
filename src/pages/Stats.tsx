import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, BarChart2, LineChart as LineChartIcon, FilterX, Filter, ChevronDown, ChevronUp } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarryMeter } from "@/components/game/CarryMeter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import AppLayout from "@/components/layout/AppLayout";

type GameMode = Database["public"]["Enums"]["game_mode"];
type GameType = Database["public"]["Enums"]["game_type"];
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
type GameWithPlayers = GameRow & { game_players: GamePlayerRow[] };

type FriendProfile = { user_id: string; username: string; rl_account_name: string | null };

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

type TimeRange = "7d" | "30d" | "all";
type ViewMode = "summary" | "charts";

const gameModes: Array<{ value: GameMode | "all"; label: string }> = [
  { value: "all", label: "All modes" },
  { value: "1v1", label: "1v1" },
  { value: "2v2", label: "2v2" },
  { value: "3v3", label: "3v3" },
];

const gameTypes: Array<{ value: GameType | "all"; label: string }> = [
  { value: "all", label: "All types" },
  { value: "competitive", label: "Competitive" },
  { value: "casual", label: "Casual" },
];

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

// ─── Summary view components ─────────────────────────────────────────────────

type StatRowDef = {
  key: keyof SummaryStats;
  label: string;
  formatter: (v: number | null) => string;
  highlight?: "higher" | "lower"; // which side "wins"
};

const STAT_ROWS: StatRowDef[] = [
  { key: "winRate",               label: "Win Rate",          formatter: formatPercent,                    highlight: "higher" },
  { key: "pointsPerGame",         label: "Avg Score",         formatter: (v) => formatAverage(v, 1),      highlight: "higher" },
  { key: "goalsPerGame",          label: "Avg Goals",         formatter: (v) => formatAverage(v, 2),      highlight: "higher" },
  { key: "assistsPerGame",        label: "Avg Assists",       formatter: (v) => formatAverage(v, 2),      highlight: "higher" },
  { key: "savesPerGame",          label: "Avg Saves",         formatter: (v) => formatAverage(v, 2),      highlight: "higher" },
  { key: "shotsPerGame",          label: "Avg Shots",         formatter: (v) => formatAverage(v, 2),      highlight: "higher" },
  { key: "mvpRate",               label: "MVP Rate",          formatter: formatPercent,                    highlight: "higher" },
  { key: "teamGoalsForPerGame",   label: "Team Goals For",    formatter: (v) => formatAverage(v, 2),      highlight: "higher" },
  { key: "teamGoalsAgainstPerGame", label: "Team Goals Against", formatter: (v) => formatAverage(v, 2),   highlight: "lower"  },
  { key: "avgContributionScore",   label: "Avg Contribution Score", formatter: (v) => formatAverage(v, 1), highlight: "higher" },
];

/** Solo summary: clean card grid */
const SoloSummaryGrid = ({ summary }: { summary: SummaryStats }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {STAT_ROWS.map((row) => {
      const val = summary[row.key] as number | null;
      return (
        <Card key={row.key} className="border-border/50 bg-card/80">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
            <p className="font-display font-bold text-2xl">{row.formatter(val)}</p>
          </CardContent>
        </Card>
      );
    })}
  </div>
);

/** Comparison table: You vs Teammate */
const ComparisonTable = ({
  userSummary,
  teammateSummary,
  teammateName,
}: {
  userSummary: SummaryStats;
  teammateSummary: SummaryStats;
  teammateName: string;
}) => {
  return (
    <Card className="border-border/50 bg-card/80 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display">Head-to-Head Stats</CardTitle>
        <CardDescription className="text-xs">
          {userSummary.games} shared game{userSummary.games !== 1 ? "s" : ""} with {teammateName}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Header row */}
        <div className="grid grid-cols-3 px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground border-b border-border/30">
          <span className="text-primary">You</span>
          <span className="text-center">Stat</span>
          <span className="text-right text-secondary">{teammateName}</span>
        </div>
        {/* Stat rows */}
        {STAT_ROWS.map((row, i) => {
          const uVal = userSummary[row.key] as number | null;
          const tVal = teammateSummary[row.key] as number | null;

          let uWins = false, tWins = false;
          if (uVal !== null && tVal !== null && row.highlight) {
            if (row.highlight === "higher") { uWins = uVal > tVal; tWins = tVal > uVal; }
            else { uWins = uVal < tVal; tWins = tVal < uVal; }
          }

          return (
            <div
              key={row.key}
              className={`grid grid-cols-3 px-4 py-2.5 text-sm border-b border-border/20 last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
            >
              <span className={`font-mono font-bold ${uWins ? "text-rl-green" : tWins ? "text-muted-foreground" : ""}`}>
                {row.formatter(uVal)}
              </span>
              <span className="text-center text-xs text-muted-foreground">{row.label}</span>
              <span className={`text-right font-mono font-bold ${tWins ? "text-rl-green" : uWins ? "text-muted-foreground" : ""}`}>
                {row.formatter(tVal)}
              </span>
            </div>
          );
        })}
        {/* Games row */}
        <div className="grid grid-cols-3 px-4 py-2.5 text-sm bg-muted/20 rounded-b-lg">
          <span className="font-mono font-bold text-muted-foreground">{userSummary.games}</span>
          <span className="text-center text-xs text-muted-foreground">Games</span>
          <span className="text-right font-mono font-bold text-muted-foreground">{teammateSummary.games}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Chart components ─────────────────────────────────────────────────────────

const StatChart = ({ title, description, data, userKey, teammateKey, teammateLabel, yAxisFormatter, yAxisDomain }: {
  title: string;
  description: string;
  data: ChartDatum[];
  userKey: keyof ChartDatum;
  teammateKey?: keyof ChartDatum;
  teammateLabel?: string;
  yAxisFormatter?: (v: number) => string;
  yAxisDomain?: [number, number];
}) => {
  const chartConfig = {
    [userKey]: { label: "You", color: "hsl(var(--rl-blue))" },
    ...(teammateKey && teammateLabel ? { [teammateKey]: { label: teammateLabel, color: "hsl(var(--rl-orange))" } } : {}),
  };
  const hasTeammate = Boolean(teammateKey && teammateLabel);
  const tickInterval = data.length <= 10 ? 0 : data.length <= 20 ? 1 : data.length <= 40 ? 2 : Math.floor(data.length / 10);

  return (
    <Card className="border-border/50 bg-card/80 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <ChartContainer config={chartConfig} className="h-52 w-full max-w-full">
          <LineChart data={data} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey="label" hide />
            <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={yAxisFormatter} domain={yAxisDomain} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} />} />
            <Line type="monotone" dataKey={userKey} stroke={`var(--color-${String(userKey)})`} strokeWidth={2.5} dot={false} />
            {hasTeammate && <Line type="monotone" dataKey={teammateKey} stroke={`var(--color-${String(teammateKey)})`} strokeWidth={2.5} dot={false} />}
            {hasTeammate && <ChartLegend content={<ChartLegendContent />} />}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// ─── Best Contribution Performances card ─────────────────────────────────────

const BestContributionCard = ({
  bestContributionGames,
  userTarget,
  expandedGameId,
  onToggleGame,
}: {
  bestContributionGames: Array<{ game: GameWithPlayers; contributionScore: number }>;
  userTarget: PlayerMatchTarget;
  expandedGameId: string | null;
  onToggleGame: (id: string) => void;
}) => (
  <Card className="border-border/50 bg-card/80">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-display">Best Contribution Performances</CardTitle>
      <CardDescription className="text-xs">Your top contribution games in the current filter</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      {bestContributionGames.map(({ game, contributionScore }) => {
        const userRow  = findPlayer(game.game_players || [], userTarget);
        const isWin    = game.result === "win";
        const isOpen   = expandedGameId === game.id;
        const teamSize = game.game_mode === "1v1" ? 1 : game.game_mode === "2v2" ? 2 : game.game_mode === "3v3" ? 3 : 4;
        const sortedPlayers = [...(game.game_players || [])].sort((a, b) => {
          if ((a.team ?? "blue") < (b.team ?? "orange")) return -1;
          if ((a.team ?? "blue") > (b.team ?? "orange")) return  1;
          return (b.contribution_score ?? 0) - (a.contribution_score ?? 0);
        });

        return (
          <div
            key={game.id}
            className="rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => onToggleGame(game.id)}
          >
            {/* Summary row */}
            <div className="flex items-center justify-between py-2 px-3">
              <div className="flex items-center gap-3">
                <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isWin ? "bg-rl-green" : "bg-rl-red"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-display font-bold">{isWin ? "WIN" : "LOSS"}</span>
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
                <CarryMeter score={contributionScore} size="md" />
                {isOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>

            {/* Expanded scoreboard */}
            {isOpen && (
              <div className="px-3 pb-3 pt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 pb-1.5 mb-0.5 border-b border-border/20">
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Goals</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Assists</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Saves</span>
                  <span className="text-[9px] text-muted-foreground font-semibold text-right">Shots</span>
                </div>
                {["blue", "orange"].map((teamColor) => {
                  const teamRows = sortedPlayers.filter((p) => (p.team ?? "blue") === teamColor);
                  if (teamRows.length === 0) return null;
                  return (
                    <div key={teamColor} className="mb-1">
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 ${teamColor === "blue" ? "text-blue-400" : "text-orange-400"}`}>
                        {teamColor}
                      </p>
                      {teamRows.map((p) => {
                        const isUser = matchesTarget(p, userTarget);
                        return (
                          <div key={p.id} className={`grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 items-start py-1.5 rounded-md ${isUser ? "bg-primary/5 px-2 -mx-2" : ""}`}>
                            {/* 1fr column: min-w-0 lets CSS grid shrink it; name wraps rather than overflowing */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs font-medium leading-snug break-words min-w-0 ${isUser ? "text-primary" : "text-foreground"}`}>
                                  {p.player_name}
                                </span>
                                {p.is_mvp && <span className="text-[9px] text-yellow-400 font-bold leading-snug flex-shrink-0">MVP</span>}
                              </div>
                              {p.contribution_score != null && p.contribution_score > 0 && (
                                <div className="mt-0.5">
                                  <CarryMeter score={p.contribution_score} teamSize={teamSize} size="sm" />
                                </div>
                              )}
                            </div>
                            {/* Stat columns — always top-aligned with the name line */}
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
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GameWithPlayers[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [userRlName, setUserRlName] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode | "all">("all");
  const [selectedType, setSelectedType] = useState<GameType | "all">("all");
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [expandedContribGameId, setExpandedContribGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, friendsRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name").eq("user_id", user.id).single(),
          supabase.from("friend_requests").select("sender_id, receiver_id").eq("status", "accepted").or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (friendsRes.error) throw friendsRes.error;

        const { data: playerGameRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", user.id);

        const linkedGameIds = (playerGameRows || []).map((r) => r.game_id);
        const allIds = Array.from(new Set(linkedGameIds));

        let gamesRes;
        if (allIds.length > 0) {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id, mmr, mmr_change)")
            .or(`created_by.eq.${user.id},id.in.(${allIds.join(",")})`)
            .order("played_at", { ascending: true });
        } else {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id, mmr, mmr_change)")
            .eq("created_by", user.id)
            .order("played_at", { ascending: true });
        }

        if (gamesRes.error) throw gamesRes.error;

        const friendIds = new Set<string>();
        (friendsRes.data || []).forEach((r) => {
          const fid = r.sender_id === user.id ? r.receiver_id : r.sender_id;
          if (fid) friendIds.add(fid);
        });

        let friendProfiles: FriendProfile[] = [];
        if (friendIds.size > 0) {
          const { data } = await supabase.from("profiles").select("user_id, username, rl_account_name").in("user_id", Array.from(friendIds));
          friendProfiles = data || [];
        }

        setUserRlName(profileRes.data?.rl_account_name ?? null);
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

  const userTarget = useMemo(() => buildTarget(user?.id, [userRlName]), [user?.id, userRlName]);
  const teammateTarget = useMemo(() => selectedFriend ? buildTarget(selectedFriend.id, [selectedFriend.rlName, selectedFriend.username]) : null, [selectedFriend]);

  const filteredGames = useMemo(() => games
    .filter((g) => selectedMode === "all" || g.game_mode === selectedMode)
    .filter((g) => selectedType === "all" || g.game_type === selectedType)
    .filter((g) => !teammateTarget || Boolean(findPlayer(g.game_players, teammateTarget))),
  [games, selectedMode, selectedType, teammateTarget]);

  const rangeFilteredGames = useMemo(() => {
    if (timeRange === "all") return filteredGames;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (timeRange === "7d" ? 7 : 30));
    return filteredGames.filter((g) => new Date(g.played_at) >= cutoff);
  }, [filteredGames, timeRange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedMode !== "all") count++;
    if (selectedType !== "all") count++;
    if (selectedFriendId !== "all") count++;
    if (timeRange !== "all") count++;
    return count;
  }, [selectedMode, selectedType, selectedFriendId, timeRange]);

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

        const gameNum   = idx + 1;
        const userTeam  = userRow.team;
        const teamFor   = players.filter((p) => p.team === userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
        const teamAgainst = players.filter((p) => p.team !== userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
        const uScore    = safeNumber(userRow.score);
        const uGoals    = safeNumber(userRow.goals);
        const uAssists  = safeNumber(userRow.assists);
        const uSaves    = safeNumber(userRow.saves);
        const uShots    = safeNumber(userRow.shots);
        const uContrib  = safeNumber(userRow.contribution_score);

        ut.games++; ut.points += uScore; ut.goals += uGoals; ut.assists += uAssists;
        ut.saves += uSaves; ut.shots += uShots;
        ut.teamGoalsFor += teamFor; ut.teamGoalsAgainst += teamAgainst;
        if (game.result === "win") ut.wins++;
        if (userRow.is_mvp) ut.mvp++;
        if (uContrib > 0) { ut.carryTotal += uContrib; ut.carryGames++; }
        uGames++; if (userRow.is_mvp) uMvp++;

        let teammateRow: GamePlayerRow | null = null;
        if (teammateTarget) {
          teammateRow = findPlayer(players, teammateTarget);
          if (teammateRow) {
            const tScore = safeNumber(teammateRow.score), tGoals = safeNumber(teammateRow.goals), tAssists = safeNumber(teammateRow.assists), tSaves = safeNumber(teammateRow.saves), tShots = safeNumber(teammateRow.shots);
            const tContrib = safeNumber(teammateRow.contribution_score);
            const tTeam  = teammateRow.team;
            const tFor   = players.filter((p) => p.team === tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
            const tAgainst = players.filter((p) => p.team !== tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
            tt.games++; tt.points += tScore; tt.goals += tGoals; tt.assists += tAssists; tt.saves += tSaves; tt.shots += tShots;
            tt.teamGoalsFor += tFor; tt.teamGoalsAgainst += tAgainst;
            if (game.result === "win") tt.wins++;
            if (teammateRow.is_mvp) tt.mvp++;
            if (tContrib > 0) { tt.carryTotal += tContrib; tt.carryGames++; }
            tGames++; if (teammateRow.is_mvp) tMvp++;
          }
        }

        data.push({
          label:     `#${gameNum}`,
          fullLabel: `Game ${gameNum} · ${format(new Date(game.played_at), "MMM d, yyyy")}`,
          points: uScore, goals: uGoals, assists: uAssists, saves: uSaves, shots: uShots,
          mvpRate:    uGames ? (uMvp / uGames) * 100 : 0,
          carryScore: uContrib,
          teammatePoints:    teammateRow ? safeNumber(teammateRow.score)   : null,
          teammateGoals:     teammateRow ? safeNumber(teammateRow.goals)   : null,
          teammateAssists:   teammateRow ? safeNumber(teammateRow.assists) : null,
          teammateSaves:     teammateRow ? safeNumber(teammateRow.saves)   : null,
          teammateShots:     teammateRow ? safeNumber(teammateRow.shots)   : null,
          teammateMvpRate:   teammateRow ? (tGames ? (tMvp / tGames) * 100 : 0) : null,
        });
      });
    } else {
      const dateMap = new Map<string, { games: GameWithPlayers[]; dateKey: string }>();
      rangeFilteredGames.forEach((game) => {
        const dateKey = format(new Date(game.played_at), "yyyy-MM-dd");
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, { games: [], dateKey });
        dateMap.get(dateKey)!.games.push(game);
      });

      let uGames = 0, uMvp = 0, tGames = 0, tMvp = 0;

      Array.from(dateMap.entries()).forEach(([dateKey, { games: dayGames }]) => {
        const date  = new Date(dateKey);
        const count = dayGames.length;

        let dayUScore = 0, dayUGoals = 0, dayUAssists = 0, dayUSaves = 0, dayUShots = 0, dayUContrib = 0, dayUMvp = 0;
        let dayUValid = 0;
        let dayTScore = 0, dayTGoals = 0, dayTAssists = 0, dayTSaves = 0, dayTShots = 0, dayTMvp = 0;
        let dayTValid = 0;

        dayGames.forEach((game) => {
          const players = game.game_players || [];
          const userRow = findPlayer(players, userTarget);
          if (!userRow) return;

          const userTeam   = userRow.team;
          const teamFor    = players.filter((p) => p.team === userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
          const teamAgainst = players.filter((p) => p.team !== userTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
          const uScore     = safeNumber(userRow.score);
          const uGoals     = safeNumber(userRow.goals);
          const uAssists   = safeNumber(userRow.assists);
          const uSaves     = safeNumber(userRow.saves);
          const uShots     = safeNumber(userRow.shots);
          const uContrib   = safeNumber(userRow.contribution_score);

          ut.games++; ut.points += uScore; ut.goals += uGoals; ut.assists += uAssists;
          ut.saves += uSaves; ut.shots += uShots;
          ut.teamGoalsFor += teamFor; ut.teamGoalsAgainst += teamAgainst;
          if (game.result === "win") ut.wins++;
          if (userRow.is_mvp) ut.mvp++;
          if (uContrib > 0) { ut.carryTotal += uContrib; ut.carryGames++; }
          uGames++; if (userRow.is_mvp) uMvp++;

          dayUScore += uScore; dayUGoals += uGoals; dayUAssists += uAssists;
          dayUSaves += uSaves; dayUShots += uShots; dayUContrib += uContrib;
          if (userRow.is_mvp) dayUMvp++;
          dayUValid++;

          if (teammateTarget) {
            const teammateRow = findPlayer(players, teammateTarget);
            if (teammateRow) {
              const tScore = safeNumber(teammateRow.score), tGoals = safeNumber(teammateRow.goals), tAssists = safeNumber(teammateRow.assists), tSaves = safeNumber(teammateRow.saves), tShots = safeNumber(teammateRow.shots);
              const tContrib = safeNumber(teammateRow.contribution_score);
              const tTeam  = teammateRow.team;
              const tFor   = players.filter((p) => p.team === tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
              const tAgainst = players.filter((p) => p.team !== tTeam).reduce((s, p) => s + safeNumber(p.goals), 0);
              tt.games++; tt.points += tScore; tt.goals += tGoals; tt.assists += tAssists; tt.saves += tSaves; tt.shots += tShots;
              tt.teamGoalsFor += tFor; tt.teamGoalsAgainst += tAgainst;
              if (game.result === "win") tt.wins++;
              if (teammateRow.is_mvp) tt.mvp++;
              if (tContrib > 0) { tt.carryTotal += tContrib; tt.carryGames++; }
              tGames++; if (teammateRow.is_mvp) tMvp++;

              dayTScore += tScore; dayTGoals += tGoals; dayTAssists += tAssists;
              dayTSaves += tSaves; dayTShots += tShots;
              if (teammateRow.is_mvp) dayTMvp++;
              dayTValid++;
            }
          }
        });

        if (dayUValid === 0) return;
        const hasTeammateData = dayTValid > 0;

        data.push({
          label:     format(date, "MMM d"),
          fullLabel: format(date, "MMM d, yyyy") + (count > 1 ? ` (${count} games)` : ""),
          points:    dayUScore     / dayUValid,
          goals:     dayUGoals    / dayUValid,
          assists:   dayUAssists  / dayUValid,
          saves:     dayUSaves    / dayUValid,
          shots:     dayUShots    / dayUValid,
          carryScore: dayUContrib / dayUValid,
          mvpRate:   uGames ? (uMvp / uGames) * 100 : 0,
          teammatePoints:    hasTeammateData ? dayTScore   / dayTValid : null,
          teammateGoals:     hasTeammateData ? dayTGoals   / dayTValid : null,
          teammateAssists:   hasTeammateData ? dayTAssists / dayTValid : null,
          teammateSaves:     hasTeammateData ? dayTSaves   / dayTValid : null,
          teammateShots:     hasTeammateData ? dayTShots   / dayTValid : null,
          teammateMvpRate:   hasTeammateData ? (tGames ? (tMvp / tGames) * 100 : 0) : null,
        });
      });
    }

    return { chartData: data, userSummary: buildSummary(ut), teammateSummary: teammateTarget ? buildSummary(tt) : null };
  }, [rangeFilteredGames, teammateTarget, userTarget]);

  const chartDefinitions = [
    { id: "points",     title: "Points per Game",  description: "Score output by match.",     userKey: "points"     as const, teammateKey: "teammatePoints"   as const },
    { id: "goals",      title: "Goals per Game",   description: "Finishing stats per match.", userKey: "goals"      as const, teammateKey: "teammateGoals"    as const },
    { id: "assists",    title: "Assists per Game",  description: "Playmaking trend.",          userKey: "assists"    as const, teammateKey: "teammateAssists"  as const },
    { id: "saves",      title: "Saves per Game",   description: "Defensive stops.",           userKey: "saves"      as const, teammateKey: "teammateSaves"    as const },
    { id: "shots",      title: "Shots per Game",   description: "Shot volume.",               userKey: "shots"      as const, teammateKey: "teammateShots"    as const },
    { id: "mvpRate",    title: "MVP Rate",          description: "Cumulative MVP %.",          userKey: "mvpRate"    as const, teammateKey: "teammateMvpRate"  as const, yAxisFormatter: (v: number) => `${Math.round(v)}%`, yAxisDomain: [0, 100] as [number, number] },
    { id: "carryScore", title: "Contribution Score", description: "Your contribution score each game.", userKey: "carryScore" as const, yAxisDomain: [0, 100] as [number, number] },
  ];

  const bestContributionGames = useMemo(() =>
    rangeFilteredGames
      .map((game) => {
        const userRow = findPlayer(game.game_players || [], userTarget);
        return { game, contributionScore: safeNumber(userRow?.contribution_score) };
      })
      .filter((g) => g.contributionScore > 0)
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .slice(0, 5),
  [rangeFilteredGames, userTarget]);

  const mmrHistory = useMemo(() => {
    const points: Array<{ label: string; fullLabel: string; mmr: number }> = [];
    rangeFilteredGames.forEach((game, idx) => {
      const userRow = findPlayer(game.game_players || [], userTarget);
      if (!userRow) return;
      const mmrVal = (userRow as any).mmr;
      if (mmrVal == null || typeof mmrVal !== "number") return;
      points.push({
        label: `#${idx + 1}`,
        fullLabel: `Game ${idx + 1} · ${format(new Date(game.played_at), "MMM d, yyyy")}`,
        mmr: mmrVal,
      });
    });
    return points;
  }, [rangeFilteredGames, userTarget]);

  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!user) return null;

  const timeRangePills: Array<{ value: TimeRange; label: string }> = [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "all", label: "All time" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Stats</h1>
          <p className="text-sm text-muted-foreground">Detailed performance analytics</p>
        </div>

        {/* Compact filter bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            {/* Filters toggle button */}
            <button
              onClick={() => setFiltersExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              {filtersExpanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {/* View mode toggle */}
            <div className="flex gap-1 bg-muted rounded-full p-1">
              <button
                onClick={() => setViewMode("summary")}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  viewMode === "summary" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <BarChart2 className="w-3 h-3" /> Summary
              </button>
              <button
                onClick={() => setViewMode("charts")}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  viewMode === "charts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <LineChartIcon className="w-3 h-3" /> Charts
              </button>
            </div>
          </div>

          {/* Collapsible filter panel */}
          {filtersExpanded && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
              {/* Time range */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium w-14">Time</span>
                <div className="flex gap-2">
                  {timeRangePills.map((pill) => (
                    <button
                      key={pill.value}
                      onClick={() => setTimeRange(pill.value)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        timeRange === pill.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode, Type, Teammate */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mode</Label>
                  <Select value={selectedMode} onValueChange={(v) => setSelectedMode(v as GameMode | "all")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{gameModes.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={selectedType} onValueChange={(v) => setSelectedType(v as GameType | "all")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{gameTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Teammate</Label>
                  <Select value={selectedFriendId} onValueChange={setSelectedFriendId} disabled={friendOptions.length === 0}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teammates</SelectItem>
                      {friendOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedMode("all");
                      setSelectedType("all");
                      setSelectedFriendId("all");
                      setTimeRange("all");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <FilterX className="w-3.5 h-3.5" /> Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{userSummary.games} game{userSummary.games !== 1 ? "s" : ""}</Badge>
          {selectedFriend && <Badge variant="outline">with {selectedFriend.label}</Badge>}
          {selectedMode !== "all" && <Badge variant="outline">{selectedMode}</Badge>}
          {selectedType !== "all" && <Badge variant="outline">{selectedType}</Badge>}
          {timeRange !== "all" && <Badge variant="outline">{timeRange === "7d" ? "Last 7 days" : "Last 30 days"}</Badge>}
        </div>

        {userSummary.games === 0 ? (
          games.length === 0 ? (
            /* No games at all */
            <Card className="border-border/50 bg-card/80 border-dashed">
              <CardContent className="py-12 text-center space-y-4">
                <div className="flex justify-center">
                  <BarChart2 className="w-12 h-12 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-display font-semibold text-base">No games yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Log your first game to start tracking your stats</p>
                </div>
                <Link to="/log-game">
                  <Button variant="hero" size="sm">Log a Game</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            /* Games exist but current filters exclude them */
            <Card className="border-border/50 bg-card/80 border-dashed">
              <CardContent className="py-12 text-center space-y-4">
                <div className="flex justify-center">
                  <FilterX className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-display font-semibold text-base">No games match your filters</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting the mode, type, or time range filters</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMode("all");
                    setSelectedType("all");
                    setSelectedFriendId("all");
                    setTimeRange("all");
                  }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )
        ) : viewMode === "summary" ? (
          /* ── Summary view ── */
          <div className="space-y-4">
            {selectedFriend && teammateSummary ? (
              <ComparisonTable
                userSummary={userSummary}
                teammateSummary={teammateSummary}
                teammateName={selectedFriend.label}
              />
            ) : (
              <SoloSummaryGrid summary={userSummary} />
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
          /* ── Charts view ── */
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
                />
              ))}
            </div>

            {/* MMR History chart */}
            {mmrHistory.length >= 2 && (
              <Card className="border-border/50 bg-card/80 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">MMR History</CardTitle>
                  <CardDescription className="text-xs">Your MMR progression over time (competitive games with MMR tracked)</CardDescription>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  <ChartContainer config={{ mmr: { label: "MMR", color: "hsl(var(--rl-blue))" } }} className="h-52 w-full max-w-full">
                    <LineChart data={mmrHistory} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis dataKey="label" hide />
                      <YAxis tickLine={false} axisLine={false} width={50} domain={["auto", "auto"]} />
                      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} />} />
                      <Line type="monotone" dataKey="mmr" stroke="var(--color-mmr)" strokeWidth={2.5} dot={false} />
                    </LineChart>
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
      </div>
    </AppLayout>
  );
};

export default Stats;
