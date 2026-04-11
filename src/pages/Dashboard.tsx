import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, User, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type GameMode = Database["public"]["Enums"]["game_mode"];
type GameType = Database["public"]["Enums"]["game_type"];
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];

type GameWithPlayers = GameRow & { game_players: GamePlayerRow[] };

type FriendProfile = {
  user_id: string;
  username: string;
  rl_account_name: string | null;
};

type PlayerMatchTarget = {
  userId?: string | null;
  names: string[];
};

type ChartDatum = {
  label: string;
  fullLabel: string;
  points: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  mvpRate: number;
  teammatePoints?: number | null;
  teammateGoals?: number | null;
  teammateAssists?: number | null;
  teammateSaves?: number | null;
  teammateShots?: number | null;
  teammateMvpRate?: number | null;
};

type SummaryStats = {
  games: number;
  pointsPerGame: number | null;
  goalsPerGame: number | null;
  assistsPerGame: number | null;
  savesPerGame: number | null;
  shotsPerGame: number | null;
  mvpRate: number | null;
  goalsAgainstPerGame: number | null;
};

const gameModes: Array<{ value: GameMode | "all"; label: string }> = [
  { value: "all", label: "All modes" },
  { value: "1v1", label: "1v1 Duel" },
  { value: "2v2", label: "2v2 Doubles" },
  { value: "3v3", label: "3v3 Standard" },
];

const gameTypes: Array<{ value: GameType | "all"; label: string }> = [
  { value: "all", label: "All types" },
  { value: "competitive", label: "Competitive" },
  { value: "casual", label: "Casual" },
];

const normalizeName = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const buildTarget = (userId: string | null | undefined, names: Array<string | null | undefined>): PlayerMatchTarget => ({
  userId,
  names: names.map(normalizeName).filter(Boolean),
});

const matchesTarget = (player: GamePlayerRow, target: PlayerMatchTarget) => {
  if (target.userId && player.user_id === target.userId) {
    return true;
  }

  if (!target.names.length) {
    return false;
  }

  const playerName = normalizeName(player.player_name);
  return target.names.includes(playerName);
};

const findPlayer = (players: GamePlayerRow[] | null | undefined, target: PlayerMatchTarget) =>
  players?.find((player) => matchesTarget(player, target)) ?? null;

const safeNumber = (value: number | null | undefined) => (typeof value === "number" && !Number.isNaN(value) ? value : 0);

const buildSummary = (totals: {
  games: number;
  points: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  mvp: number;
  goalsAgainst: number;
}): SummaryStats => {
  if (!totals.games) {
    return {
      games: 0,
      pointsPerGame: null,
      goalsPerGame: null,
      assistsPerGame: null,
      savesPerGame: null,
      shotsPerGame: null,
      mvpRate: null,
      goalsAgainstPerGame: null,
    };
  }

  return {
    games: totals.games,
    pointsPerGame: totals.points / totals.games,
    goalsPerGame: totals.goals / totals.games,
    assistsPerGame: totals.assists / totals.games,
    savesPerGame: totals.saves / totals.games,
    shotsPerGame: totals.shots / totals.games,
    mvpRate: (totals.mvp / totals.games) * 100,
    goalsAgainstPerGame: totals.goalsAgainst / totals.games,
  };
};

