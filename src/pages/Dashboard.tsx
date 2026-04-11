import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Loader2, Trophy, Target, TrendingUp, ChevronRight, Zap } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/layout/AppLayout";

type GameMode = Database["public"]["Enums"]["game_mode"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GameWithPlayers = GameRow & { game_players: GamePlayerRow[] };

type RankData = {
  game_mode: GameMode;
  rank_tier: RankTier;
  rank_division: RankDivision | null;
  mmr: number | null;
};

const rankDisplayName = (tier: RankTier): string =>
  tier === "unranked"
    ? "Unranked"
    : tier
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

const gameModeLabels: Record<GameMode, string> = {
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
};

const normalizeName = (v?: string | null) => v?.trim().toLowerCase() ?? "";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ranks, setRanks] = useState<RankData[]>([]);
  const [games, setGames] = useState<GameWithPlayers[]>([]);
  const [rlName, setRlName] = useState<string | null>(null);

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
            .select("id, played_at, game_mode, game_type, result, created_at, created_by, division_change, screenshot_url, game_players (id, user_id, player_name, score, goals, assists, saves, shots, is_mvp, submission_status, submitted_by, created_at, game_id)")
            .eq("created_by", user.id)
            .order("played_at", { ascending: false })
            .limit(20),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (ranksRes.error) throw ranksRes.error;
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

  const quickStats = useMemo(() => {
    let totalGames = 0;
    let wins = 0;
    let totalScore = 0;
    let totalGoals = 0;
    let mvps = 0;

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
      winRate: totalGames ? Math.round((wins / totalGames) * 100) : 0,
      avgScore: totalGames ? Math.round(totalScore / totalGames) : 0,
      totalGoals,
      mvps,
    };
  }, [games, userTarget]);

  const recentStreak = useMemo(() => {
    const results: string[] = [];
    for (const g of games.slice(0, 5)) {
      results.push(g.result === "win" ? "W" : "L");
    }
    return results;
  }, [games]);

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
              const div = rank?.rank_division;
              return (
                <Card key={mode} className="border-border/50 bg-gradient-card text-center">
                  <CardContent className="pt-4 pb-3 px-2">
                    <p className="text-xs text-muted-foreground font-medium mb-1">{gameModeLabels[mode]}</p>
                    <p className="font-display font-bold text-sm leading-tight">
                      {rankDisplayName(tier)}
                    </p>
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
                    r === "W"
                      ? "bg-rl-green/20 text-rl-green"
                      : "bg-rl-red/20 text-rl-red"
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
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  View All
                </Button>
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
                const userRow = game.game_players?.find(
                  (p) =>
                    (userTarget.userId && p.user_id === userTarget.userId) ||
                    userTarget.names.includes(normalizeName(p.player_name))
                );
                const isWin = game.result === "win";

                return (
                  <Card key={game.id} className="border-border/50 bg-card/80">
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-8 rounded-full ${
                            isWin ? "bg-rl-green" : "bg-rl-red"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-sm">
                              {isWin ? "WIN" : "LOSS"}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {game.game_mode}
                            </Badge>
                            {game.division_change && (
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
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(game.played_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                      {userRow && (
                        <div className="text-right">
                          <p className="font-mono text-sm font-bold">{userRow.score} pts</p>
                          <p className="text-xs text-muted-foreground">
                            {userRow.goals}G {userRow.assists}A {userRow.saves}S
                          </p>
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
