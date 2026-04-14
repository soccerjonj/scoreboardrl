import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/layout/AppLayout";
import { getRankIcon } from "@/lib/rankIcons";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

interface FriendProfileData {
  rl_account_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_car: string | null;
}

interface RankRow {
  game_mode: GameMode;
  rank_tier: RankTier;
  rank_division: RankDivision | null;
  mmr: number | null;
}

interface GamePlayerRow {
  game_id: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  is_mvp: boolean;
  contribution_score: number | null;
  games: {
    id: string;
    played_at: string;
    game_mode: GameMode;
    result: string;
  } | null;
}

const rankTierLabel: Record<string, string> = {
  unranked: "Unranked",
  bronze_1: "Bronze I", bronze_2: "Bronze II", bronze_3: "Bronze III",
  silver_1: "Silver I", silver_2: "Silver II", silver_3: "Silver III",
  gold_1: "Gold I", gold_2: "Gold II", gold_3: "Gold III",
  platinum_1: "Platinum I", platinum_2: "Platinum II", platinum_3: "Platinum III",
  diamond_1: "Diamond I", diamond_2: "Diamond II", diamond_3: "Diamond III",
  champion_1: "Champion I", champion_2: "Champion II", champion_3: "Champion III",
  grand_champion_1: "Grand Champ I", grand_champion_2: "Grand Champ II", grand_champion_3: "Grand Champ III",
  supersonic_legend: "Supersonic Legend",
};

const gameModes: GameMode[] = ["1v1", "2v2", "3v3"];

const FriendProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [playerRows, setPlayerRows] = useState<GamePlayerRow[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!userId || !user) return;

    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, ranksRes, playerRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("rl_account_name, avatar_url, bio, favorite_car")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("ranks")
            .select("game_mode, rank_tier, rank_division, mmr")
            .eq("user_id", userId)
            .eq("game_type", "competitive"),
          supabase
            .from("game_players")
            .select("game_id, score, goals, assists, saves, shots, is_mvp, contribution_score, games(id, played_at, game_mode, result)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        if (profileRes.error || !profileRes.data) {
          setNotFound(true);
          return;
        }

        setProfile(profileRes.data as FriendProfileData);
        setRanks((ranksRes.data || []) as RankRow[]);
        setPlayerRows((playerRes.data || []) as unknown as GamePlayerRow[]);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, user]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <User className="w-12 h-12 text-muted-foreground/40" />
          <p className="font-display font-semibold text-base">Player not found</p>
          <p className="text-sm text-muted-foreground">This profile doesn't exist or is unavailable.</p>
        </div>
      </AppLayout>
    );
  }

  const displayName = profile.rl_account_name?.trim() || "Unknown Player";

  // Stats from last 20 games
  const validGames = playerRows.filter((r) => r.games != null);
  const totalGames = validGames.length;
  const wins = validGames.filter((r) => r.games?.result === "win").length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : null;
  const bestScore = validGames.reduce((max, r) => Math.max(max, r.score ?? 0), 0);

  // Recent form: last 5
  const recentForm: Array<"W" | "L"> = validGames
    .slice(0, 5)
    .map((r) => (r.games?.result === "win" ? "W" : "L"));

  // Recent 5 games
  const recentGames = validGames.slice(0, 5);

  const rankMap = new Map(ranks.map((r) => [r.game_mode, r]));

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Profile card */}
        <Card className="border-border/50 bg-card/80 overflow-hidden">
          <div className="h-20 bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent" />
          <CardContent className="pt-0 pb-5 px-5">
            <div className="flex items-end gap-4 -mt-10 mb-3">
              <div className="w-20 h-20 rounded-full border-4 border-card bg-muted/40 overflow-hidden shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="pb-1 min-w-0">
                <h1 className="font-display font-bold text-xl leading-tight truncate">{displayName}</h1>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
            )}
          </CardContent>
        </Card>

        {/* Ranks */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Competitive Ranks</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {gameModes.map((mode) => {
              const rank = rankMap.get(mode);
              const tier = rank?.rank_tier ?? "unranked";
              const label = rankTierLabel[tier] ?? tier;
              const mmr = rank?.mmr ?? null;
              return (
                <div key={mode} className="flex flex-col items-center gap-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">{mode}</p>
                  <img
                    src={getRankIcon(tier)}
                    alt={label}
                    className="w-10 h-10 object-contain"
                  />
                  <p className="text-xs font-medium text-center leading-tight">{label}</p>
                  {mmr != null && (
                    <p className="text-[10px] text-muted-foreground">{mmr} MMR</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Stats */}
        {totalGames > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Games</p>
                <p className="font-display font-bold text-2xl">{totalGames}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/80">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                <p className="font-display font-bold text-2xl">{winRate != null ? `${winRate}%` : "--"}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/80">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Best Score</p>
                <p className="font-display font-bold text-2xl">{bestScore}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent form */}
        {recentForm.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Recent Form</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5">
                {recentForm.map((r, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                      r === "W" ? "bg-rl-green/20 text-rl-green" : "bg-rl-red/20 text-rl-red"
                    }`}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent games */}
        {recentGames.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Recent Games</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentGames.map((row, i) => {
                const game = row.games!;
                const isWin = game.result === "win";
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
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
                    <p className="text-xs text-muted-foreground font-mono">
                      {row.goals}G {row.assists}A {row.saves}S · {row.score}pts
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default FriendProfile;
