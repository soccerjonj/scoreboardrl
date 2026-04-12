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
  AlertTriangle, Camera, Check, Heart, Loader2,
  Lock, LogOut, Pencil, Save, User, X as XIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AppLayout from "@/components/layout/AppLayout";

type GameMode     = Database["public"]["Enums"]["game_mode"];
type GameType     = Database["public"]["Enums"]["game_type"];
type RankTier     = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

type RankInput = { rank_tier: RankTier; rank_division: RankDivision | null; mmr: number | null };
type FavoriteTeammate = { userId: string; count: number; name: string } | null;

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

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UI mode ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null);
  const [rlAccountName, setRlAccountName]   = useState("");
  const [rlNameWasSet, setRlNameWasSet]     = useState(false);
  const [rlNameLocked, setRlNameLocked]     = useState(false);
  const [bio, setBio]                       = useState("");
  const [ranks, setRanks]                   = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [favoriteTeammate, setFavoriteTeammate] = useState<FavoriteTeammate>(null);
  const [loadingTeammate, setLoadingTeammate]   = useState(false);

  // Edit-mode draft state
  const [draftRlName, setDraftRlName]   = useState("");
  const [draftBio, setDraftBio]         = useState("");
  const [draftRanks, setDraftRanks]     = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [editingRlName, setEditingRlName] = useState(false);
  const [rlNameDraft, setRlNameDraft]   = useState("");
  const [editingMode, setEditingMode]   = useState<GameMode | null>(null);
  const [editDraft, setEditDraft]       = useState<RankInput | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (!user) return;

    const locked = localStorage.getItem(`rl_name_locked_${user.id}`) === "true";
    setRlNameLocked(locked);
    const savedBio = localStorage.getItem(`profile_bio_${user.id}`) ?? "";
    setBio(savedBio);

    const load = async () => {
      setLoading(true);
      try {
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

        // If RL name not set yet, drop straight into edit mode
        if (!profileRes.data?.rl_account_name) setIsEditing(true);
      } catch (err: any) {
        toast({ title: "Failed to load profile", description: err.message, variant: "destructive" });
      } finally { setLoading(false); }
    };
    load();

    // Favorite teammate
    const loadTeammate = async () => {
      setLoadingTeammate(true);
      try {
        const { data: myRows } = await supabase.from("game_players").select("game_id").eq("user_id", user.id);
        const gameIds = (myRows || []).map((r) => r.game_id);
        if (gameIds.length > 0) {
          const { data: allPlayers } = await supabase
            .from("game_players")
            .select("game_id, user_id, player_name")
            .in("game_id", gameIds)
            .neq("user_id", user.id)
            .not("user_id", "is", null);

          const counts = new Map<string, { count: number; name: string }>();
          (allPlayers || []).forEach((p) => {
            if (!p.user_id) return;
            const prev = counts.get(p.user_id);
            counts.set(p.user_id, { count: (prev?.count ?? 0) + 1, name: p.player_name });
          });
          let best: FavoriteTeammate = null;
          counts.forEach((v, userId) => { if (!best || v.count > best.count) best = { userId, count: v.count, name: v.name }; });
          setFavoriteTeammate(best);
        }
      } catch { /* non-critical */ } finally { setLoadingTeammate(false); }
    };
    loadTeammate();
  }, [authLoading, user, navigate, toast]);

  // ── Enter edit mode ───────────────────────────────────────────────────────
  const enterEditMode = () => {
    setDraftRlName(rlAccountName);
    setDraftBio(bio);
    setDraftRanks(JSON.parse(JSON.stringify(ranks))); // deep copy
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

  // ── RL name edit (within edit mode) ──────────────────────────────────────
  const confirmRlNameEdit = () => {
    setDraftRlName(rlNameDraft.trim());
    setEditingRlName(false);
  };

  // ── Rank edit (within edit mode) ─────────────────────────────────────────
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
    localStorage.setItem(`profile_bio_${user.id}`, draftBio);

    // Lock RL name if it was changed from a previously-set value
    if (rlNameWasSet && draftRlName !== rlAccountName) {
      localStorage.setItem(`rl_name_locked_${user.id}`, "true");
      setRlNameLocked(true);
    }

    try {
      const trimmedName = draftRlName.trim();
      const rankPayload = gameModes.map((mode) => ({
        user_id: user.id, game_mode: mode, game_type: "competitive" as GameType,
        rank_tier: draftRanks[mode].rank_tier,
        rank_division: draftRanks[mode].rank_tier === "unranked" ? null : draftRanks[mode].rank_division ?? "I",
        mmr: draftRanks[mode].mmr ?? null,
      }));

      const [profileRes, ranksRes] = await Promise.all([
        supabase.from("profiles").update({ rl_account_name: trimmedName || null }).eq("user_id", user.id),
        supabase.from("ranks").upsert(rankPayload, { onConflict: "user_id,game_mode,game_type" }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (ranksRes.error)   throw ranksRes.error;

      // Commit drafts to live state
      setRlAccountName(trimmedName);
      setRlNameWasSet(Boolean(trimmedName));
      setBio(draftBio);
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

  // ── VIEW MODE ─────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <AppLayout>
        <div className="space-y-5">
          {/* Profile card */}
          <Card className="border-border/50 bg-card/80 overflow-hidden">
            {/* Top banner */}
            <div className="h-20 bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent" />
            <CardContent className="pt-0 pb-5 px-5">
              {/* Avatar + name */}
              <div className="flex items-end gap-4 -mt-10 mb-4">
                <div className="w-20 h-20 rounded-full border-4 border-card bg-muted/40 overflow-hidden shrink-0">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User className="w-9 h-9 text-muted-foreground/60" /></div>
                  }
                </div>
                <div className="pb-1 min-w-0">
                  <h2 className="font-display font-bold text-xl truncate">{rlAccountName || "—"}</h2>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              {/* Bio */}
              {bio && <p className="text-sm text-muted-foreground mb-4">{bio}</p>}

              {/* Edit button */}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={enterEditMode}>
                <Pencil className="w-3.5 h-3.5" /> Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* Ranks */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Competitive Ranks</p>
              {gameModes.map((mode) => {
                const rank = ranks[mode];
                const colorClass = RANK_COLORS[rank.rank_tier] ?? "text-foreground";
                return (
                  <div key={mode} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/60">
                    <span className="font-display font-bold text-sm text-muted-foreground w-8">{gameModeLabels[mode]}</span>
                    <span className={`font-semibold text-sm flex-1 ml-3 ${colorClass}`}>
                      {getRankLabel(rank.rank_tier)}
                      {rank.rank_division && rank.rank_tier !== "unranked" && rank.rank_tier !== "supersonic_legend"
                        ? ` ${rank.rank_division}` : ""}
                    </span>
                    {rank.mmr != null && (
                      <span className="text-xs text-muted-foreground font-mono">{rank.mmr} MMR</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Favorite teammate */}
          {(loadingTeammate || favoriteTeammate) && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" /> Favorite Teammate
                </p>
                {loadingTeammate ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Crunching games…
                  </div>
                ) : favoriteTeammate ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{favoriteTeammate.name}</p>
                      <p className="text-xs text-muted-foreground">{favoriteTeammate.count} games together</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Sign Out — mobile only */}
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

        {/* Sign Out — mobile only */}
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
