import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, LogOut, Pencil, Check, X as XIcon } from "lucide-react";
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

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rlAccountName, setRlAccountName] = useState("");
  const [ranks, setRanks] = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  // Which mode is currently being edited inline (mobile)
  const [editingMode, setEditingMode] = useState<GameMode | null>(null);
  // Temp edit state
  const [editDraft, setEditDraft] = useState<RankInput | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) {
      const load = async () => {
        setLoading(true);
        try {
          const [profileRes, ranksRes] = await Promise.all([
            supabase.from("profiles").select("rl_account_name").eq("user_id", user.id).single(),
            supabase.from("ranks").select("game_mode, rank_tier, rank_division, mmr").eq("user_id", user.id).eq("game_type", "competitive"),
          ]);
          if (profileRes.error) throw profileRes.error;
          if (ranksRes.error) throw ranksRes.error;
          setRlAccountName(profileRes.data?.rl_account_name ?? "");
          const next = createEmptyRanks();
          (ranksRes.data || []).forEach((r) => { next[r.game_mode] = { rank_tier: r.rank_tier ?? "unranked", rank_division: r.rank_division ?? null, mmr: r.mmr ?? null }; });
          setRanks(next);
        } catch (err: any) {
          toast({ title: "Failed to load profile", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
      };
      load();
    }
  }, [authLoading, user, navigate, toast]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
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
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-display font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <form className="space-y-5" onSubmit={handleSave}>
          {/* Account Name */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Rocket League Username</CardTitle>
              <CardDescription className="text-xs">Your in-game name for scoreboard matching</CardDescription>
            </CardHeader>
            <CardContent>
              <Input placeholder="e.g. Jstn" value={rlAccountName} onChange={(e) => setRlAccountName(e.target.value)} />
            </CardContent>
          </Card>

          {/* Ranks — compact summary cards, tap to edit */}
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
                    {/* Summary row — always visible */}
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

                    {/* Inline edit panel — slides open when editing */}
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
