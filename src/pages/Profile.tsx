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
  AlertTriangle, Camera, Check, Loader2,
  Lock, LogOut, Pencil, Save, Star, Trophy, User, X as XIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AppLayout from "@/components/layout/AppLayout";
import { CARS, CarBadge, CarPicker } from "@/components/profile/CarSilhouette";
import { getRankIcon } from "@/lib/rankIcons";

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
  bestScore: number;
  bestGoals: number;
  bestAssists: number;
  bestSaves: number;
  bestContributionScore: number;
  topTeammates: Array<{ userId: string; name: string; games: number; wins: number }>;
};

const gameModes: GameMode[] = ["1v1", "2v2", "3v3"];
const gameModeLabels: Record<GameMode, string> = { "1v1": "1v1", "2v2": "2v2", "3v3": "3v3" };
const BIO_MAX = 140;

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

  // ── UI mode ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);

  // ── Profile data ─────────────────────────────────────────────────────────
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl]             = useState<string | null>(null);
  const [rlAccountName, setRlAccountName]     = useState("");
  const [rlNameWasSet, setRlNameWasSet]       = useState(false);
  const [rlNameLocked, setRlNameLocked]       = useState(false);
  const [bio, setBio]                         = useState("");
  const [favoriteCar, setFavoriteCar]         = useState<string | null>(null);
  const [ranks, setRanks]                     = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [profileStats, setProfileStats]       = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats]       = useState(false);

  // Edit-mode draft state
  const [draftRlName, setDraftRlName]         = useState("");
  const [draftBio, setDraftBio]               = useState("");
  const [draftFavoriteCar, setDraftFavoriteCar] = useState<string | null>(null);
  const [draftRanks, setDraftRanks]           = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [editingRlName, setEditingRlName]     = useState(false);
  const [rlNameDraft, setRlNameDraft]         = useState("");
  const [editingMode, setEditingMode]         = useState<GameMode | null>(null);
  const [editDraft, setEditDraft]             = useState<RankInput | null>(null);

  // ── Load profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (!user) return;

    const locked = localStorage.getItem(`rl_name_locked_${user.id}`) === "true";
    setRlNameLocked(locked);

    const load = async () => {
      setLoading(true);
      try {
        // Select only the base columns that are guaranteed to exist.
        // bio and favorite_car are fetched separately so a missing migration
        // doesn't crash the whole profile load.
        const [profileRes, ranksRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name, avatar_url").eq("user_id", user.id).single(),
          supabase.from("ranks").select("game_mode, rank_tier, rank_division, mmr").eq("user_id", user.id).eq("game_type", "competitive"),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (ranksRes.error)   throw ranksRes.error;

        const loadedName = profileRes.data?.rl_account_name ?? "";
        setRlAccountName(loadedName);
        setRlNameWasSet(Boolean(loadedName));
        setAvatarUrl(profileRes.data?.avatar_url ?? null);

        const next = createEmptyRanks();
        (ranksRes.data || []).forEach((r) => {
          next[r.game_mode] = { rank_tier: r.rank_tier ?? "unranked", rank_division: r.rank_division ?? null, mmr: r.mmr ?? null };
        });
        setRanks(next);

        if (!profileRes.data?.rl_account_name) setIsEditing(true);

        // Try to load bio + favorite_car (may not exist if migration hasn't run)
        try {
          const { data: extData } = await supabase
            .from("profiles")
            .select("bio, favorite_car")
            .eq("user_id", user.id)
            .single();
          const dbBio = extData?.bio ?? "";
          const lsBio = localStorage.getItem(`profile_bio_${user.id}`) ?? "";
          setBio(dbBio || lsBio);
          setFavoriteCar(extData?.favorite_car ?? null);
        } catch {
          // Columns don't exist yet — use localStorage for bio
          const lsBio = localStorage.getItem(`profile_bio_${user.id}`) ?? "";
          setBio(lsBio);
        }
      } catch (err: any) {
        toast({ title: "Failed to load profile", description: err.message, variant: "destructive" });
      } finally { setLoading(false); }
    };
    load();

    // Load game stats (win/loss, form, records, teammates)
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        // Get all game_players rows for this user
        const { data: myPlayerRows } = await supabase
          .from("game_players")
          .select("game_id, score, goals, assists, saves, contribution_score")
          .eq("user_id", user.id);

        if (!myPlayerRows || myPlayerRows.length === 0) {
          setProfileStats(null);
          return;
        }

        const gameIds = myPlayerRows.map((r) => r.game_id);

        // Compute personal records from player rows
        const records = myPlayerRows.reduce(
          (best, row) => ({
            bestScore:             Math.max(best.bestScore,             safeNum(row.score)),
            bestGoals:             Math.max(best.bestGoals,             safeNum(row.goals)),
            bestAssists:           Math.max(best.bestAssists,           safeNum(row.assists)),
            bestSaves:             Math.max(best.bestSaves,             safeNum(row.saves)),
            bestContributionScore: Math.max(best.bestContributionScore, safeNum(row.contribution_score)),
          }),
          { bestScore: 0, bestGoals: 0, bestAssists: 0, bestSaves: 0, bestContributionScore: 0 }
        );

        // Fetch game results + all players in those games
        const { data: gamesData } = await supabase
          .from("games")
          .select("id, result, played_at, game_players(user_id, player_name)")
          .in("id", gameIds)
          .order("played_at", { ascending: false });

        if (!gamesData) return;

        const totalGames = gamesData.length;
        const wins = gamesData.filter((g) => g.result === "win").length;
        const recentForm: Array<"W" | "L"> = gamesData
          .slice(0, 5)
          .map((g) => (g.result === "win" ? "W" : "L"));

        // Compute top teammates (other users who appear most often in same games)
        const teammateMap = new Map<string, { name: string; games: number; wins: number }>();
        gamesData.forEach((game) => {
          const isWin = game.result === "win";
          (game.game_players || []).forEach((p) => {
            if (!p.user_id || p.user_id === user.id) return;
            const prev = teammateMap.get(p.user_id);
            teammateMap.set(p.user_id, {
              name: p.player_name,
              games: (prev?.games ?? 0) + 1,
              wins:  (prev?.wins  ?? 0) + (isWin ? 1 : 0),
            });
          });
        });

        const topTeammates = Array.from(teammateMap.entries())
          .map(([userId, d]) => ({ userId, ...d }))
          .sort((a, b) => b.games - a.games)
          .slice(0, 3);

        setProfileStats({
          totalGames,
          wins,
          losses: totalGames - wins,
          recentForm,
          ...records,
          topTeammates,
        });
      } catch { /* non-critical */ } finally { setLoadingStats(false); }
    };
    loadStats();
  }, [authLoading, user, navigate, toast]);

  // ── Enter / cancel edit mode ──────────────────────────────────────────────
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

  // ── Avatar upload ─────────────────────────────────────────────────────────
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
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user.id);
      setAvatarUrl(urlData.publicUrl);
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── RL name confirm ───────────────────────────────────────────────────────
  const confirmRlNameEdit = () => {
    setDraftRlName(rlNameDraft.trim());
    setEditingRlName(false);
  };

  // ── Rank confirm ──────────────────────────────────────────────────────────
  const confirmRankEdit = () => {
    if (!editingMode || !editDraft) return;
    setDraftRanks((prev) => ({ ...prev, [editingMode]: editDraft }));
    setEditingMode(null);
    setEditDraft(null);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    if (rlNameWasSet && draftRlName !== rlAccountName) {
      localStorage.setItem(`rl_name_locked_${user.id}`, "true");
      setRlNameLocked(true);
    }

    // Mirror bio to localStorage as fallback
    localStorage.setItem(`profile_bio_${user.id}`, draftBio);

    try {
      const trimmedName = draftRlName.trim();
      const rankPayload = gameModes.map((mode) => ({
        user_id: user.id, game_mode: mode, game_type: "competitive" as GameType,
        rank_tier: draftRanks[mode].rank_tier,
        rank_division: draftRanks[mode].rank_tier === "unranked" ? null : draftRanks[mode].rank_division ?? "I",
        mmr: draftRanks[mode].mmr ?? null,
      }));

      // Always save base fields; try extended fields separately
      const [profileRes, ranksRes] = await Promise.all([
        supabase.from("profiles").update({
          rl_account_name: trimmedName || null,
        }).eq("user_id", user.id),
        supabase.from("ranks").upsert(rankPayload, { onConflict: "user_id,game_mode,game_type" }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (ranksRes.error)   throw ranksRes.error;

      // Try saving bio + favorite_car (requires migration to have been run)
      try {
        await supabase.from("profiles").update({
          bio: draftBio || null,
          favorite_car: draftFavoriteCar,
        }).eq("user_id", user.id);
      } catch {
        // Columns not yet migrated — bio is already in localStorage
      }

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

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }
  if (!user) return null;

  const rlNameMode: 0 | 1 | 2 = !rlNameWasSet ? 0 : rlNameLocked ? 2 : 1;
  const winRate = profileStats && profileStats.totalGames > 0
    ? Math.round((profileStats.wins / profileStats.totalGames) * 100)
    : null;
  const favoriteCarObj = favoriteCar ? CARS.find((c) => c.name === favoriteCar) ?? null : null;

  // ── VIEW MODE ─────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <AppLayout>
        <div className="space-y-4">

          {/* ── Profile card ── */}
          <Card className="border-border/50 bg-card/80 overflow-hidden">
            <div className="h-20 bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent" />
            <CardContent className="pt-0 pb-5 px-5">
              {/* Avatar + name row */}
              <div className="flex items-end gap-4 -mt-10 mb-3">
                <div className="w-20 h-20 rounded-full border-4 border-card bg-muted/40 overflow-hidden shrink-0">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User className="w-9 h-9 text-muted-foreground/60" /></div>
                  }
                </div>
                <div className="pb-1 min-w-0 flex-1">
                  <h2 className="font-display font-bold text-xl truncate">{rlAccountName || "—"}</h2>
                </div>
              </div>

              {/* Bio */}
              {bio && <p className="text-sm text-muted-foreground mb-3">{bio}</p>}

              {/* W/L record */}
              {profileStats && profileStats.totalGames > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rl-green/10 border border-rl-green/20">
                    <span className="text-xs font-bold text-rl-green">W</span>
                    <span className="text-sm font-display font-bold text-rl-green">{profileStats.wins}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rl-red/10 border border-rl-red/20">
                    <span className="text-xs font-bold text-rl-red">L</span>
                    <span className="text-sm font-display font-bold text-rl-red">{profileStats.losses}</span>
                  </div>
                  {winRate !== null && (
                    <span className="text-xs text-muted-foreground font-mono">{winRate}% win rate</span>
                  )}
                </div>
              )}

              {/* Recent form strip */}
              {profileStats && profileStats.recentForm.length > 0 && (
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-0.5">Recent</span>
                  {profileStats.recentForm.map((result, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                        result === "W" ? "bg-rl-green/20 text-rl-green border border-rl-green/30" : "bg-rl-red/20 text-rl-red border border-rl-red/30"
                      }`}
                    >
                      {result}
                    </div>
                  ))}
                </div>
              )}

              {/* Favorite car */}
              {favoriteCarObj && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Favorite Car</span>
                  <CarBadge car={favoriteCarObj} />
                </div>
              )}

              {/* Edit button */}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={enterEditMode}>
                <Pencil className="w-3.5 h-3.5" /> Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* ── Ranks ── */}
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

          {/* ── Personal records ── */}
          {profileStats && profileStats.totalGames > 0 && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Personal Records
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Score",  value: profileStats.bestScore },
                    { label: "Goals",  value: profileStats.bestGoals },
                    { label: "Assists",value: profileStats.bestAssists },
                    { label: "Saves",  value: profileStats.bestSaves },
                    { label: "Contribution", value: profileStats.bestContributionScore > 0 ? profileStats.bestContributionScore : null },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg bg-background/60">
                      <span className="font-display font-bold text-lg leading-none">
                        {value !== null ? value : <span className="text-muted-foreground text-sm">—</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Most played with ── */}
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

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
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
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>You can only change your RL username once. Choose carefully.</span>
              </div>
              <div className="flex items-center gap-2">
                <Input autoFocus placeholder="e.g. Jstn" value={rlNameDraft} onChange={(e) => setRlNameDraft(e.target.value)} className="flex-1" />
                <button type="button" onClick={confirmRlNameEdit} className="p-1.5 rounded-md text-green-400 hover:bg-green-400/10 transition-colors"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => setEditingRlName(false)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"><XIcon className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {rlNameMode === 2 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-2.5">
                <span className="font-semibold text-sm truncate">{rlAccountName}</span>
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground px-1">Contact support to change your username.</p>
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
