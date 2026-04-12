import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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
  pointsPerGame: number | null;
  goalsPerGame: number | null;
  assistsPerGame: number | null;
  savesPerGame: number | null;
  shotsPerGame: number | null;
  mvpRate: number | null;
  goalsAgainstPerGame: number | null;
  avgCarryScore: number | null;
};

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

const buildSummary = (t: { games: number; points: number; goals: number; assists: number; saves: number; shots: number; mvp: number; goalsAgainst: number; carryTotal: number; carryGames: number }): SummaryStats => {
  if (!t.games) return { games: 0, pointsPerGame: null, goalsPerGame: null, assistsPerGame: null, savesPerGame: null, shotsPerGame: null, mvpRate: null, goalsAgainstPerGame: null, avgCarryScore: null };
  return {
    games: t.games,
    pointsPerGame: t.points / t.games,
    goalsPerGame: t.goals / t.games,
    assistsPerGame: t.assists / t.games,
    savesPerGame: t.saves / t.games,
    shotsPerGame: t.shots / t.games,
    mvpRate: (t.mvp / t.games) * 100,
    goalsAgainstPerGame: t.goalsAgainst / t.games,
    avgCarryScore: t.carryGames > 0 ? t.carryTotal / t.carryGames : null,
  };
};

const StatCard = ({ title, value, teammateValue, teammateLabel, formatter }: {
  title: string;
  value: number | null;
  teammateValue?: number | null;
  teammateLabel?: string;
  formatter: (v: number | null) => string;
}) => (
  <Card className="border-border/50 bg-card/80">
    <CardContent className="pt-4 pb-3">
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className="font-display font-bold text-xl">{formatter(value)}</p>
      {teammateLabel && teammateValue !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          {teammateLabel}: <span className="text-secondary font-mono">{formatter(teammateValue)}</span>
        </p>
      )}
    </CardContent>
  </Card>
);

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

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <LineChart data={data} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
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

        // Step 1: get all game IDs where user is a player
        const { data: playerGameRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", user.id);

        const linkedGameIds = (playerGameRows || []).map((r) => r.game_id);
        const allIds = Array.from(new Set(linkedGameIds));

        // Step 2: fetch games created by user OR where user appears as player
        let gamesRes;
        if (allIds.length > 0) {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, carry_score, submission_status, submitted_by, created_at, game_id)")
            .or(`created_by.eq.${user.id},id.in.(${allIds.join(",")})`)
            
            .order("played_at", { ascending: true });
        } else {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, carry_score, submission_status, submitted_by, created_at, game_id)")
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

  const { chartData, userSummary, teammateSummary } = useMemo(() => {
    const ut = { games: 0, points: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvp: 0, goalsAgainst: 0, carryTotal: 0, carryGames: 0 };
    const tt = { games: 0, points: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvp: 0, goalsAgainst: 0, carryTotal: 0, carryGames: 0 };
    const data: ChartDatum[] = [];
    let uGames = 0, uMvp = 0, tGames = 0, tMvp = 0;

    filteredGames.forEach((game) => {
      const players = game.game_players || [];
      const userRow = findPlayer(players, userTarget);
      if (!userRow) return;

      const totalGoals  = players.reduce((s, p) => s + safeNumber(p.goals), 0);
      const uScore      = safeNumber(userRow.score);
      const uGoals      = safeNumber(userRow.goals);
      const uAssists    = safeNumber(userRow.assists);
      const uSaves      = safeNumber(userRow.saves);
      const uShots      = safeNumber(userRow.shots);
      const uCarry      = safeNumber(userRow.carry_score);

      ut.games++; ut.points += uScore; ut.goals += uGoals; ut.assists += uAssists;
      ut.saves += uSaves; ut.shots += uShots;
      ut.goalsAgainst += Math.max(0, totalGoals - uGoals);
      if (userRow.is_mvp) ut.mvp++;
      if (uCarry > 0) { ut.carryTotal += uCarry; ut.carryGames++; }
      uGames++; if (userRow.is_mvp) uMvp++;

      let teammateRow: GamePlayerRow | null = null;
      if (teammateTarget) {
        teammateRow = findPlayer(players, teammateTarget);
        if (teammateRow) {
          const tScore = safeNumber(teammateRow.score), tGoals = safeNumber(teammateRow.goals), tAssists = safeNumber(teammateRow.assists), tSaves = safeNumber(teammateRow.saves), tShots = safeNumber(teammateRow.shots);
          const tCarry = safeNumber(teammateRow.carry_score);
          tt.games++; tt.points += tScore; tt.goals += tGoals; tt.assists += tAssists; tt.saves += tSaves; tt.shots += tShots; tt.goalsAgainst += Math.max(0, totalGoals - tGoals);
          if (teammateRow.is_mvp) tt.mvp++;
          if (tCarry > 0) { tt.carryTotal += tCarry; tt.carryGames++; }
          tGames++; if (teammateRow.is_mvp) tMvp++;
        }
      }

      data.push({
        label:     format(new Date(game.played_at), "MMM d"),
        fullLabel: format(new Date(game.played_at), "MMM d, yyyy"),
        points: uScore, goals: uGoals, assists: uAssists, saves: uSaves, shots: uShots,
        mvpRate:    uGames ? (uMvp / uGames) * 100 : 0,
        carryScore: uCarry,
        teammatePoints:    teammateRow ? safeNumber(teammateRow.score)   : null,
        teammateGoals:     teammateRow ? safeNumber(teammateRow.goals)   : null,
        teammateAssists:   teammateRow ? safeNumber(teammateRow.assists) : null,
        teammateSaves:     teammateRow ? safeNumber(teammateRow.saves)   : null,
        teammateShots:     teammateRow ? safeNumber(teammateRow.shots)   : null,
        teammateMvpRate:   teammateRow ? (tGames ? (tMvp / tGames) * 100 : 0) : null,
      });
    });

    return { chartData: data, userSummary: buildSummary(ut), teammateSummary: teammateTarget ? buildSummary(tt) : null };
  }, [filteredGames, teammateTarget, userTarget]);

  const chartDefinitions = [
    { id: "points",     title: "Points per Game",  description: "Score output by match.",     userKey: "points"     as const, teammateKey: "teammatePoints"   as const },
    { id: "goals",      title: "Goals per Game",   description: "Finishing stats per match.", userKey: "goals"      as const, teammateKey: "teammateGoals"    as const },
    { id: "assists",    title: "Assists per Game",  description: "Playmaking trend.",          userKey: "assists"    as const, teammateKey: "teammateAssists"  as const },
    { id: "saves",      title: "Saves per Game",   description: "Defensive stops.",           userKey: "saves"      as const, teammateKey: "teammateSaves"    as const },
    { id: "shots",      title: "Shots per Game",   description: "Shot volume.",               userKey: "shots"      as const, teammateKey: "teammateShots"    as const },
    { id: "mvpRate",    title: "MVP Rate",          description: "Cumulative MVP %.",          userKey: "mvpRate"    as const, teammateKey: "teammateMvpRate"  as const, yAxisFormatter: (v: number) => `${Math.round(v)}%`, yAxisDomain: [0, 100] as [number, number] },
    { id: "carryScore", title: "Carry Score",       description: "How much you carried each game (0 = didn't carry).", userKey: "carryScore" as const, yAxisDomain: [0, 100] as [number, number] },
  ];

  // Best carry performances (top 5 games where user was the carrier)
  const bestCarryGames = useMemo(() =>
    filteredGames
      .map((game) => {
        const userRow = findPlayer(game.game_players || [], userTarget);
        return { game, carryScore: safeNumber(userRow?.carry_score) };
      })
      .filter((g) => g.carryScore > 0)
      .sort((a, b) => b.carryScore - a.carryScore)
      .slice(0, 5),
  [filteredGames, userTarget]);

  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Stats</h1>
          <p className="text-sm text-muted-foreground">Detailed performance analytics</p>
        </div>

        {/* Filters */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
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
          <div className="space-y-1 col-span-2 md:col-span-1">
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

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{userSummary.games} games</Badge>
          {selectedFriend && <Badge variant="outline">vs {selectedFriend.label}</Badge>}
        </div>

        {userSummary.games === 0 ? (
          <Card className="border-border/50 bg-card/80 border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No games match the current filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard title="Pts/Game"      value={userSummary.pointsPerGame}      teammateValue={teammateSummary?.pointsPerGame}      teammateLabel={selectedFriend?.label} formatter={(v) => formatAverage(v, 0)} />
              <StatCard title="Goals/Game"    value={userSummary.goalsPerGame}        teammateValue={teammateSummary?.goalsPerGame}        teammateLabel={selectedFriend?.label} formatter={(v) => formatAverage(v, 2)} />
              <StatCard title="Assists/Game"  value={userSummary.assistsPerGame}      teammateValue={teammateSummary?.assistsPerGame}      teammateLabel={selectedFriend?.label} formatter={(v) => formatAverage(v, 2)} />
              <StatCard title="Saves/Game"    value={userSummary.savesPerGame}        teammateValue={teammateSummary?.savesPerGame}        teammateLabel={selectedFriend?.label} formatter={(v) => formatAverage(v, 2)} />
              <StatCard title="Shots/Game"    value={userSummary.shotsPerGame}        teammateValue={teammateSummary?.shotsPerGame}        teammateLabel={selectedFriend?.label} formatter={(v) => formatAverage(v, 2)} />
              <StatCard title="MVP Rate"      value={userSummary.mvpRate}             teammateValue={teammateSummary?.mvpRate}             teammateLabel={selectedFriend?.label} formatter={formatPercent} />
              <StatCard title="Goals Against" value={userSummary.goalsAgainstPerGame} teammateValue={teammateSummary?.goalsAgainstPerGame} teammateLabel={selectedFriend?.label} formatter={(v) => formatAverage(v, 2)} />
              <StatCard
                title="Avg Carry Score"
                value={userSummary.avgCarryScore}
                teammateValue={teammateSummary?.avgCarryScore}
                teammateLabel={selectedFriend?.label}
                formatter={(v) => formatAverage(v, 1)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
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

            {/* Best Carry Performances */}
            {bestCarryGames.length > 0 && (
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">Best Carry Performances</CardTitle>
                  <CardDescription className="text-xs">Your top carry games in the current filter</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bestCarryGames.map(({ game, carryScore }) => {
                    const userRow  = findPlayer(game.game_players || [], userTarget);
                    const isWin    = game.result === "win";
                    return (
                      <div key={game.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isWin ? "bg-rl-green" : "bg-rl-red"}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-display font-bold">{isWin ? "WIN" : "LOSS"}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{game.game_mode}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(game.played_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {userRow && (
                            <p className="text-xs text-muted-foreground font-mono hidden sm:block">
                              {userRow.goals}G {userRow.assists}A {userRow.saves}S · {userRow.score}pts
                            </p>
                          )}
                          <CarryMeter score={carryScore} size="md" />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Stats;