const formatAverage = (value: number | null, decimals = 1) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(decimals);
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${Math.round(value)}%`;
};

const StatCard = ({
  title,
  description,
  value,
  teammateValue,
  teammateLabel,
  formatter,
}: {
  title: string;
  description?: string;
  value: number | null;
  teammateValue?: number | null;
  teammateLabel?: string;
  formatter: (value: number | null) => string;
}) => (
  <Card className="border-border/50 bg-card/80">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-display">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">You</span>
        <span className="font-mono text-lg text-foreground">{formatter(value)}</span>
      </div>
      {teammateLabel && teammateValue !== undefined ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{teammateLabel}</span>
          <span className="font-mono text-lg text-foreground">{formatter(teammateValue)}</span>
        </div>
      ) : null}
    </CardContent>
  </Card>
);

const StatChart = ({
  title,
  description,
  data,
  userKey,
  teammateKey,
  teammateLabel,
  yAxisFormatter,
  yAxisDomain,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  userKey: keyof ChartDatum;
  teammateKey?: keyof ChartDatum;
  teammateLabel?: string;
  yAxisFormatter?: (value: number) => string;
  yAxisDomain?: [number, number];
}) => {
  const chartConfig = {
    [userKey]: {
      label: "You",
      color: "hsl(var(--rl-blue))",
    },
    ...(teammateKey && teammateLabel
      ? {
          [teammateKey]: {
            label: teammateLabel,
            color: "hsl(var(--rl-orange))",
          },
        }
      : {}),
  };

  const hasTeammate = Boolean(teammateKey && teammateLabel);

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={data} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={yAxisFormatter}
              domain={yAxisDomain}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
                />
              }
            />
            <Line
              type="monotone"
              dataKey={userKey}
              stroke={`var(--color-${String(userKey)})`}
              strokeWidth={2.5}
              dot={false}
            />
            {hasTeammate ? (
              <Line
                type="monotone"
                dataKey={teammateKey}
                stroke={`var(--color-${String(teammateKey)})`}
                strokeWidth={2.5}
                dot={false}
              />
            ) : null}
            {hasTeammate ? <ChartLegend content={<ChartLegendContent />} /> : null}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GameWithPlayers[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [userRlName, setUserRlName] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode | "all">("all");
  const [selectedType, setSelectedType] = useState<GameType | "all">("all");
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");
  const hasAnyGames = games.length > 0;

  const resetFilters = () => {
    setSelectedMode("all");
    setSelectedType("all");
    setSelectedFriendId("all");
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [profileResponse, gamesResponse, friendsResponse] = await Promise.all([
          supabase.from("profiles").select("rl_account_name").eq("user_id", user.id).single(),
          supabase
            .from("games")
            .select(
              "id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, score, goals, assists, saves, shots, is_mvp, submission_status, submitted_by, created_at, game_id)",
            )
            .eq("created_by", user.id)
            .order("played_at", { ascending: true }),
          supabase
            .from("friend_requests")
            .select("sender_id, receiver_id")
            .eq("status", "accepted")
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        ]);

        if (profileResponse.error) throw profileResponse.error;
        if (gamesResponse.error) throw gamesResponse.error;
        if (friendsResponse.error) throw friendsResponse.error;

        const friendIds = new Set<string>();
        (friendsResponse.data || []).forEach((row) => {
          const friendId = row.sender_id === user.id ? row.receiver_id : row.sender_id;
          if (friendId) friendIds.add(friendId);
        });

        let friendProfiles: FriendProfile[] = [];
        if (friendIds.size > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("user_id, username, rl_account_name")
            .in("user_id", Array.from(friendIds));

          if (profileError) throw profileError;
          friendProfiles = profiles || [];
        }

        setUserRlName(profileResponse.data?.rl_account_name ?? null);
        setFriends(friendProfiles);
        setGames((gamesResponse.data || []) as GameWithPlayers[]);
      } catch (err: any) {
        toast({
          title: "Failed to load dashboard",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user, toast]);

  const friendOptions = useMemo(() => {
    return friends.map((friend) => ({
      id: friend.user_id,
      label: friend.rl_account_name?.trim() || friend.username,
      rlName: friend.rl_account_name,
      username: friend.username,
    }));
  }, [friends]);

  const selectedFriend = friendOptions.find((friend) => friend.id === selectedFriendId) || null;

  const userTarget = useMemo(() => buildTarget(user?.id, [userRlName]), [user?.id, userRlName]);
  const teammateTarget = useMemo(() => {
    if (!selectedFriend) return null;
    return buildTarget(selectedFriend.id, [selectedFriend.rlName, selectedFriend.username]);
  }, [selectedFriend]);

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => selectedMode === "all" || game.game_mode === selectedMode)
      .filter((game) => selectedType === "all" || game.game_type === selectedType)
      .filter((game) => {
        if (!teammateTarget) return true;
        return Boolean(findPlayer(game.game_players, teammateTarget));
      });
  }, [games, selectedMode, selectedType, teammateTarget]);

  const { chartData, userSummary, teammateSummary, missingUserGames } = useMemo(() => {
    const userTotals = {
      games: 0,
      points: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      shots: 0,
      mvp: 0,
      goalsAgainst: 0,
    };
    const teammateTotals = {
      games: 0,
      points: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      shots: 0,
      mvp: 0,
      goalsAgainst: 0,
    };

    const data: ChartDatum[] = [];
    let missingUser = 0;
    let userGamesCount = 0;
    let userMvpCount = 0;
    let teammateGamesCount = 0;
    let teammateMvpCount = 0;

    filteredGames.forEach((game) => {
      const players = game.game_players || [];
      const userRow = findPlayer(players, userTarget);

      if (!userRow) {
        missingUser += 1;
        return;
      }

      const totalGoals = players.reduce((sum, player) => sum + safeNumber(player.goals), 0);

      const userScore = safeNumber(userRow.score);
      const userGoals = safeNumber(userRow.goals);
      const userAssists = safeNumber(userRow.assists);
      const userSaves = safeNumber(userRow.saves);
      const userShots = safeNumber(userRow.shots);
      const userGoalsAgainst = Math.max(0, totalGoals - userGoals);

      userTotals.games += 1;
      userTotals.points += userScore;
      userTotals.goals += userGoals;
      userTotals.assists += userAssists;
      userTotals.saves += userSaves;
      userTotals.shots += userShots;
      userTotals.goalsAgainst += userGoalsAgainst;
      if (userRow.is_mvp) userTotals.mvp += 1;

      userGamesCount += 1;
      if (userRow.is_mvp) userMvpCount += 1;

      let teammateRow: GamePlayerRow | null = null;
      if (teammateTarget) {
        teammateRow = findPlayer(players, teammateTarget);
        if (teammateRow) {
          const teammateScore = safeNumber(teammateRow.score);
          const teammateGoals = safeNumber(teammateRow.goals);
          const teammateAssists = safeNumber(teammateRow.assists);
          const teammateSaves = safeNumber(teammateRow.saves);
          const teammateShots = safeNumber(teammateRow.shots);
          const teammateGoalsAgainst = Math.max(0, totalGoals - teammateGoals);

          teammateTotals.games += 1;
          teammateTotals.points += teammateScore;
          teammateTotals.goals += teammateGoals;
          teammateTotals.assists += teammateAssists;
          teammateTotals.saves += teammateSaves;
          teammateTotals.shots += teammateShots;
          teammateTotals.goalsAgainst += teammateGoalsAgainst;
          if (teammateRow.is_mvp) teammateTotals.mvp += 1;

          teammateGamesCount += 1;
          if (teammateRow.is_mvp) teammateMvpCount += 1;
        }
      }

      const dateLabel = format(new Date(game.played_at), "MMM d");
      const fullLabel = format(new Date(game.played_at), "MMM d, yyyy");

      data.push({
        label: dateLabel,
        fullLabel,
        points: userScore,
        goals: userGoals,
        assists: userAssists,
        saves: userSaves,
        shots: userShots,
        mvpRate: userGamesCount ? (userMvpCount / userGamesCount) * 100 : 0,
        teammatePoints: teammateRow ? safeNumber(teammateRow.score) : null,
        teammateGoals: teammateRow ? safeNumber(teammateRow.goals) : null,
        teammateAssists: teammateRow ? safeNumber(teammateRow.assists) : null,
        teammateSaves: teammateRow ? safeNumber(teammateRow.saves) : null,
        teammateShots: teammateRow ? safeNumber(teammateRow.shots) : null,
        teammateMvpRate: teammateRow
          ? teammateGamesCount
            ? (teammateMvpCount / teammateGamesCount) * 100
            : 0
          : null,
      });
    });

    return {
      chartData: data,
      userSummary: buildSummary(userTotals),
      teammateSummary: teammateTarget ? buildSummary(teammateTotals) : null,
      missingUserGames: missingUser,
    };
  }, [filteredGames, teammateTarget, userTarget]);

  const chartDefinitions = [
    {
      id: "points",
      title: "Points per Game",
      description: "Score output by match.",
      userKey: "points" as const,
      teammateKey: "teammatePoints" as const,
    },
    {
      id: "goals",
      title: "Goals per Game",
      description: "Finishing stats per match.",
      userKey: "goals" as const,
      teammateKey: "teammateGoals" as const,
    },
    {
      id: "assists",
      title: "Assists per Game",
      description: "Playmaking trend over time.",
      userKey: "assists" as const,
      teammateKey: "teammateAssists" as const,
    },
    {
      id: "saves",
      title: "Saves per Game",
      description: "Defensive stops by match.",
      userKey: "saves" as const,
      teammateKey: "teammateSaves" as const,
    },
    {
      id: "shots",
      title: "Shots per Game",
      description: "Shot volume each game.",
      userKey: "shots" as const,
      teammateKey: "teammateShots" as const,
    },
    {
      id: "mvpRate",
      title: "MVP Rate",
      description: "Cumulative MVP percentage over time.",
      userKey: "mvpRate" as const,
      teammateKey: "teammateMvpRate" as const,
      yAxisFormatter: (value: number) => `${Math.round(value)}%`,
      yAxisDomain: [0, 100] as [number, number],
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-display text-2xl font-bold">
            <span className="text-primary">Scoreboard</span>
            <span className="text-secondary">RL</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Stats Dashboard</h1>
            <p className="text-muted-foreground">Track your Rocket League performance over time.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="outline" className="gap-2">
                <User className="w-4 h-4" />
                Profile
              </Button>
            </Link>
            <Link to="/log-game">
              <Button variant="hero" className="gap-2">
                <Plus className="w-4 h-4" />
                Log Game
              </Button>
            </Link>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg font-display">Filters</CardTitle>
            <CardDescription>Slice stats by game mode and teammate.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Game Mode</Label>
              <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as GameMode | "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="All modes" />
                </SelectTrigger>
                <SelectContent>
                  {gameModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Game Type</Label>
              <Select value={selectedType} onValueChange={(value) => setSelectedType(value as GameType | "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  {gameTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Teammate</Label>
              <Select
                value={selectedFriendId}
                onValueChange={setSelectedFriendId}
                disabled={friendOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All teammates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teammates</SelectItem>
                  {friendOptions.map((friend) => (
                    <SelectItem key={friend.id} value={friend.id}>
                      {friend.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {friendOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add friends to compare stats.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-3">
              <Badge variant="outline">Games: {userSummary.games}</Badge>
              {selectedFriend ? <Badge variant="outline">Comparing: {selectedFriend.label}</Badge> : null}
              {missingUserGames > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {missingUserGames} games missing your player row. Check your account name.
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {userSummary.games === 0 ? (
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg font-display">
                {hasAnyGames ? "No games for current filters" : "No games logged yet"}
              </CardTitle>
              <CardDescription>
                {hasAnyGames
                  ? "Try a different game mode or teammate to see stats."
                  : "Log a game to start tracking your stats."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasAnyGames ? (
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : (
                <Link to="/log-game">
                  <Button variant="hero" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Log your first game
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Points per Game"
                description="Score per match."
                value={userSummary.pointsPerGame}
                teammateValue={teammateSummary?.pointsPerGame ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={(value) => formatAverage(value, 1)}
              />
              <StatCard
                title="Goals per Game"
                description="Finishing output."
                value={userSummary.goalsPerGame}
                teammateValue={teammateSummary?.goalsPerGame ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={(value) => formatAverage(value, 2)}
              />
              <StatCard
                title="Assists per Game"
                description="Playmaking output."
                value={userSummary.assistsPerGame}
                teammateValue={teammateSummary?.assistsPerGame ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={(value) => formatAverage(value, 2)}
              />
              <StatCard
                title="Saves per Game"
                description="Defensive stops."
                value={userSummary.savesPerGame}
                teammateValue={teammateSummary?.savesPerGame ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={(value) => formatAverage(value, 2)}
              />
              <StatCard
                title="Shots per Game"
                description="Shot volume."
                value={userSummary.shotsPerGame}
                teammateValue={teammateSummary?.shotsPerGame ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={(value) => formatAverage(value, 2)}
              />
              <StatCard
                title="MVP Rate"
                description="Percent of games with MVP."
                value={userSummary.mvpRate}
                teammateValue={teammateSummary?.mvpRate ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={formatPercent}
              />
              <StatCard
                title="Goals Against (Avg)"
                description="Goals scored by others in your games."
                value={userSummary.goalsAgainstPerGame}
                teammateValue={teammateSummary?.goalsAgainstPerGame ?? null}
                teammateLabel={selectedFriend?.label}
                formatter={(value) => formatAverage(value, 2)}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {chartDefinitions.map((chart) => (
                <StatChart
                  key={chart.id}
                  title={chart.title}
                  description={chart.description}
                  data={chartData}
                  userKey={chart.userKey}
                  teammateKey={selectedFriend ? chart.teammateKey : undefined}
                  teammateLabel={selectedFriend?.label}
                  yAxisFormatter={chart.yAxisFormatter}
                  yAxisDomain={chart.yAxisDomain}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
