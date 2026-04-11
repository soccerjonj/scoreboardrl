import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Loader2, Trophy, Target, TrendingUp, ChevronRight, Zap, ChevronDown, ChevronUp } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarryMeter } from "@/components/game/CarryMeter";
import { calculateCarryScores } from "@/lib/carryScore";
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

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, ranksRes, gamesRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name, username").eq("user_id", user.id).single(),
          supabase.from("ranks").select("game_mode, rank_tier, rank_division, mmr").eq("user_id", user.id).eq("game_type", "competitive"),
          supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, carry_score, submission_status, submitted_by, created_at, game_id)")
            .eq("created_by", user.id)
            .order("played_at", { ascending: false })
            .limit(20),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (ranksRes.error)   throw ranksRes.error;
        if (gamesRes.error)   throw gamesRes.error;

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

  // ── Backfill carry scores for old games that were logged without them ────────
  const backfillCarryScores = useCallback(async (loadedGames: GameWithPlayers[]) => {
    if (!user) return;

    const needsBackfill = loadedGames.filter((game) => {
      const players = game.game_players ?? [];
      // Only backfill if every player has team data and at least one has a null carry_score
      const allHaveTeam    = players.every((p) => p.team != null);
      const someNullCarry  = players.some((p) => p.carry_score === null);
      return allHaveTeam && someNullCarry && players.length > 2; // skip 1v1 (2 players total)
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

      const carryResults = calculateCarryScores(playersForCalc);

      // Batch-update each player row
      await Promise.all(
        carryResults.map((r) => {
          const row = (game.game_players ?? []).find(
            (p) => normalizeName(p.player_name) === normalizeName(r.name)
          );
          if (!row) return Promise.resolve();
          return supabase
            .from("game_players")
            .update({ carry_score: r.carry_score })
            .eq("id", row.id);
        })
      );
    }

    // Refresh games so carry scores render immediately
    const { data } = await supabase
      .from("games")
      .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, carry_score, submission_status, submitted_by, created_at, game_id)")
      .eq("created_by", user.id)
      .order("played_at", { ascending: false })
      .limit(20);

    if (data) setGames(data as GameWithPlayers[]);
  }, [user]);

  useEffect(() => {
    if (!loading && games.length > 0) {
      backfillCarryScores(games);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    <p className="font-display font-bold text-sm leading-tight">{rankDisplayName(tier)}</p>
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
              <CardContent className="py-8 text-center space-y-3">
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
                const userCarry  = userRow?.carry_score ?? 0;

                // Sort players: blue team first, then orange; carrier row first within team
                const sortedPlayers = [...players].sort((a, b) => {
                  if ((a.team ?? "blue") < (b.team ?? "orange")) return -1;
                  if ((a.team ?? "blue") > (b.team ?? "orange")) return  1;
                  return (b.carry_score ?? 0) - (a.carry_score ?? 0);
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
                                  Carry
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
                                <CarryMeter score={userCarry} size="sm" className="mt-1 justify-end" />
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
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-xs text-muted-foreground font-mono">
                                          {p.goals}G {p.assists}A {p.saves}S
                                        </span>
                                        <span className="text-xs font-mono font-bold w-12 text-right">{p.score}</span>
                                        <div className="w-28 flex justify-end">
                                          {(p.carry_score ?? 0) > 0
                                            ? <CarryMeter score={p.carry_score!} size="sm" />
                                            : <span className="text-[10px] text-muted-foreground/40 font-mono">—</span>
                                          }
                                        </div>
                                      </div>
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
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
