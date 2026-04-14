import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Loader2, Trophy, Target, TrendingUp, ChevronRight, Zap, ChevronDown, ChevronUp, Pencil, Check, X as XIcon, Trash2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CarryMeter } from "@/components/game/CarryMeter";
import { calculateContributionScores } from "@/lib/carryScore";
import { getRankIcon } from "@/lib/rankIcons";
import AppLayout from "@/components/layout/AppLayout";

type GameMode     = Database["public"]["Enums"]["game_mode"];
type RankTier     = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
type GameRow       = Database["public"]["Tables"]["games"]["Row"];
type GameWithPlayers = GameRow & { game_players: GamePlayerRow[] };

type RankData = {
  game_mode:      GameMode;
  rank_tier:      RankTier;
  rank_division:  RankDivision | null;
  mmr:            number | null;
};

const rankDisplayName = (tier: RankTier): string =>
  tier === "unranked"
    ? "Unranked"
    : tier.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const gameModeLabels: Record<GameMode, string> = { "1v1": "1v1", "2v2": "2v2", "3v3": "3v3" };
const normalizeName  = (v?: string | null) => v?.trim().toLowerCase() ?? "";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading]             = useState(true);
  const [ranks, setRanks]                 = useState<RankData[]>([]);
  const [games, setGames]                 = useState<GameWithPlayers[]>([]);
  const [rlName, setRlName]               = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ score: number; goals: number; assists: number; saves: number; shots: number }>({ score: 0, goals: 0, assists: 0, saves: 0, shots: 0 });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, ranksRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name, username").eq("user_id", user.id).single(),
          supabase.from("ranks").select("game_mode, rank_tier, rank_division, mmr").eq("user_id", user.id).eq("game_type", "competitive"),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (ranksRes.error)   throw ranksRes.error;

        // Step 1: get all game IDs where user appears as a player
        const { data: playerGameRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", user.id);

        const linkedGameIds = (playerGameRows || []).map((r) => r.game_id);

        // Step 2: fetch games created by user OR where user is a player
        const allIds = Array.from(new Set([...linkedGameIds]));
        let gamesRes;
        if (allIds.length > 0) {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id)")
            .or(`created_by.eq.${user.id},id.in.(${allIds.join(",")})`)

            .order("played_at", { ascending: false })
            .limit(20);
        } else {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id)")
            .eq("created_by", user.id)
            
            .order("played_at", { ascending: false })
            .limit(20);
        }

        if (gamesRes.error) throw gamesRes.error;

        setRlName(profileRes.data?.rl_account_name ?? null);
        setRanks((ranksRes.data || []) as RankData[]);
        setGames((gamesRes.data || []) as GameWithPlayers[]);
      } catch (err: any) {
        toast({ title: "Failed to load", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, toast]);

  const userTarget = useMemo(() => {
    const names = [normalizeName(rlName)].filter(Boolean);
    return { userId: user?.id, names };
  }, [user?.id, rlName]);

  // ── Backfill contribution scores for old games that were logged without them ──
  const backfillCarryScores = useCallback(async (loadedGames: GameWithPlayers[]) => {
    if (!user) return;

    const teamSumsTo100 = (game: GameWithPlayers) => {
      for (const team of ["blue", "orange"] as const) {
        const tp = (game.game_players ?? []).filter((p) => p.team === team);
        if (tp.length < 2) continue;
        const sum = tp.reduce((s, p) => s + (p.contribution_score ?? 0), 0);
        // Allow ±5 rounding tolerance; anything outside means old algorithm ran
        if (sum < 95 || sum > 105) return false;
      }
      return true;
    };

    const needsBackfill = loadedGames.filter((game) => {
      const players = game.game_players ?? [];
      const allHaveTeam = players.every((p) => p.team != null);
      if (!allHaveTeam) return false;
      // Recalculate if any score is null OR if team scores don't sum to ~100
      return players.some((p) => p.contribution_score === null) || !teamSumsTo100(game);
    });

    if (needsBackfill.length === 0) return;

    for (const game of needsBackfill) {
      const playersForCalc = (game.game_players ?? []).map((p) => ({
        name:    p.player_name,
        team:    p.team as "blue" | "orange",
        score:   p.score,
        goals:   p.goals,
        assists: p.assists,
        saves:   p.saves,
        shots:   p.shots,
      }));

      const contributionMap = calculateContributionScores(playersForCalc);

      // Batch-update each player row
      await Promise.all(
        (game.game_players ?? []).map((row) => {
          const contributionScore = contributionMap.get(normalizeName(row.player_name)) ?? 1;
          return supabase
            .from("game_players")
            .update({ contribution_score: contributionScore })
            .eq("id", row.id);
        })
      );
    }

    // Refresh games so contribution scores render immediately — use same OR logic as initial load
    const { data: playerGameRows2 } = await supabase
      .from("game_players")
      .select("game_id")
      .eq("user_id", user.id);

    const linkedGameIds2 = (playerGameRows2 || []).map((r) => r.game_id);
    const allIds2 = Array.from(new Set([...linkedGameIds2]));

    let refreshRes;
    if (allIds2.length > 0) {
      refreshRes = await supabase
        .from("games")
        .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id)")
        .or(`created_by.eq.${user.id},id.in.(${allIds2.join(",")})`)

        .order("played_at", { ascending: false })
        .limit(20);
    } else {
      refreshRes = await supabase
        .from("games")
        .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id)")
        .eq("created_by", user.id)

        .order("played_at", { ascending: false })
        .limit(20);
    }

    if (refreshRes.data) setGames(refreshRes.data as GameWithPlayers[]);
  }, [user]);

  useEffect(() => {
    if (!loading && games.length > 0) {
      backfillCarryScores(games);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline stat editing ──────────────────────────────────────────────────────
  const handleStatSave = async (game: GameWithPlayers, playerId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("game_players")
        .update({
          score:   editValues.score,
          goals:   editValues.goals,
          assists: editValues.assists,
          saves:   editValues.saves,
          shots:   editValues.shots,
        })
        .eq("id", playerId);
      if (error) throw error;

      // Recalculate contribution scores with updated stats
      const updatedPlayers = (game.game_players ?? []).map((p) =>
        p.id === playerId ? { ...p, ...editValues } : p
      );
      const contributionMap = calculateContributionScores(
        updatedPlayers.map((p) => ({
          name:    p.player_name,
          team:    (p.team ?? "blue") as "blue" | "orange",
          score:   p.score,
          goals:   p.goals,
          assists: p.assists,
          saves:   p.saves,
          shots:   p.shots,
        }))
      );
      await Promise.all(
        updatedPlayers.map((row) => {
          const contributionScore = contributionMap.get(row.player_name.toLowerCase()) ?? 1;
          return supabase.from("game_players").update({ contribution_score: contributionScore }).eq("id", row.id);
        })
      );

      // Update local state
      setGames((prev) =>
        prev.map((g) =>
          g.id !== game.id ? g : {
            ...g,
            game_players: updatedPlayers.map((p) => {
              const cs = contributionMap.get(p.player_name.toLowerCase());
              return cs !== undefined ? { ...p, contribution_score: cs } : p;
            }),
          }
        )
      );

      setEditingPlayerId(null);
      toast({ title: "Stats updated" });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await supabase.from("game_players").delete().eq("game_id", gameId);
      await supabase.from("games").delete().eq("id", gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      setConfirmDeleteId(null);
      setExpandedGameId(null);
      toast({ title: "Game deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  };

  // ── Quick stats ─────────────────────────────────────────────────────────────
  const quickStats = useMemo(() => {
    let totalGames = 0, wins = 0, totalScore = 0, totalGoals = 0, mvps = 0;
    games.forEach((game) => {
      const userRow = game.game_players?.find(
        (p) => (userTarget.userId && p.user_id === userTarget.userId) || userTarget.names.includes(normalizeName(p.player_name))
      );
      if (!userRow) return;
      totalGames++;
      if (game.result === "win") wins++;
      totalScore += userRow.score;
      totalGoals += userRow.goals;
      if (userRow.is_mvp) mvps++;
    });
    return {
      totalGames,
      wins,
      winRate:  totalGames ? Math.round((wins / totalGames) * 100) : 0,
      avgScore: totalGames ? Math.round(totalScore / totalGames) : 0,
      totalGoals,
      mvps,
    };
  }, [games, userTarget]);

  const recentStreak = useMemo(
    () => games.slice(0, 5).map((g) => (g.result === "win" ? "W" : "L")),
    [games]
  );

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your Rocket League overview</p>
          </div>
          <Link to="/log-game">
            <Button variant="hero" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Log Game
            </Button>
          </Link>
        </div>

        {/* Rank Cards */}
        {ranks.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {(["1v1", "2v2", "3v3"] as GameMode[]).map((mode) => {
              const rank = ranks.find((r) => r.game_mode === mode);
              const tier = rank?.rank_tier ?? "unranked";
              const div  = rank?.rank_division;
              return (
                <Card key={mode} className="border-border/50 bg-gradient-card text-center">
                  <CardContent className="pt-4 pb-3 px-2">
                    <p className="text-xs text-muted-foreground font-medium mb-1">{gameModeLabels[mode]}</p>
                    <div className="flex justify-center mb-1">
                      <img src={getRankIcon(tier)} alt={rankDisplayName(tier)} className="w-10 h-10 object-contain" />
                    </div>
                    <p className="font-display font-bold text-xs leading-tight">{rankDisplayName(tier)}</p>
                    {div && tier !== "unranked" && (
                      <p className="text-xs text-muted-foreground">Div {div}</p>
                    )}
                    {rank?.mmr != null && (
                      <p className="text-xs text-primary font-mono mt-1">{rank.mmr} MMR</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {ranks.length === 0 && (
          <Card className="border-border/50 bg-card/80 border-dashed">
            <CardContent className="py-4 text-center">
              <p className="text-sm text-muted-foreground">No ranks set yet.</p>
              <Link to="/profile">
                <Button variant="link" size="sm" className="text-primary">Set your ranks →</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="font-display font-bold text-lg">{quickStats.winRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="font-display font-bold text-lg">{quickStats.avgScore}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rl-green/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-rl-green" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Goals</p>
                <p className="font-display font-bold text-lg">{quickStats.totalGoals}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rl-purple/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-rl-purple" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MVPs</p>
                <p className="font-display font-bold text-lg">{quickStats.mvps}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Form */}
        {recentStreak.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Recent Form</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              {recentStreak.map((r, i) => (
                <span
                  key={i}
                  className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
                    r === "W" ? "bg-rl-green/20 text-rl-green" : "bg-rl-red/20 text-rl-red"
                  }`}
                >
                  {r}
                </span>
              ))}
              <Link to="/stats" className="ml-auto">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
                  View Stats <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recent Games */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Recent Games</h2>
            {games.length > 5 && (
              <Link to="/stats">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">View All</Button>
              </Link>
            )}
          </div>

          {games.length === 0 ? (
            <Card className="border-border/50 bg-card/80 border-dashed">
              <CardContent className="py-12 text-center space-y-6">
                <p className="text-muted-foreground">No games logged yet</p>
                <Link to="/log-game">
                  <Button variant="hero" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Log your first game
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {games.slice(0, 5).map((game) => {
                const players  = game.game_players ?? [];
                const userRow  = players.find(
                  (p) => (userTarget.userId && p.user_id === userTarget.userId) || userTarget.names.includes(normalizeName(p.player_name))
                );
                const isWin      = game.result === "win";
                const isExpanded = expandedGameId === game.id;
                const userCarry  = userRow?.contribution_score ?? 0;
                const teamSize   = game.game_mode === "1v1" ? 1 : game.game_mode === "2v2" ? 2 : 3;

                // Sort players: blue team first, then orange; highest contribution first within team
                const sortedPlayers = [...players].sort((a, b) => {
                  if ((a.team ?? "blue") < (b.team ?? "orange")) return -1;
                  if ((a.team ?? "blue") > (b.team ?? "orange")) return  1;
                  return (b.contribution_score ?? 0) - (a.contribution_score ?? 0);
                });

                return (
                  <Card key={game.id} className="border-border/50 bg-card/80 overflow-hidden">
                    {/* Main row */}
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-8 rounded-full flex-shrink-0 ${isWin ? "bg-rl-green" : "bg-rl-red"}`} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display font-bold text-sm">{isWin ? "WIN" : "LOSS"}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{game.game_mode}</Badge>
                              {game.division_change && game.division_change !== "none" && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    game.division_change === "up"
                                      ? "border-rl-green/50 text-rl-green"
                                      : "border-rl-red/50 text-rl-red"
                                  }`}
                                >
                                  Div {game.division_change === "up" ? "↑" : "↓"}
                                </Badge>
                              )}
                              {userCarry > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-rl-purple/50 text-rl-purple">
                                  Contribution
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(game.played_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {userRow && (
                            <div className="text-right">
                              <p className="font-mono text-sm font-bold">{userRow.score} pts</p>
                              <p className="text-xs text-muted-foreground">
                                {userRow.goals}G {userRow.assists}A {userRow.saves}S
                              </p>
                          {userCarry > 0 && (
                                <div className="flex items-center gap-1.5 mt-1 justify-end">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Contribution</span>
                                  <CarryMeter score={userCarry} teamSize={teamSize} size="sm" />
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded player breakdown */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
                          {["blue", "orange"].map((teamColor) => {
                            const teamRows = sortedPlayers.filter((p) => (p.team ?? "blue") === teamColor);
                            if (teamRows.length === 0) return null;
                            return (
                              <div key={teamColor}>
                                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${teamColor === "blue" ? "text-blue-400" : "text-orange-400"}`}>
                                  {teamColor}
                                </p>
                                {teamRows.map((p) => {
                                  const isUser = (userTarget.userId && p.user_id === userTarget.userId) || userTarget.names.includes(normalizeName(p.player_name));
                                  const isEditing = isUser && editingPlayerId === p.id;
                                  return (
                                    <div key={p.id} className={`flex items-center justify-between py-1 px-2 rounded-md ${isUser ? "bg-primary/5" : ""}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-xs font-medium truncate ${isUser ? "text-primary" : "text-foreground"}`}>
                                          {p.player_name}
                                        </span>
                                        {p.is_mvp && (
                                          <span className="text-[9px] text-yellow-400 font-bold">MVP</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {isEditing ? (
                                          <>
                                            <div className="flex items-center gap-1">
                                              {(["score", "goals", "assists", "saves", "shots"] as const).map((field) => (
                                                <Input
                                                  key={field}
                                                  type="number"
                                                  min={0}
                                                  value={editValues[field]}
                                                  onChange={(e) => setEditValues((prev) => ({ ...prev, [field]: Number(e.target.value) }))}
                                                  className="h-6 w-12 text-xs px-1"
                                                  title={field}
                                                />
                                              ))}
                                            </div>
                                            <button
                                              onClick={() => handleStatSave(game, p.id)}
                                              className="text-rl-green hover:text-rl-green/80 transition-colors p-0.5"
                                              title="Save"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => setEditingPlayerId(null)}
                                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                              title="Cancel"
                                            >
                                              <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-xs text-muted-foreground font-mono">
                                              {p.goals}G {p.assists}A {p.saves}S
                                            </span>
                                            <span className="text-xs font-mono font-bold w-12 text-right">{p.score}</span>
                                            <div className="w-28 flex justify-end">
                                              {(p.contribution_score ?? 0) >= 1
                                                ? <CarryMeter score={p.contribution_score!} teamSize={teamSize} size="sm" />
                                                : <span className="text-[10px] text-muted-foreground/40 font-mono">—</span>
                                              }
                                            </div>
                                            {isUser && (
                                              <button
                                                onClick={() => {
                                                  setEditingPlayerId(p.id);
                                                  setEditValues({
                                                    score:   p.score,
                                                    goals:   p.goals,
                                                    assists: p.assists,
                                                    saves:   p.saves,
                                                    shots:   p.shots,
                                                  });
                                                }}
                                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 ml-1"
                                                title="Edit stats"
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Delete game — only for the game creator, shown when expanded */}
                      {isExpanded && game.created_by === user?.id && (
                        <div className="mt-3 pt-3 border-t border-border/40 flex justify-end">
                          {confirmDeleteId === game.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Delete this game?</span>
                              <button
                                onClick={() => handleDeleteGame(game.id)}
                                className="text-xs font-medium text-rl-red hover:text-rl-red/80 transition-colors"
                              >
                                Yes, delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(game.id)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rl-red transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete game
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
