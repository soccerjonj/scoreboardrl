import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Check, Loader2,
  LogOut, Save, Star, User, X as XIcon, Pencil,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AppLayout from "@/components/layout/AppLayout";
import { CARS, CarPicker } from "@/components/profile/CarSilhouette";
import { getRankIcon } from "@/lib/rankIcons";
import ProfileHeader from "@/components/profile/ProfileHeader";
import StatsShowcase from "@/components/profile/StatsShowcase";
import TrophyShelf from "@/components/profile/TrophyShelf";
import ActivityFeed from "@/components/profile/ActivityFeed";
import PerformanceChart from "@/components/profile/PerformanceChart";
import { ROUND_ORDER } from "@/hooks/useTournamentSession";
import type { RoundKey } from "@/hooks/useTournamentSession";
import type { BestGame, ActivityGame, TournamentSummary, LeaderboardStanding, ChartPoint, TeammateProfile } from "@/types/profile";

type GameMode     = Database["public"]["Enums"]["game_mode"];
type GameType     = Database["public"]["Enums"]["game_type"];
type RankTier     = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

type RankInput = { rank_tier: RankTier; rank_division: RankDivision | null; mmr: number | null };

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
const BIO_MAX = 160;

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

const rankDivisionOptions: { value: RankDivision; label: string }[] = [
  { value: "I", label: "Div I" }, { value: "II", label: "Div II" }, { value: "III", label: "Div III" }, { value: "IV", label: "Div IV" },
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
  gameModes.reduce((acc, mode) => { acc[mode] = { rank_tier: "unranked", rank_division: null, mmr: null }; return acc; }, {} as Record<GameMode, RankInput>);

const getRankLabel = (tier: RankTier) =>
  rankTierOptions.find((o) => o.value === tier)?.label ?? tier;

const safeNum = (v: number | null | undefined) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);

  // Profile data
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [avatarUrl, setAvatarUrl]             = useState<string | null>(() =>
    user ? (localStorage.getItem(`avatar_url_${user.id}`) ?? null) : null
  );
  const [bannerUrl, setBannerUrl]             = useState<string | null>(null);
  const [rlAccountName, setRlAccountName]     = useState("");
  const [rlNameWasSet, setRlNameWasSet]       = useState(false);
  const [bio, setBio]                         = useState("");
  const [favoriteCar, setFavoriteCar]         = useState<string | null>(null);
  const [ranks, setRanks]                     = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [profileStats, setProfileStats]       = useState<ProfileStats | null>(null);

  // New social data
  const [tournamentData, setTournamentData]           = useState<TournamentSummary | null>(null);
  const [activityGames, setActivityGames]             = useState<ActivityGame[]>([]);
  const [bestGame, setBestGame]                       = useState<BestGame | null>(null);
  const [leaderboardStanding, setLeaderboardStanding] = useState<LeaderboardStanding | null>(null);
  const [chartData, setChartData] = useState<{ points: Record<string, string | number | null>[]; activeModes: string[] }>({ points: [], activeModes: [] });
  const [teammates, setTeammates]                     = useState<TeammateProfile[]>([]);

  // Edit-mode draft state
  const [draftRlName, setDraftRlName]             = useState("");
  const [draftBio, setDraftBio]                   = useState("");
  const [draftFavoriteCar, setDraftFavoriteCar]   = useState<string | null>(null);
  const [draftRanks, setDraftRanks]               = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [editingRlName, setEditingRlName]         = useState(false);
  const [rlNameDraft, setRlNameDraft]             = useState("");
  const [editingMode, setEditingMode]             = useState<GameMode | null>(null);
  const [editDraft, setEditDraft]                 = useState<RankInput | null>(null);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, ranksRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name, avatar_url, banner_url, bio, favorite_car").eq("user_id", user.id).single(),
          supabase.from("ranks").select("game_mode, rank_tier, rank_division, mmr").eq("user_id", user.id).eq("game_type", "competitive"),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (ranksRes.error)   throw ranksRes.error;

        const data = profileRes.data as any;
        const loadedName = data?.rl_account_name ?? "";
        setRlAccountName(loadedName);
        setRlNameWasSet(Boolean(loadedName));

        const freshAvatarUrl = data?.avatar_url ?? null;
        setAvatarUrl(freshAvatarUrl);
        if (freshAvatarUrl) localStorage.setItem(`avatar_url_${user.id}`, freshAvatarUrl);
        else localStorage.removeItem(`avatar_url_${user.id}`);

        setBannerUrl(data?.banner_url ?? null);

        const dbBio = data?.bio ?? "";
        const lsBio = localStorage.getItem(`profile_bio_${user.id}`) ?? "";
        setBio(dbBio || lsBio);
        setFavoriteCar(data?.favorite_car ?? null);

        const next = createEmptyRanks();
        (ranksRes.data || []).forEach((r) => {
          next[r.game_mode] = { rank_tier: r.rank_tier ?? "unranked", rank_division: r.rank_division ?? null, mmr: r.mmr ?? null };
        });
        setRanks(next);

        if (!data?.rl_account_name) setIsEditing(true);
      } catch (err: any) {
        toast({ title: "Failed to load profile", description: err.message, variant: "destructive" });
      } finally { setLoading(false); }
    };
    load();

    // Load tournament data
    const loadTournaments = async () => {
      try {
        const { data: tourneyData } = await supabase
          .from("tournaments")
          .select("outcome, current_round, status")
          .eq("user_id", user.id);

        const wins = (tourneyData ?? []).filter((t: any) => t.outcome === "winner").length;
        const roundIndices = (tourneyData ?? []).map((t: any) => ROUND_ORDER.indexOf(t.current_round as RoundKey));
        const highestIdx = roundIndices.length > 0 ? Math.max(...roundIndices) : -1;
        setTournamentData({
          totalEntered: tourneyData?.length ?? 0,
          wins,
          highestRoundReached: highestIdx >= 0 ? ROUND_ORDER[highestIdx] : null,
        });
      } catch { /* non-critical */ }
    };
    loadTournaments();

    // Load game stats
    const loadStats = async () => {
      try {
        const { data: myPlayerRows } = await supabase
          .from("game_players")
          .select("game_id, score, goals, assists, saves, shots, is_mvp, contribution_score, mmr")
          .eq("user_id", user.id);

        if (!myPlayerRows || myPlayerRows.length === 0) {
          setProfileStats(null);
          return;
        }

        const gameIds = myPlayerRows.map((r) => r.game_id);
        const n = myPlayerRows.length;

        const { records, totals } = myPlayerRows.reduce(
          ({ records: best, totals: t }, row) => ({
            records: {
              bestScore:             Math.max(best.bestScore,             safeNum(row.score)),
              bestGoals:             Math.max(best.bestGoals,             safeNum(row.goals)),
              bestAssists:           Math.max(best.bestAssists,           safeNum(row.assists)),
              bestSaves:             Math.max(best.bestSaves,             safeNum(row.saves)),
              bestContributionScore: Math.max(best.bestContributionScore, safeNum(row.contribution_score)),
            },
            totals: {
              score:        t.score        + safeNum(row.score),
              goals:        t.goals        + safeNum(row.goals),
              assists:      t.assists      + safeNum(row.assists),
              saves:        t.saves        + safeNum(row.saves),
              shots:        t.shots        + safeNum(row.shots),
              mvps:         t.mvps         + ((row as any).is_mvp ? 1 : 0),
              contribution: t.contribution + safeNum(row.contribution_score),
              contribGames: t.contribGames + (safeNum(row.contribution_score) > 0 ? 1 : 0),
            },
          }),
          {
            records: { bestScore: 0, bestGoals: 0, bestAssists: 0, bestSaves: 0, bestContributionScore: 0 },
            totals:  { score: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0, contribution: 0, contribGames: 0 },
          }
        );

        const { data: gamesData } = await supabase
          .from("games")
          .select("id, result, played_at, game_mode, game_type, game_players(user_id, player_name, score, goals, assists, saves, shots, is_mvp, contribution_score, team)")
          .in("id", gameIds)
          .order("played_at", { ascending: false });

        if (!gamesData) return;

        const totalGames = gamesData.length;
        const wins = gamesData.filter((g) => g.result === "win").length;
        const recentForm: Array<"W" | "L"> = gamesData.slice(0, 5).map((g) => (g.result === "win" ? "W" : "L"));

        // Top teammates
        const teammateMap = new Map<string, { name: string; games: number; wins: number }>();
        gamesData.forEach((game) => {
          const isWin = game.result === "win";
          ((game as any).game_players || []).forEach((p: any) => {
            if (!p.user_id || p.user_id === user.id) return;
            const prev = teammateMap.get(p.user_id);
            teammateMap.set(p.user_id, { name: p.player_name, games: (prev?.games ?? 0) + 1, wins: (prev?.wins ?? 0) + (isWin ? 1 : 0) });
          });
        });
        const topTeammates = Array.from(teammateMap.entries()).map(([userId, d]) => ({ userId, ...d })).sort((a, b) => b.games - a.games).slice(0, 3);

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
        const modeMap = new Map((gamesData ?? []).map((g) => [g.id, g.game_mode as string]));
        let normTotal = 0, normCount = 0;
        myPlayerRows.forEach((row) => {
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

        // Activity feed (last 20 games, with full scoreboard per game)
        const activity: ActivityGame[] = gamesData.slice(0, 20).map((game) => {
          const players: any[] = (game as any).game_players ?? [];
          const myRow = players.find((p) => p.user_id === user.id);
          const myTeam = myRow?.team ?? null;
          const allPlayers = players.map((p) => ({
            userId: p.user_id ?? null,
            playerName: p.player_name ?? "Unknown",
            score: safeNum(p.score),
            goals: safeNum(p.goals),
            assists: safeNum(p.assists),
            saves: safeNum(p.saves),
            shots: safeNum(p.shots),
            contributionScore: safeNum(p.contribution_score),
            isMvp: p.is_mvp ?? false,
            team: p.team ?? null,
          }));
          // Compute team goals from player goals, grouped by team
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

        // MMR chart: multi-mode overlay, last 30 days
        const CHART_MODES = ["1v1", "2v2", "3v3"] as const;
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const mmrByMode = new Map<string, Array<{ mmr: number; date: string }>>();
        gamesData.forEach((game) => {
          if (new Date(game.played_at).getTime() < cutoff) return;
          const myRow = myPlayerRows.find((r) => r.game_id === game.id);
          const mmrVal = (myRow as any)?.mmr;
          if (mmrVal == null || typeof mmrVal !== "number") return;
          const mode = game.game_mode;
          if (!mmrByMode.has(mode)) mmrByMode.set(mode, []);
          mmrByMode.get(mode)!.push({ mmr: mmrVal, date: game.played_at });
        });
        mmrByMode.forEach((pts, mode) => {
          mmrByMode.set(mode, pts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        });
        const activeModes = CHART_MODES.filter((m) => (mmrByMode.get(m)?.length ?? 0) >= 2);
        if (activeModes.length > 0) {
          const allDates = Array.from(new Set(activeModes.flatMap((m) => mmrByMode.get(m)!.map((p) => p.date)))).sort();
          const lastKnown: Record<string, number | null> = {};
          activeModes.forEach((m) => { lastKnown[m] = null; });
          const points = allDates.map((date) => {
            activeModes.forEach((m) => {
              const pt = mmrByMode.get(m)!.find((p) => p.date === date);
              if (pt) lastKnown[m] = pt.mmr;
            });
            const entry: Record<string, string | number | null> = {
              label: date,
              fullLabel: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            };
            activeModes.forEach((m) => { entry[m] = lastKnown[m]; });
            return entry;
          });
          setChartData({ points, activeModes });
        } else {
          setChartData({ points: [], activeModes: [] });
        }

        // Best game (highest contribution_score)
        if (myPlayerRows.length > 0) {
          const bestRow = myPlayerRows.reduce((best, row) =>
            safeNum(row.contribution_score) > safeNum(best.contribution_score) ? row : best
          , myPlayerRows[0]);
          const bestGameData = gamesData.find((g) => g.id === bestRow.game_id);
          if (bestGameData) {
            const myRow = ((bestGameData as any).game_players ?? []).find((p: any) => p.user_id === user.id);
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

        // Leaderboard standing (non-blocking)
        try {
          const { data: lbData } = await (supabase as any).rpc("get_leaderboard", { p_window: "7d", p_stat: "goals" });
          const myEntry = (lbData ?? []).find((e: any) => e.user_id === user.id);
          if (myEntry && myEntry.rank <= 20) {
            setLeaderboardStanding({ stat: "Goals", rank: myEntry.rank, window: "7d" });
          }
        } catch { /* non-critical */ }
      } catch { /* non-critical */ }
    };
    loadStats();
  }, [authLoading, user, navigate, toast]);

  // ── Enter / cancel edit ────────────────────────────────────────────────────
  const enterEditMode = () => {
    setDraftRlName(rlAccountName);
    setDraftBio(bio);
    setDraftFavoriteCar(favoriteCar);
    setDraftRanks(JSON.parse(JSON.stringify(ranks)));
    setEditingRlName(false);
    setEditingMode(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingRlName(false);
    setEditingMode(null);
    setEditDraft(null);
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    setUploadingAvatar(true);
    try {
      const { error: uploadError } = await supabase.storage.from("screenshots").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl } as any).eq("user_id", user.id);
      setAvatarUrl(urlData.publicUrl);
      localStorage.setItem(`avatar_url_${user.id}`, urlData.publicUrl);
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Banner upload ──────────────────────────────────────────────────────────
  const handleBannerFileSelected = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `banners/${user.id}/${Date.now()}.${ext}`;
    setUploadingBanner(true);
    try {
      const { error: uploadError } = await supabase.storage.from("screenshots").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
      await supabase.from("profiles").update({ banner_url: urlData.publicUrl } as any).eq("user_id", user.id);
      setBannerUrl(urlData.publicUrl);
      toast({ title: "Banner updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploadingBanner(false); }
  };

  // ── RL name confirm ────────────────────────────────────────────────────────
  const confirmRlNameEdit = () => {
    setDraftRlName(rlNameDraft.trim());
    setEditingRlName(false);
  };

  // ── Rank confirm ───────────────────────────────────────────────────────────
  const confirmRankEdit = () => {
    if (!editingMode || !editDraft) return;
    setDraftRanks((prev) => ({ ...prev, [editingMode]: editDraft }));
    setEditingMode(null);
    setEditDraft(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    localStorage.setItem(`profile_bio_${user.id}`, draftBio);
    try {
      const trimmedName = draftRlName.trim();
      const rankPayload = gameModes.map((mode) => ({
        user_id: user.id, game_mode: mode, game_type: "competitive" as GameType,
        rank_tier: draftRanks[mode].rank_tier,
        rank_division: draftRanks[mode].rank_tier === "unranked" ? null : draftRanks[mode].rank_division ?? "I",
        mmr: draftRanks[mode].mmr ?? null,
      }));

      const [profileRes, ranksRes] = await Promise.all([
        supabase.from("profiles").update({
          rl_account_name: trimmedName || null,
          bio: draftBio || null,
          favorite_car: draftFavoriteCar,
        } as any).eq("user_id", user.id),
        supabase.from("ranks").upsert(rankPayload, { onConflict: "user_id,game_mode,game_type" }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (ranksRes.error)   throw ranksRes.error;

      setRlAccountName(trimmedName);
      setRlNameWasSet(Boolean(trimmedName));
      setBio(draftBio);
      setFavoriteCar(draftFavoriteCar);
      setRanks(draftRanks);
      setIsEditing(false);

      toast({ title: "Profile saved" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }
  if (!user) return null;

  const rlNameMode: 0 | 1 = !rlNameWasSet ? 0 : 1;

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (!isEditing) {
    const rankedModes = gameModes.filter((m) => ranks[m].rank_tier !== "unranked");

    return (
      <AppLayout>
        <div className="space-y-4">
          {/* Profile Header (banner + avatar + identity) */}
          <Card className="overflow-hidden p-0">
            <ProfileHeader
              displayName={rlAccountName || "—"}
              avatarUrl={avatarUrl}
              bannerUrl={bannerUrl}
              bio={bio}
              favoriteCar={favoriteCar}
              ranks={ranks}
              profileUserId={user.id}
              totalGames={profileStats?.totalGames}
              wins={profileStats?.wins}
              onEdit={enterEditMode}
              onBannerFileSelected={handleBannerFileSelected}
              uploadingBanner={uploadingBanner}
            />
          </Card>

          {/* Stats Showcase */}
          {profileStats && profileStats.totalGames > 0 && (
            <StatsShowcase
              stats={profileStats}
              leaderboardStanding={leaderboardStanding}
            />
          )}

          {/* Performance Chart */}
          <PerformanceChart points={chartData.points} activeModes={chartData.activeModes} />

          {/* Activity Feed */}
          <ActivityFeed games={activityGames} currentUserId={user.id} />

          {/* Tournament Trophy Shelf */}
          <TrophyShelf tournaments={tournamentData} isOwnProfile={true} />

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

          {/* Sign Out */}
          <div className="md:hidden">
            <Button variant="outline" className="w-full gap-2 text-muted-foreground" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold">Edit Profile</h1>
          <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
            className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-border/60 bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Upload avatar"
          >
            {uploadingAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground/60" />
              </div>
            )}
            {!uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Camera className="w-6 h-6 text-white" />
              </div>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* RL Username */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rocket League Username</Label>

          {rlNameMode === 0 && (
            <Input placeholder="e.g. Jstn" value={draftRlName} onChange={(e) => setDraftRlName(e.target.value)} />
          )}

          {rlNameMode === 1 && !editingRlName && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-2.5">
              <span className="font-semibold text-sm truncate">{draftRlName || rlAccountName}</span>
              <button type="button" onClick={() => { setRlNameDraft(draftRlName); setEditingRlName(true); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          )}

          {rlNameMode === 1 && editingRlName && (
            <div className="flex items-center gap-2">
              <Input autoFocus placeholder="e.g. Jstn" value={rlNameDraft} onChange={(e) => setRlNameDraft(e.target.value)} className="flex-1" />
              <button type="button" onClick={confirmRlNameEdit} className="p-1.5 rounded-md text-green-400 hover:bg-green-400/10 transition-colors"><Check className="w-4 h-4" /></button>
              <button type="button" onClick={() => setEditingRlName(false)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"><XIcon className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Short Bio</Label>
          <textarea
            className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            rows={3}
            maxLength={BIO_MAX}
            placeholder="e.g. Diamond 3v3 grinder, always rotating..."
            value={draftBio}
            onChange={(e) => setDraftBio(e.target.value.slice(0, BIO_MAX))}
          />
          <p className="text-right text-xs text-muted-foreground">{draftBio.length}/{BIO_MAX}</p>
        </div>

        {/* Favorite Car */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Favorite Car</Label>
          {draftFavoriteCar && (
            <p className="text-xs text-muted-foreground">Tap your car again to deselect.</p>
          )}
          <CarPicker value={draftFavoriteCar} onChange={setDraftFavoriteCar} />
        </div>

        {/* Ranks */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Competitive Ranks</Label>
          <div className="space-y-2">
            {gameModes.map((mode) => {
              const rank = draftRanks[mode];
              const isEditingThisMode = editingMode === mode;
              const colorClass = RANK_COLORS[rank.rank_tier] ?? "text-foreground";

              return (
                <div key={mode} className="rounded-lg border border-border/50 bg-background/60 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-sm w-8">{gameModeLabels[mode]}</span>
                      <img src={getRankIcon(rank.rank_tier)} alt={getRankLabel(rank.rank_tier)} className="w-7 h-7 object-contain" />
                      <div>
                        <span className={`font-semibold text-sm ${colorClass}`}>
                          {getRankLabel(rank.rank_tier)}
                          {rank.rank_division && rank.rank_tier !== "unranked" && rank.rank_tier !== "supersonic_legend" ? ` ${rank.rank_division}` : ""}
                        </span>
                        {rank.mmr != null && <span className="ml-2 text-xs text-muted-foreground font-mono">{rank.mmr} MMR</span>}
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => {
                        if (isEditingThisMode) { setEditingMode(null); setEditDraft(null); }
                        else { setEditingMode(mode); setEditDraft({ ...rank }); }
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {isEditingThisMode ? <XIcon className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                    </button>
                  </div>

                  {isEditingThisMode && editDraft && (
                    <div className="border-t border-border/50 bg-muted/20 px-4 py-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Rank</Label>
                          <Select value={editDraft.rank_tier} onValueChange={(v) =>
                            setEditDraft((p) => p ? { ...p, rank_tier: v as RankTier, rank_division: v === "unranked" ? null : p.rank_division ?? "I" } : p)}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{rankTierOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Division</Label>
                          <Select value={editDraft.rank_division ?? ""}
                            onValueChange={(v) => setEditDraft((p) => p ? { ...p, rank_division: v as RankDivision } : p)}
                            disabled={editDraft.rank_tier === "unranked" || editDraft.rank_tier === "supersonic_legend"}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={editDraft.rank_tier === "unranked" ? "N/A" : "Div"} /></SelectTrigger>
                            <SelectContent>{rankDivisionOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">MMR (optional)</Label>
                        <Input type="number" min={0} placeholder="e.g. 950" className="h-9 text-xs"
                          value={editDraft.mmr ?? ""}
                          onChange={(e) => setEditDraft((p) => p ? { ...p, mmr: e.target.value === "" ? null : Number(e.target.value) } : p)} />
                      </div>
                      <Button type="button" size="sm" variant="hero" className="w-full gap-1.5" onClick={confirmRankEdit}>
                        <Check className="w-3.5 h-3.5" /> Apply
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={cancelEdit}>Cancel</Button>
          <Button variant="hero" className="flex-1 gap-2" disabled={saving} onClick={handleSave}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
          </Button>
        </div>

        {/* Sign Out */}
        <div className="md:hidden">
          <Button variant="outline" className="w-full gap-2 text-muted-foreground" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
