import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Star, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getRankIcon } from "@/lib/rankIcons";
import ProfileHeader from "@/components/profile/ProfileHeader";
import StatsShowcase from "@/components/profile/StatsShowcase";
import TrophyShelf from "@/components/profile/TrophyShelf";
import ActivityFeed from "@/components/profile/ActivityFeed";
import PerformanceChart from "@/components/profile/PerformanceChart";
import { ROUND_ORDER } from "@/hooks/useTournamentSession";
import type { RoundKey } from "@/hooks/useTournamentSession";
import type { BestGame, ActivityGame, TournamentSummary, LeaderboardStanding, ChartPoint, TeammateProfile } from "@/types/profile";

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
  banner_url: string | null;
  bio: string | null;
  favorite_car: string | null;
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

const gameModes: GameMode[] = ["1v1", "2v2", "3v3"];
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
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [ranks, setRanks] = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [tournamentData, setTournamentData] = useState<TournamentSummary | null>(null);
  const [activityGames, setActivityGames] = useState<ActivityGame[]>([]);
  const [bestGame, setBestGame] = useState<BestGame | null>(null);
  const [leaderboardStanding, setLeaderboardStanding] = useState<LeaderboardStanding | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [teammates, setTeammates] = useState<TeammateProfile[]>([]);

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
            .select("username, rl_account_name, avatar_url, banner_url, bio, favorite_car")
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

        // Tournament data (now readable by all authenticated users via new policy)
        try {
          const { data: tourneyData } = await supabase
            .from("tournaments")
            .select("outcome, current_round, status")
            .eq("user_id", userId);

          const wins = (tourneyData ?? []).filter((t: any) => t.outcome === "winner").length;
          const roundIndices = (tourneyData ?? []).map((t: any) => ROUND_ORDER.indexOf(t.current_round as RoundKey));
          const highestIdx = roundIndices.length > 0 ? Math.max(...roundIndices) : -1;
          setTournamentData({
            totalEntered: tourneyData?.length ?? 0,
            wins,
            highestRoundReached: highestIdx >= 0 ? ROUND_ORDER[highestIdx] : null,
          });
        } catch { /* non-critical — policy may not be applied yet */ }

        // Stats
        try {
          const { data: playerRows, error: playersError } = await supabase
            .from("game_players")
            .select("game_id, score, goals, assists, saves, shots, is_mvp, contribution_score")
            .eq("user_id", userId);

          if (playersError) throw playersError;
          if (!playerRows || playerRows.length === 0) {
            setProfileStats(null);
            return;
          }

          const n = playerRows.length;

          const { records, totals } = playerRows.reduce(
            ({ records: best, totals: t }, row) => ({
              records: {
                bestScore:             Math.max(best.bestScore,             safeNum(row.score)),
                bestGoals:             Math.max(best.bestGoals,             safeNum(row.goals)),
                bestAssists:           Math.max(best.bestAssists,           safeNum(row.assists)),
                bestSaves:             Math.max(best.bestSaves,             safeNum(row.saves)),
                bestContributionScore: Math.max(best.bestContributionScore, safeNum(row.contribution_score)),
              },
              totals: {
                score:   t.score   + safeNum(row.score),
                goals:   t.goals   + safeNum(row.goals),
                assists: t.assists + safeNum(row.assists),
                saves:   t.saves   + safeNum(row.saves),
                shots:   t.shots   + safeNum(row.shots),
                mvps:    t.mvps    + (row.is_mvp ? 1 : 0),
              },
            }),
            {
              records: { bestScore: 0, bestGoals: 0, bestAssists: 0, bestSaves: 0, bestContributionScore: 0 },
              totals:  { score: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0 },
            }
          );

          const gameIds = playerRows.map((r) => r.game_id);
          const { data: gamesData, error: gamesError } = await supabase
            .from("games")
            .select("id, result, played_at, game_mode, game_type, game_players(user_id, player_name, score, goals, assists, saves, is_mvp, team)")
            .in("id", gameIds)
            .order("played_at", { ascending: false });

          if (gamesError) throw gamesError;
          if (!gamesData || gamesData.length === 0) {
            setProfileStats(null);
            return;
          }

          const totalGames = gamesData.length;
          const wins = gamesData.filter((g) => g.result === "win").length;
          const recentForm: Array<"W" | "L"> = gamesData.slice(0, 5).map((g) => (g.result === "win" ? "W" : "L"));

          const teammateMap = new Map<string, { name: string; games: number; wins: number }>();
          gamesData.forEach((game) => {
            const isWin = game.result === "win";
            const players = ((game as any).game_players || []);
            players.forEach((p: any) => {
              if (!p.user_id || p.user_id === userId) return;
              const prev = teammateMap.get(p.user_id);
              teammateMap.set(p.user_id, {
                name:  p.player_name ?? "Unknown",
                games: (prev?.games ?? 0) + 1,
                wins:  (prev?.wins  ?? 0) + (isWin ? 1 : 0),
              });
            });
          });
          const topTeammates = Array.from(teammateMap.entries())
            .map(([id, data]) => ({ userId: id, ...data }))
            .sort((a, b) => b.games - a.games)
            .slice(0, 3);

          // Fetch avatars for top teammates
          if (topTeammates.length > 0) {
            const { data: tmProfiles } = await supabase
              .from("profiles")
              .select("user_id, avatar_url")
              .in("user_id", topTeammates.map((t) => t.userId));
            const avatarMap = new Map((tmProfiles ?? []).map((p) => [p.user_id, p.avatar_url ?? null]));
            setTeammates(topTeammates.map((t) => ({ ...t, avatarUrl: avatarMap.get(t.userId) ?? null })));
          } else {
            setTeammates([]);
          }

          // Normalized contribution
          const modeMap = new Map(gamesData.map((g) => [g.id, g.game_mode as string]));
          let normTotal = 0, normCount = 0;
          playerRows.forEach((row) => {
            const mode = modeMap.get(row.game_id);
            const ts = mode === "1v1" ? 1 : mode === "2v2" ? 2 : mode === "3v3" ? 3 : 4;
            const cs = safeNum(row.contribution_score);
            if (cs > 0 && ts > 1) { normTotal += cs * ts; normCount++; }
          });

          setProfileStats({
            totalGames, wins, losses: totalGames - wins, recentForm,
            avgScore:        n > 0 ? totals.score   / n : 0,
            avgGoals:        n > 0 ? totals.goals   / n : 0,
            avgAssists:      n > 0 ? totals.assists / n : 0,
            avgSaves:        n > 0 ? totals.saves   / n : 0,
            avgShots:        n > 0 ? totals.shots   / n : 0,
            avgContribution: normCount > 0 ? normTotal / normCount : null,
            mvpRate:         n > 0 ? (totals.mvps / n) * 100 : 0,
            ...records, topTeammates,
          });

          // Activity feed (last 20 games, with full scoreboard)
          const activity: ActivityGame[] = gamesData.slice(0, 20).map((game) => {
            const players: any[] = (game as any).game_players ?? [];
            const myRow = players.find((p) => p.user_id === userId);
            const myTeam = myRow?.team ?? null;
            const allPlayers = players.map((p) => ({
              userId: p.user_id ?? null,
              playerName: p.player_name ?? "Unknown",
              score: safeNum(p.score),
              goals: safeNum(p.goals),
              assists: safeNum(p.assists),
              saves: safeNum(p.saves),
              isMvp: p.is_mvp ?? false,
              team: p.team ?? null,
            }));
            let teamGoals: number | null = null;
            let opponentGoals: number | null = null;
            if (myTeam) {
              teamGoals = players.filter((p) => p.team === myTeam).reduce((s, p) => s + safeNum(p.goals), 0);
              opponentGoals = players.filter((p) => p.team !== myTeam && p.team != null).reduce((s, p) => s + safeNum(p.goals), 0);
            }
            return {
              id: game.id,
              result: game.result === "win" ? "win" : "loss",
              gameMode: game.game_mode,
              gameType: (game as any).game_type ?? "competitive",
              playedAt: game.played_at,
              score:   safeNum(myRow?.score),
              goals:   safeNum(myRow?.goals),
              assists: safeNum(myRow?.assists),
              saves:   safeNum(myRow?.saves),
              isMvp:   myRow?.is_mvp ?? false,
              allPlayers,
              teamGoals,
              opponentGoals,
            };
          });
          setActivityGames(activity);

          // Performance chart — MMR history
          try {
            const { data: mmrRows } = await supabase
              .from("mmr_history" as any)
              .select("mmr, game_mode, recorded_at")
              .eq("user_id", userId)
              .order("recorded_at", { ascending: true })
              .limit(120);
            if (mmrRows && (mmrRows as any[]).length > 0) {
              const modeCounts = new Map<string, number>();
              (mmrRows as any[]).forEach((r) => modeCounts.set(r.game_mode, (modeCounts.get(r.game_mode) ?? 0) + 1));
              const preferredMode = (["2v2", "3v3", "1v1"] as GameMode[]).reduce((best, m) =>
                (modeCounts.get(m) ?? 0) > (modeCounts.get(best) ?? 0) ? m : best
              , "2v2");
              const modeRows = (mmrRows as any[]).filter((r) => r.game_mode === preferredMode).slice(-30);
              setChartData(modeRows.map((r, i) => ({ index: i + 1, score: r.mmr, date: r.recorded_at, gameMode: preferredMode })));
            } else {
              setChartData([]);
            }
          } catch { setChartData([]); }

          // Best game
          if (playerRows.length > 0) {
            const bestRow = playerRows.reduce((best, row) =>
              safeNum(row.contribution_score) > safeNum(best.contribution_score) ? row : best
            , playerRows[0]);
            const bestGameData = gamesData.find((g) => g.id === bestRow.game_id);
            if (bestGameData) {
              const myRow = ((bestGameData as any).game_players ?? []).find((p: any) => p.user_id === userId);
              setBestGame({
                date: bestGameData.played_at,
                gameMode: bestGameData.game_mode,
                gameType: (bestGameData as any).game_type ?? "competitive",
                score:   safeNum(myRow?.score),
                goals:   safeNum(myRow?.goals),
                assists: safeNum(myRow?.assists),
                saves:   safeNum(myRow?.saves),
                contributionScore: safeNum(bestRow.contribution_score),
                isMvp: myRow?.is_mvp ?? false,
              });
            }
          }

          // Leaderboard standing
          try {
            const { data: lbData } = await (supabase as any).rpc("get_leaderboard", { p_window: "7d", p_stat: "goals" });
            const entry = (lbData ?? []).find((e: any) => e.user_id === userId);
            if (entry && entry.rank <= 20) {
              setLeaderboardStanding({ stat: "Goals", rank: entry.rank, window: "7d" });
            }
          } catch { /* non-critical */ }
        } catch {
          setProfileStats(null);
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

  const rankedModes = gameModes.filter((m) => ranks[m].rank_tier !== "unranked");

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Profile Header */}
        <Card className="overflow-hidden p-0">
          <ProfileHeader
            displayName={displayName}
            avatarUrl={profile.avatar_url}
            bannerUrl={profile.banner_url}
            bio={profile.bio}
            favoriteCar={profile.favorite_car}
            ranks={ranks}
            profileUserId={userId!}
            totalGames={profileStats?.totalGames}
            wins={profileStats?.wins}
          />
        </Card>

        {/* Stats Showcase */}
        {profileStats && profileStats.totalGames > 0 && (
          <StatsShowcase
            stats={profileStats}
            bestGame={bestGame}
            leaderboardStanding={leaderboardStanding}
          />
        )}

        {/* Performance Chart */}
        <PerformanceChart data={chartData} />

        {/* Activity Feed */}
        <ActivityFeed games={activityGames} currentUserId={userId} />

        {/* Tournament Trophy Shelf */}
        <TrophyShelf tournaments={tournamentData} isOwnProfile={false} />

        {/* Competitive Ranks — compact horizontal strip */}
        {rankedModes.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Competitive Ranks</p>
              <div className="flex gap-3 flex-wrap">
                {rankedModes.map((mode) => {
                  const rank = ranks[mode];
                  const colorClass = RANK_COLORS[rank.rank_tier] ?? "text-foreground";
                  return (
                    <div key={mode} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-background/60 border border-border/40 min-w-[72px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{gameModeLabels[mode]}</span>
                      <img src={getRankIcon(rank.rank_tier)} alt={getRankLabel(rank.rank_tier)} className="w-9 h-9 object-contain" />
                      <span className={`text-xs font-semibold text-center leading-tight ${colorClass}`}>
                        {getRankLabel(rank.rank_tier)}
                        {rank.rank_division && rank.rank_tier !== "supersonic_legend" ? ` ${rank.rank_division}` : ""}
                      </span>
                      {rank.mmr != null && <span className="text-[10px] text-muted-foreground font-mono">{rank.mmr}</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Most Played With */}
        {teammates.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-rose-400" /> Most Played With
              </p>
              <div className="space-y-2">
                {teammates.map((tm, i) => {
                  const tmWinRate = tm.games > 0 ? Math.round((tm.wins / tm.games) * 100) : 0;
                  const initials = tm.name.slice(0, 2).toUpperCase();
                  return (
                    <a key={tm.userId} href={`/profile/${tm.userId}`} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-background/60 hover:bg-muted/40 transition-colors">
                      <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-muted/60 border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                        {tm.avatarUrl
                          ? <img src={tm.avatarUrl} alt={tm.name} className="w-full h-full object-cover" />
                          : <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{tm.name}</p>
                        <p className="text-[10px] text-muted-foreground">{tm.games} games together</p>
                      </div>
                      <div className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${tmWinRate >= 50 ? "text-rl-green bg-rl-green/10" : "text-rl-red bg-rl-red/10"}`}>
                        {tmWinRate}%
                      </div>
                    </a>
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
