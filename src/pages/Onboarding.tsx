import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

// Maps tracker.gg tier value (0–22) to our rank_tier enum
const TIER_VALUE_MAP: RankTier[] = [
  "unranked",
  "bronze_1", "bronze_2", "bronze_3",
  "silver_1", "silver_2", "silver_3",
  "gold_1", "gold_2", "gold_3",
  "platinum_1", "platinum_2", "platinum_3",
  "diamond_1", "diamond_2", "diamond_3",
  "champion_1", "champion_2", "champion_3",
  "grand_champion_1", "grand_champion_2", "grand_champion_3",
  "supersonic_legend",
];

const DIVISION_MAP: RankDivision[] = ["I", "II", "III", "IV"];

// Tracker playlist IDs → our game modes
const PLAYLIST_MAP: Record<number, GameMode> = {
  10: "1v1",
  11: "2v2",
  13: "3v3",
};

const RANK_LABELS: Record<RankTier, string> = {
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

type TrackerRank = {
  gameMode: GameMode;
  rank_tier: RankTier;
  rank_division: RankDivision | null;
  mmr: number | null;
  matchesPlayed: number;
  qualified: boolean; // 10+ matches
};

const MIN_MATCHES = 10;

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [epicUsername, setEpicUsername] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trackerRanks, setTrackerRanks] = useState<TrackerRank[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Pre-fill username from existing profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username, rl_account_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.rl_account_name) {
          // Already onboarded — go to dashboard
          navigate("/dashboard");
          return;
        }
        if (data?.username) setUsername(data.username);
      });
  }, [user, navigate]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epicUsername.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setTrackerRanks(null);
    setLookupDone(false);

    try {
      const { data, error } = await supabase.functions.invoke("rl-tracker", {
        body: { epicUsername: epicUsername.trim() },
      });

      if (error) throw new Error(error.message);
      if (data?.errors?.length) {
        throw new Error(data.errors[0]?.message ?? "Player not found");
      }

      const segments: any[] = data?.data?.segments ?? [];
      const ranked = segments.filter((s: any) => s.type === "playlist" && PLAYLIST_MAP[s.attributes?.playlistId]);

      if (ranked.length === 0) throw new Error("No ranked playlist data found for this player.");

      const ranks: TrackerRank[] = ranked.map((s: any) => {
        const gameMode = PLAYLIST_MAP[s.attributes.playlistId];
        const tierValue: number = s.stats?.tier?.value ?? 0;
        const divValue: number = s.stats?.division?.value ?? 0;
        const mmr: number | null = s.stats?.rating?.value ?? null;
        const matchesPlayed: number = s.stats?.matchesPlayed?.value ?? 0;
        const rank_tier = TIER_VALUE_MAP[tierValue] ?? "unranked";
        const rank_division = (rank_tier === "unranked" || rank_tier === "supersonic_legend")
          ? null
          : (DIVISION_MAP[divValue] ?? "I");
        return { gameMode, rank_tier, rank_division, mmr, matchesPlayed, qualified: matchesPlayed >= MIN_MATCHES };
      });

      setTrackerRanks(ranks);
      setLookupDone(true);
    } catch (err: any) {
      setLookupError(err.message ?? "Lookup failed");
      setLookupDone(true);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    if (!username.trim()) {
      toast({ title: "Username required", description: "Please enter an app username.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Update profile with username + rl_account_name
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ username: username.trim(), rl_account_name: epicUsername.trim() || null })
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      // Upsert ranks for qualified game modes
      if (trackerRanks && trackerRanks.length > 0) {
        const qualifiedRanks = trackerRanks.filter((r) => r.qualified);
        if (qualifiedRanks.length > 0) {
          const rankRows = qualifiedRanks.map((r) => ({
            user_id: user.id,
            game_mode: r.gameMode,
            game_type: "competitive" as const,
            rank_tier: r.rank_tier,
            rank_division: r.rank_division,
            mmr: r.mmr,
          }));
          const { error: ranksErr } = await supabase
            .from("ranks")
            .upsert(rankRows, { onConflict: "user_id,game_mode,game_type" });
          if (ranksErr) throw ranksErr;
        }
      }

      toast({ title: "Welcome to ScoreboardRL! 🎉" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <span className="font-display text-3xl font-bold">
            <span className="text-primary">Scoreboard</span>
            <span className="text-secondary">RL</span>
          </span>
          <h2 className="text-xl font-display font-bold mt-3">Set up your account</h2>
          <p className="text-sm text-muted-foreground mt-1">Tell us about yourself to get started</p>
        </div>

        {/* Step 1 — Identity */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Your Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">App Username</Label>
              <Input
                id="username"
                placeholder="How you'll appear in the app"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">You can change this any time from your profile.</p>
            </div>
          </CardContent>
        </Card>

        {/* Step 2 — RL Tracker Lookup */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Rocket League Account</CardTitle>
            <CardDescription className="text-xs">
              Enter your Epic Games username to auto-import your current ranks and MMR.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLookup} className="flex gap-2">
              <Input
                placeholder="Epic Games username"
                value={epicUsername}
                onChange={(e) => { setEpicUsername(e.target.value); setLookupDone(false); setTrackerRanks(null); setLookupError(null); }}
                className="flex-1"
              />
              <Button type="submit" variant="hero" size="sm" disabled={lookupLoading || !epicUsername.trim()} className="gap-1.5 shrink-0">
                {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Look Up
              </Button>
            </form>

            {/* Lookup error */}
            {lookupError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-300">Couldn't find your stats</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lookupError} — you can set your ranks manually from your profile later.</p>
                </div>
              </div>
            )}

            {/* Lookup results */}
            {trackerRanks && trackerRanks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-rl-green" />
                  <p className="text-sm font-medium">Found your account!</p>
                </div>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Mode</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Rank</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">MMR</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Games</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["1v1", "2v2", "3v3"] as GameMode[]).map((mode) => {
                        const r = trackerRanks.find((x) => x.gameMode === mode);
                        if (!r) return null;
                        return (
                          <tr key={mode} className="border-b border-border/30 last:border-0">
                            <td className="px-3 py-2 font-medium">{mode}</td>
                            <td className="px-3 py-2">
                              {r.qualified ? (
                                <span>{RANK_LABELS[r.rank_tier]}{r.rank_division ? ` Div ${r.rank_division}` : ""}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">Unranked <span className="text-[10px]">({"<"}{MIN_MATCHES} games)</span></span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">
                              {r.qualified && r.mmr ? r.mmr : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-muted-foreground">{r.matchesPlayed}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only game modes with {MIN_MATCHES}+ matches are imported. You can update ranks any time from your profile.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete button */}
        <Button
          onClick={handleComplete}
          disabled={saving || !username.trim()}
          variant="hero"
          size="lg"
          className="w-full gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
          ) : (
            <>Go to Dashboard <ChevronRight className="w-4 h-4" /></>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          You can skip the rank lookup and set everything manually from your profile.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
