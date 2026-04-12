import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Camera,
  Check,
  Heart,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Save,
  User,
  X as XIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AppLayout from "@/components/layout/AppLayout";

type GameMode = Database["public"]["Enums"]["game_mode"];
type GameType = Database["public"]["Enums"]["game_type"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

type RankInput = { rank_tier: RankTier; rank_division: RankDivision | null; mmr: number | null };

const gameModes: GameMode[] = ["1v1", "2v2", "3v3"];
const gameModeLabels: Record<GameMode, string> = { "1v1": "1v1", "2v2": "2v2", "3v3": "3v3" };

const rankTierOptions: { value: RankTier; label: string }[] = [
  { value: "unranked", label: "Unranked" },
  { value: "bronze_1", label: "Bronze I" }, { value: "bronze_2", label: "Bronze II" }, { value: "bronze_3", label: "Bronze III" },
  { value: "silver_1", label: "Silver I" }, { value: "silver_2", label: "Silver II" }, { value: "silver_3", label: "Silver III" },
  { value: "gold_1", label: "Gold I" }, { value: "gold_2", label: "Gold II" }, { value: "gold_3", label: "Gold III" },
  { value: "platinum_1", label: "Platinum I" }, { value: "platinum_2", label: "Platinum II" }, { value: "platinum_3", label: "Platinum III" },
  { value: "diamond_1", label: "Diamond I" }, { value: "diamond_2", label: "Diamond II" }, { value: "diamond_3", label: "Diamond III" },
  { value: "champion_1", label: "Champion I" }, { value: "champion_2", label: "Champion II" }, { value: "champion_3", label: "Champion III" },
  { value: "grand_champion_1", label: "Grand Champ I" }, { value: "grand_champion_2", label: "Grand Champ II" }, { value: "grand_champion_3", label: "Grand Champ III" },
  { value: "supersonic_legend", label: "SSL" },
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

type FavoriteTeammate = { userId: string; count: number; name: string } | null;

const BIO_MAX = 140;

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // RL Username state
  const [rlAccountName, setRlAccountName] = useState("");
  // Was the name already set when profile loaded?
  const [rlNameWasSet, setRlNameWasSet] = useState(false);
  // Whether the user is currently in inline-edit mode for the RL name
  const [editingRlName, setEditingRlName] = useState(false);
  const [rlNameDraft, setRlNameDraft] = useState("");
  // localStorage-based lock flag
  const [rlNameLocked, setRlNameLocked] = useState(false);

  // Bio (localStorage)
  const [bio, setBio] = useState("");

  // Ranks
  const [ranks, setRanks] = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [editingMode, setEditingMode] = useState<GameMode | null>(null);
  const [editDraft, setEditDraft] = useState<RankInput | null>(null);

  // Favorite teammate
  const [favoriteTeammate, setFavoriteTeammate] = useState<FavoriteTeammate>(null);
  const [loadingTeammate, setLoadingTeammate] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) {
      // Load localStorage values immediately
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
          if (ranksRes.error) throw ranksRes.error;

          const loadedName = profileRes.data?.rl_account_name ?? "";
          setRlAccountName(loadedName);
          setRlNameWasSet(Boolean(loadedName));
          setAvatarUrl(profileRes.data?.avatar_url ?? null);

          const next = createEmptyRanks();
          (ranksRes.data || []).forEach((r) => {
            next[r.game_mode] = { rank_tier: r.rank_tier ?? "unranked", rank_division: r.rank_division ?? null, mmr: r.mmr ?? null };
          });
          setRanks(next);
        } catch (err: any) {
          toast({ title: "Failed to load profile", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
      };
      load();

      // Load favorite teammate
      const loadTeammate = async () => {
        setLoadingTeammate(true);
        try {
          const { data: myRows } = await supabase
            .from("game_players")
            .select("game_id")
            .eq("user_id", user.id);

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
            counts.forEach((v, userId) => {
              if (!best || v.count > best.count) best = { userId, count: v.count, name: v.name };
            });

            setFavoriteTeammate(best);
          }
        } catch {
          // Teammate query is non-critical; swallow errors
        } finally { setLoadingTeammate(false); }
      };
      loadTeammate();
    }
  }, [authLoading, user, navigate, toast]);

  // ---- Avatar upload ----
  const handleAvatarClick = () => {
    if (!uploadingAvatar) fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    setUploadingAvatar(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---- RL Name inline edit ----
  const startRlNameEdit = () => {
    setRlNameDraft(rlAccountName);
    setEditingRlName(true);
  };

  const cancelRlNameEdit = () => {
    setEditingRlName(false);
    setRlNameDraft("");
  };

  const confirmRlNameEdit = () => {
    const trimmed = rlNameDraft.trim();
    setRlAccountName(trimmed);
    setEditingRlName(false);
    setRlNameDraft("");
    // Lock after this one-time change
    if (user) {
      localStorage.setItem(`rl_name_locked_${user.id}`, "true");
      setRlNameLocked(true);
    }
  };

  // ---- Rank inline editor ----
  const startEdit = (mode: GameMode) => {
    setEditingMode(mode);
    setEditDraft({ ...ranks[mode] });
  };

  const cancelEdit = () => { setEditingMode(null); setEditDraft(null); };

  const confirmEdit = () => {
    if (!editingMode || !editDraft) return;
    setRanks((prev) => ({ ...prev, [editingMode]: editDraft }));
    setEditingMode(null);
    setEditDraft(null);
  };

  // ---- Save ----
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    // Persist bio to localStorage
    localStorage.setItem(`profile_bio_${user.id}`, bio);

    try {
      const trimmedName = rlAccountName.trim();
      const rankPayload = gameModes.map((mode) => ({
        user_id: user.id, game_mode: mode, game_type: "competitive" as GameType,
        rank_tier: ranks[mode].rank_tier,
        rank_division: ranks[mode].rank_tier === "unranked" ? null : ranks[mode].rank_division ?? "I",
        mmr: ranks[mode].mmr ?? null,
      }));

      const [profileRes, ranksRes] = await Promise.all([
        supabase.from("profiles").update({ rl_account_name: trimmedName.length ? trimmedName : null }).eq("user_id", user.id),
        supabase.from("ranks").upsert(rankPayload, { onConflict: "user_id,game_mode,game_type" }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (ranksRes.error) throw ranksRes.error;
      toast({ title: "Profile saved" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

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

  // Derive RL name display mode
  // 0 = initial setup (never set)         → editable input
  // 1 = set, not locked                   → display + Edit button
  // 2 = set + locked                      → display locked, no edit
  const rlNameMode: 0 | 1 | 2 = !rlNameWasSet ? 0 : rlNameLocked ? 2 : 1;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        {/* ── Avatar ── */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-border/60 bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            aria-label="Upload avatar"
          >
            {uploadingAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground/60" />
              </div>
            )}
            {/* Camera overlay on hover */}
            {!uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Camera className="w-6 h-6 text-white" />
              </div>
            )}
          </button>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <form className="space-y-5" onSubmit={handleSave}>
          {/* ── RL Username ── */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Rocket League Username</CardTitle>
              <CardDescription className="text-xs">Your in-game name for scoreboard matching</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rlNameMode === 0 && (
                /* Initial setup — plain editable input */
                <Input
                  placeholder="e.g. Jstn"
                  value={rlAccountName}
                  onChange={(e) => setRlAccountName(e.target.value)}
                />
              )}

              {rlNameMode === 1 && !editingRlName && (
                /* Set but not locked — show with Edit button */
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-2.5">
                  <span className="font-semibold text-sm truncate">{rlAccountName}</span>
                  <button
                    type="button"
                    onClick={startRlNameEdit}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              )}

              {rlNameMode === 1 && editingRlName && (
                /* Inline edit mode */
                <div className="space-y-2">
                  {/* Warning banner */}
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>You can only change your RL username once. Choose carefully.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      placeholder="e.g. Jstn"
                      value={rlNameDraft}
                      onChange={(e) => setRlNameDraft(e.target.value)}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={confirmRlNameEdit}
                      className="p-1.5 rounded-md text-green-400 hover:bg-green-400/10 transition-colors"
                      aria-label="Confirm"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRlNameEdit}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
                      aria-label="Cancel"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {rlNameMode === 2 && (
                /* Locked — read-only */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-2.5">
                    <span className="font-semibold text-sm truncate">{rlAccountName}</span>
                    <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground px-1">Contact support to change your username.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Bio ── */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Short Bio</CardTitle>
              <CardDescription className="text-xs">Tell your teammates something about yourself <span className="opacity-60">(stored locally for now)</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <textarea
                className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                rows={3}
                maxLength={BIO_MAX}
                placeholder="e.g. Diamond 3v3 grinder, always rotating..."
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              />
              <p className="text-right text-xs text-muted-foreground">
                {bio.length}/{BIO_MAX}
              </p>
            </CardContent>
          </Card>

          {/* ── Favorite Teammate ── */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <CardTitle className="text-base font-display">Favorite Teammate</CardTitle>
              </div>
              <CardDescription className="text-xs">Linked player you've shared the most games with</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTeammate ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Crunching games…</span>
                </div>
              ) : favoriteTeammate ? (
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{favoriteTeammate.name}</p>
                    <p className="text-xs text-muted-foreground">{favoriteTeammate.count} games together</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No linked teammates found yet.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Competitive Ranks ── */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Competitive Ranks</CardTitle>
              <CardDescription className="text-xs">Tap a mode to edit its rank</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {gameModes.map((mode) => {
                const rank = ranks[mode];
                const isEditing = editingMode === mode;
                const colorClass = RANK_COLORS[rank.rank_tier] ?? "text-foreground";

                return (
                  <div key={mode} className="rounded-lg border border-border/50 bg-background/60 overflow-hidden">
                    {/* Summary row */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-sm w-8">{gameModeLabels[mode]}</span>
                        <div>
                          <span className={`font-semibold text-sm ${colorClass}`}>
                            {getRankLabel(rank.rank_tier)}
                            {rank.rank_division && rank.rank_tier !== "unranked" && rank.rank_tier !== "supersonic_legend"
                              ? ` ${rank.rank_division}`
                              : ""}
                          </span>
                          {rank.mmr != null && (
                            <span className="ml-2 text-xs text-muted-foreground font-mono">{rank.mmr} MMR</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => isEditing ? cancelEdit() : startEdit(mode)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        {isEditing ? <XIcon className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Inline edit panel */}
                    {isEditing && editDraft && (
                      <div className="border-t border-border/50 bg-muted/20 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Rank</Label>
                            <Select
                              value={editDraft.rank_tier}
                              onValueChange={(v) => setEditDraft((prev) => prev ? {
                                ...prev,
                                rank_tier: v as RankTier,
                                rank_division: v === "unranked" ? null : prev.rank_division ?? "I",
                              } : prev)}
                            >
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{rankTierOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Division</Label>
                            <Select
                              value={editDraft.rank_division ?? ""}
                              onValueChange={(v) => setEditDraft((prev) => prev ? { ...prev, rank_division: v as RankDivision } : prev)}
                              disabled={editDraft.rank_tier === "unranked" || editDraft.rank_tier === "supersonic_legend"}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder={editDraft.rank_tier === "unranked" ? "N/A" : "Div"} />
                              </SelectTrigger>
                              <SelectContent>{rankDivisionOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">MMR (optional)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 950"
                            className="h-9 text-xs"
                            value={editDraft.mmr ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditDraft((prev) => prev ? { ...prev, mmr: v === "" ? null : Number(v) } : prev);
                            }}
                          />
                        </div>

                        <Button type="button" size="sm" variant="hero" className="w-full gap-1.5" onClick={confirmEdit}>
                          <Check className="w-3.5 h-3.5" /> Apply
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button type="submit" variant="hero" className="w-full gap-2" disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Profile</>}
          </Button>
        </form>

        {/* Sign Out (mobile only) */}
        <div className="md:hidden">
          <Button variant="outline" className="w-full gap-2 text-muted-foreground" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
