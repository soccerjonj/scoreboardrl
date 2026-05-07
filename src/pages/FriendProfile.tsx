import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Star, Trophy, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CARS, CarBadge } from "@/components/profile/CarSilhouette";
import { getRankIcon } from "@/lib/rankIcons";

type GameMode = Database["public"]["Enums"]["game_mode"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

type RankInput = {
  rank_tier: RankTier;
  rank_division: RankDivision | null;
  mmr: number | null;
};

type FriendProfileData = {
  username: string | null;
  rl_account_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_car: string | null;
};

type PlayerStatsRow = {
  game_id: string;
  score: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  shots: number | null;
  is_mvp: boolean | null;
  contribution_score: number | null;
};

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
  topTeammates: Array<{ userId: string; name: string; games: number; wins: number }>;
};

const gameModes: GameMode[] = ["1v1", "2v2", "3v3", "4v4"];
const gameModeLabels: Record<GameMode, string> = { "1v1": "1v1", "2v2": "2v2", "3v3": "3v3", "4v4": "4v4" };

const rankTierOptions: { value: RankTier; label: string }[] = [
  { value: "unranked", label: "Unranked" },
  { value: "bronze_1", label: "Bronze I" }, { value: "bronze_2", label: "Bronze II" }, { value: "bronze_3", label: "Bronze III" },
  { value: "silver_1", label: "Silver I" }, { value: "silver_2", label: "Silver II" }, { value: "silver_3", label: "Silver III" },
  { value: "gold_1", label: "Gold I" }, { value: "gold_2", label: "Gold II" }, { value: "gold_3", label: "Gold III" },
  { value: "platinum_1", label: "Platinum I" }, { value: "platinum_2", label: "Platinum II" }, { value: "platinum_3", label: "Platinum III" },
  { value: "diamond_1", label: "Diamond I" }, { value: "diamond_2", label: "Diamond II" }, { value: "diamond_3", label: "Diamond III" },
  { value: "champion_1", label: "Champion I" }, { value: "champion_2", label: "Champion II" }, { value: "champion_3", label: "Champion III" },
  { value: "grand_champion_1", label: "Grand Champ I" }, { value: "grand_champion_2", label: "Grand Champ II" }, { value: "grand_champion_3", label: "Grand Champ III" },
  { value: "supersonic_legend", label: "Supersonic Legend" },
];

const RANK_COLORS: Partial<Record<string, string>> = {
  unranked: "text-muted-foreground",
  bronze_1: "text-amber-700", bronze_2: "text-amber-700", bronze_3: "text-amber-700",
  silver_1: "text-slate-400", silver_2: "text-slate-400", silver_3: "text-slate-400",
  gold_1: "text-yellow-400", gold_2: "text-yellow-400", gold_3: "text-yellow-400",
  platinum_1: "text-cyan-400", platinum_2: "text-cyan-400", platinum_3: "text-cyan-400",
  diamond_1: "text-blue-400", diamond_2: "text-blue-400", diamond_3: "text-blue-400",
  champion_1: "text-purple-400", champion_2: "text-purple-400", champion_3: "text-purple-400",
  grand_champion_1: "text-red-400", grand_champion_2: "text-red-400", grand_champion_3: "text-red-400",
  supersonic_legend: "text-primary",
};

const createEmptyRanks = (): Record<GameMode, RankInput> =>
  gameModes.reduce((acc, mode) => {
    acc[mode] = { rank_tier: "unranked", rank_division: null, mmr: null };
    return acc;
  }, {} as Record<GameMode, RankInput>);

const getRankLabel = (tier: RankTier) =>
  rankTierOptions.find((o) => o.value === tier)?.label ?? tier;

const safeNum = (v: number | null | undefined) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

const FriendProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [ranks, setRanks] = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!userId || !user) return;

    const load = async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const [profileRes, ranksRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, rl_account_name, avatar_url, bio, favorite_car")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("ranks")
            .select("game_mode, rank_tier, rank_division, mmr")
            .eq("user_id", userId)
            .eq("game_type", "competitive"),
        ]);

        if (profileRes.error || !profileRes.data) {
          setNotFound(true);
          return;
        }

        setProfile(profileRes.data as FriendProfileData);

        const nextRanks = createEmptyRanks();
        (ranksRes.data || []).forEach((row) => {
          nextRanks[row.game_mode] = {
            rank_tier: row.rank_tier ?? "unranked",
            rank_division: row.rank_division ?? null,
            mmr: row.mmr ?? null,
          };
        });
        setRanks(nextRanks);

        setLoadingStats(true);
        try {
          const { data: myPlayerRows, error: playersError } = await supabase
            .from("game_players")
            .select("game_id, score, goals, assists, saves, shots, is_mvp, contribution_score")
            .eq("user_id", userId);

          if (playersError) throw playersError;
          if (!myPlayerRows || myPlayerRows.length === 0) {
            setProfileStats(null);
            return;
          }

          const playerRows = myPlayerRows as PlayerStatsRow[];
          const gameIds = playerRows.map((r) => r.game_id);
          const n = playerRows.length;

          const { records, totals } = playerRows.reduce(
            ({ records: best, totals: t }, row) => ({
              records: {
                bestScore: Math.max(best.bestScore, safeNum(row.score)),
                bestGoals: Math.max(best.bestGoals, safeNum(row.goals)),
                bestAssists: Math.max(best.bestAssists, safeNum(row.assists)),
                bestSaves: Math.max(best.bestSaves, safeNum(row.saves)),
                bestContributionScore: Math.max(best.bestContributionScore, safeNum(row.contribution_score)),
              },
              totals: {
                score: t.score + safeNum(row.score),
                goals: t.goals + safeNum(row.goals),
                assists: t.assists + safeNum(row.assists),
                saves: t.saves + safeNum(row.saves),
                shots: t.shots + safeNum(row.shots),
                mvps: t.mvps + (row.is_mvp ? 1 : 0),
              },
            }),
            {
              records: { bestScore: 0, bestGoals: 0, bestAssists: 0, bestSaves: 0, bestContributionScore: 0 },
              totals: { score: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0 },
            }
          );

          const { data: gamesData, error: gamesError } = await supabase
            .from("games")
            .select("id, result, played_at, game_mode, game_players(user_id, player_name)")
            .in("id", gameIds)
            .order("played_at", { ascending: false });

          if (gamesError) throw gamesError;
          if (!gamesData || gamesData.length === 0) {
            setProfileStats(null);
            return;
          }

          const totalGames = gamesData.length;
          const wins = gamesData.filter((g) => g.result === "win").length;
          const recentForm: Array<"W" | "L"> = gamesData
            .slice(0, 5)
            .map((g) => (g.result === "win" ? "W" : "L"));

          const teammateMap = new Map<string, { name: string; games: number; wins: number }>();
          gamesData.forEach((game) => {
            const isWin = game.result === "win";
            const players = ((game as { game_players?: Array<{ user_id: string | null; player_name: string | null }> }).game_players || []);
            players.forEach((p) => {
              if (!p.user_id || p.user_id === userId) return;
              const prev = teammateMap.get(p.user_id);
              teammateMap.set(p.user_id, {
                name: p.player_name ?? "Unknown",
                games: (prev?.games ?? 0) + 1,
                wins: (prev?.wins ?? 0) + (isWin ? 1 : 0),
              });
            });
          });

          const topTeammates = Array.from(teammateMap.entries())
            .map(([id, data]) => ({ userId: id, ...data }))
            .sort((a, b) => b.games - a.games)
            .slice(0, 3);

          const modeMap = new Map(gamesData.map((g) => [g.id, g.game_mode as string]));
          let normalizedContributionTotal = 0;
          let normalizedContributionCount = 0;
          playerRows.forEach((row) => {
            const mode = modeMap.get(row.game_id);
            const teamSize = mode === "1v1" ? 1 : mode === "2v2" ? 2 : mode === "3v3" ? 3 : 4;
            const contribution = safeNum(row.contribution_score);
            if (contribution > 0 && teamSize > 1) {
              normalizedContributionTotal += contribution * teamSize;
              normalizedContributionCount++;
            }
          });

          setProfileStats({
            totalGames,
            wins,
            losses: totalGames - wins,
            recentForm,
            avgScore: n > 0 ? totals.score / n : 0,
            avgGoals: n > 0 ? totals.goals / n : 0,
            avgAssists: n > 0 ? totals.assists / n : 0,
            avgSaves: n > 0 ? totals.saves / n : 0,
            avgShots: n > 0 ? totals.shots / n : 0,
            avgContribution: normalizedContributionCount > 0 ? normalizedContributionTotal / normalizedContributionCount : null,
            mvpRate: n > 0 ? (totals.mvps / n) * 100 : 0,
            ...records,
            topTeammates,
          });
        } catch {
          setProfileStats(null);
        } finally {
          setLoadingStats(false);
        }
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

  const displayName = profile.rl_account_name?.trim() || profile.username || "Unknown Player";
  const favoriteCarObj = profile.favorite_car ? CARS.find((car) => car.name === profile.favorite_car) ?? null : null;
  const winRate = profileStats && profileStats.totalGames > 0
    ? Math.round((profileStats.wins / profileStats.totalGames) * 100)
    : null;

  return (
    <AppLayout>
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-primary/30 via-rl-purple/15 to-secondary/10 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.2),transparent_60%)]" />
          </div>

          <div className="px-5 pt-0 pb-4">
            <div className="flex items-end gap-4 -mt-10 mb-3">
              <div className="w-20 h-20 rounded-full border-[3px] border-primary/40 bg-muted/40 overflow-hidden shrink-0 shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><User className="w-9 h-9 text-muted-foreground/60" /></div>
                }
              </div>
              <div className="pb-1 min-w-0 flex-1">
                <h2 className="font-display font-bold text-xl truncate">{displayName}</h2>
              </div>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground mb-2">{profile.bio}</p>}
            {favoriteCarObj && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Favorite Car</span>
                <CarBadge car={favoriteCarObj} />
              </div>
            )}
          </div>

          {profileStats && profileStats.totalGames > 0 && (
            <div className="border-t border-white/[0.06] bg-white/[0.02]">
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rl-green/10 border border-rl-green/20">
                    <span className="font-display font-bold text-sm text-rl-green">{profileStats.wins}W</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rl-red/10 border border-rl-red/20">
                    <span className="font-display font-bold text-sm text-rl-red">{profileStats.losses}L</span>
                  </div>
                  {winRate !== null && (
                    <span className="text-xs text-muted-foreground font-mono">{winRate}%</span>
                  )}
                </div>
                {profileStats.recentForm.length > 0 && (
                  <div className="flex items-center gap-1">
                    {profileStats.recentForm.map((result, i) => (
                      <div key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
                        result === "W"
                          ? "bg-rl-green/20 text-rl-green border border-rl-green/30"
                          : "bg-rl-red/20 text-rl-red border border-rl-red/30"
                      }`}>{result}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-white/[0.05] grid grid-cols-4 divide-x divide-white/[0.05]">
                {[
                  { label: "Games", value: profileStats.totalGames, fmt: (v: number) => String(v), color: "text-primary" },
                  { label: "Avg Score", value: profileStats.avgScore, fmt: (v: number) => v.toFixed(0), color: "text-secondary" },
                  { label: "Contrib", value: profileStats.avgContribution, fmt: (v: number) => Math.round(v).toString(), color: "text-rl-purple" },
                  { label: "MVP Rate", value: profileStats.mvpRate, fmt: (v: number) => `${Math.round(v)}%`, color: "text-yellow-400" },
                ].map(({ label, value, fmt, color }) => (
                  <div key={label} className="py-3 text-center">
                    <p className={`font-display font-bold text-lg leading-tight ${color}`}>
                      {value !== null ? fmt(value) : <span className="text-muted-foreground">-</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/[0.05] grid grid-cols-4 divide-x divide-white/[0.05]">
                {[
                  { label: "Goals", value: profileStats.avgGoals, fmt: (v: number) => v.toFixed(2) },
                  { label: "Assists", value: profileStats.avgAssists, fmt: (v: number) => v.toFixed(2) },
                  { label: "Saves", value: profileStats.avgSaves, fmt: (v: number) => v.toFixed(2) },
                  { label: "Shots", value: profileStats.avgShots, fmt: (v: number) => v.toFixed(2) },
                ].map(({ label, value, fmt }) => (
                  <div key={label} className="py-3 text-center">
                    <p className="font-display font-bold text-sm leading-tight text-foreground/90">
                      {value !== null ? fmt(value) : <span className="text-muted-foreground">-</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="pt-4 pb-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Competitive Ranks</p>
            {gameModes.map((mode) => {
              const rank = ranks[mode];
              const colorClass = RANK_COLORS[rank.rank_tier] ?? "text-foreground";
              return (
                <div key={mode} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/60">
                  <span className="font-display font-bold text-sm text-muted-foreground w-8">{gameModeLabels[mode]}</span>
                  <div className="flex items-center gap-2 flex-1 ml-2">
                    <img
                      src={getRankIcon(rank.rank_tier)}
                      alt={getRankLabel(rank.rank_tier)}
                      className="w-8 h-8 object-contain"
                    />
                    <span className={`font-semibold text-sm ${colorClass}`}>
                      {getRankLabel(rank.rank_tier)}
                      {rank.rank_division && rank.rank_tier !== "unranked" && rank.rank_tier !== "supersonic_legend" ? ` ${rank.rank_division}` : ""}
                    </span>
                  </div>
                  {rank.mmr != null && (
                    <span className="text-xs text-muted-foreground font-mono">{rank.mmr} MMR</span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {profileStats && profileStats.totalGames > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Personal Records
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Score", value: profileStats.bestScore },
                  { label: "Goals", value: profileStats.bestGoals },
                  { label: "Assists", value: profileStats.bestAssists },
                  { label: "Saves", value: profileStats.bestSaves },
                  { label: "Contribution", value: profileStats.bestContributionScore > 0 ? profileStats.bestContributionScore : null },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg bg-background/60">
                    <span className="font-display font-bold text-lg leading-none">
                      {value !== null ? value : <span className="text-muted-foreground text-sm">-</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!loadingStats && profileStats && profileStats.topTeammates.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-rose-400" /> Most Played With
              </p>
              <div className="space-y-2">
                {profileStats.topTeammates.map((tm, i) => {
                  const tmWinRate = tm.games > 0 ? Math.round((tm.wins / tm.games) * 100) : 0;
                  return (
                    <div key={tm.userId} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-background/60">
                      <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                      <div className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{tm.name}</p>
                        <p className="text-[10px] text-muted-foreground">{tm.games} games together</p>
                      </div>
                      <div className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${tmWinRate >= 50 ? "text-rl-green bg-rl-green/10" : "text-rl-red bg-rl-red/10"}`}>
                        {tmWinRate}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default FriendProfile;
