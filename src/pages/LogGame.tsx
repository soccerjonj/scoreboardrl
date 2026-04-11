import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import ScoreboardUploader from "@/components/game/ScoreboardUploader";
import PlayerStatsEditor from "@/components/game/PlayerStatsEditor";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];
type GameType = Database["public"]["Enums"]["game_type"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];

const RANK_TIERS: RankTier[] = [
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
const RANK_DIVISIONS: RankDivision[] = ["I", "II", "III", "IV"];

function shiftRank(
  tier: RankTier,
  division: RankDivision | null,
  direction: "up" | "down"
): { rank_tier: RankTier; rank_division: RankDivision | null } {
  const tierIdx = RANK_TIERS.indexOf(tier);

  if (tier === "supersonic_legend") {
    if (direction === "down") return { rank_tier: "grand_champion_3", rank_division: "IV" };
    return { rank_tier: tier, rank_division: null };
  }
  if (tier === "unranked") {
    if (direction === "up") return { rank_tier: "bronze_1", rank_division: "I" };
    return { rank_tier: tier, rank_division: null };
  }

  const divIdx = division ? RANK_DIVISIONS.indexOf(division) : 0;

  if (direction === "up") {
    if (divIdx < RANK_DIVISIONS.length - 1) {
      return { rank_tier: tier, rank_division: RANK_DIVISIONS[divIdx + 1] };
    }
    const nextTier = RANK_TIERS[tierIdx + 1];
    return { rank_tier: nextTier, rank_division: nextTier === "supersonic_legend" ? null : "I" };
  } else {
    if (divIdx > 0) {
      return { rank_tier: tier, rank_division: RANK_DIVISIONS[divIdx - 1] };
    }
    const prevTier = RANK_TIERS[tierIdx - 1];
    return { rank_tier: prevTier, rank_division: prevTier === "unranked" ? null : "IV" };
  }
}

interface PlayerStat {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  is_mvp: boolean;
}

const LogGame = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [gameMode, setGameMode] = useState<GameMode>("2v2");
  const [gameType, setGameType] = useState<GameType>("competitive");
  const [result, setResult] = useState<"win" | "loss">("win");
  const [divisionChange, setDivisionChange] = useState<string>("none");
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [rlName, setRlName] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "review">("upload");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      supabase
        .from("profiles")
        .select("rl_account_name")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.rl_account_name) setRlName(data.rl_account_name);
        });
    }
  }, [user, authLoading, navigate]);

  const handleParsed = (
    data: { game_mode: GameMode; game_type: GameType; players: PlayerStat[]; result?: "win" | "loss"; division_change?: "up" | "down" | "none" },
    file: File
  ) => {
    setGameMode(data.game_mode);
    setGameType(data.game_type);
    setPlayers(data.players);
    setImageFile(file);
    setStep("review");

    // Use AI-detected result if available, otherwise fall back to goal comparison
    if (data.result) {
      setResult(data.result);
    } else if (rlName) {
      const userPlayer = data.players.find(
        (p) => p.name.toLowerCase() === rlName.toLowerCase()
      );
      if (userPlayer) {
        const userTeamGoals = data.players
          .filter((p) => p.team === userPlayer.team)
          .reduce((sum, p) => sum + p.goals, 0);
        const otherTeamGoals = data.players
          .filter((p) => p.team !== userPlayer.team)
          .reduce((sum, p) => sum + p.goals, 0);
        setResult(userTeamGoals > otherTeamGoals ? "win" : "loss");
      }
    }

    // Use AI-detected division change if available
    if (data.division_change) {
      setDivisionChange(data.division_change);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (players.length === 0) {
      toast({ title: "No players", description: "Add player stats first.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upload screenshot if available
      let screenshotUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("screenshots")
          .upload(path, imageFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }

      // Create game
      const { data: game, error: gameErr } = await supabase
        .from("games")
        .insert({
          created_by: user.id,
          game_mode: gameMode,
          game_type: gameType,
          result,
          division_change: gameType === "competitive" ? divisionChange : null,
          screenshot_url: screenshotUrl,
        })
        .select()
        .single();

      if (gameErr) throw gameErr;

      // Look up connected users for auto-approval
      const { data: friends } = await supabase
        .from("friend_requests")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      const friendIds = new Set(
        (friends || []).map((f) =>
          f.sender_id === user.id ? f.receiver_id : f.sender_id
        )
      );

      // Look up profiles to match player names to user IDs
      const playerNames = players.map((p) => p.name);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, rl_account_name")
        .in("rl_account_name", playerNames);

      const nameToUserId = new Map<string, string>();
      (profiles || []).forEach((p) => {
        if (p.rl_account_name) {
          nameToUserId.set(p.rl_account_name.toLowerCase(), p.user_id);
        }
      });

      // Insert game players
      const gamePlayers = players.map((p) => {
        const matchedUserId = nameToUserId.get(p.name.toLowerCase());
        const isCurrentUser = matchedUserId === user.id;
        const isFriend = matchedUserId ? friendIds.has(matchedUserId) : false;

        return {
          game_id: game.id,
          player_name: p.name,
          score: p.score,
          goals: p.goals,
          assists: p.assists,
          saves: p.saves,
          shots: p.shots,
          is_mvp: p.is_mvp,
          user_id: matchedUserId || null,
          submitted_by: user.id,
          submission_status: (isCurrentUser || isFriend ? "approved" : matchedUserId ? "pending" : "approved") as "approved" | "pending",
        };
      });

      const { error: playersErr } = await supabase
        .from("game_players")
        .insert(gamePlayers);

      if (playersErr) throw playersErr;

      // Auto-update profile rank if a division change was recorded
      if (gameType === "competitive" && (divisionChange === "up" || divisionChange === "down")) {
        const { data: currentRank } = await supabase
          .from("ranks")
          .select("rank_tier, rank_division")
          .eq("user_id", user.id)
          .eq("game_mode", gameMode)
          .eq("game_type", "competitive")
          .single();

        if (currentRank) {
          const newRank = shiftRank(currentRank.rank_tier, currentRank.rank_division, divisionChange);
          await supabase
            .from("ranks")
            .update({ rank_tier: newRank.rank_tier, rank_division: newRank.rank_division })
            .eq("user_id", user.id)
            .eq("game_mode", gameMode)
            .eq("game_type", "competitive");
        }
      }

      toast({ title: "Game saved!", description: "Your game has been logged successfully." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Failed to save game",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {step === "upload" && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-xl">Upload Scoreboard</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreboardUploader userRlName={rlName} onParsed={handleParsed} />

              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    // Create empty players based on game mode
                    const count = gameMode === "1v1" ? 1 : gameMode === "2v2" ? 2 : 3;
                    const emptyPlayers: PlayerStat[] = [];
                    for (let i = 0; i < count; i++) {
                      emptyPlayers.push({ name: "", team: "blue", score: 0, goals: 0, assists: 0, saves: 0, shots: 0, is_mvp: false });
                    }
                    for (let i = 0; i < count; i++) {
                      emptyPlayers.push({ name: "", team: "orange", score: 0, goals: 0, assists: 0, saves: 0, shots: 0, is_mvp: false });
                    }
                    setPlayers(emptyPlayers);
                    setStep("review");
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Or enter stats manually →
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "review" && (
          <>
            {/* Game details */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader>
                <CardTitle className="font-display text-xl">Game Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Game Mode</Label>
                    <Select value={gameMode} onValueChange={(v) => setGameMode(v as GameMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1v1">1v1</SelectItem>
                        <SelectItem value="2v2">2v2</SelectItem>
                        <SelectItem value="3v3">3v3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Game Type</Label>
                    <Select value={gameType} onValueChange={(v) => setGameType(v as GameType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="competitive">Competitive</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Result</Label>
                    <Select value={result} onValueChange={(v) => setResult(v as "win" | "loss")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="win">Win</SelectItem>
                        <SelectItem value="loss">Loss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {gameType === "competitive" && (
                    <div className="space-y-2">
                      <Label>Division Change</Label>
                      <Select value={divisionChange} onValueChange={setDivisionChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No change</SelectItem>
                          <SelectItem value="up">Division Up ↑</SelectItem>
                          <SelectItem value="down">Division Down ↓</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Player stats */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader>
                <CardTitle className="font-display text-xl">Player Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerStatsEditor
                  players={players}
                  onChange={setPlayers}
                  userRlName={rlName}
                />
              </CardContent>
            </Card>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="hero"
              size="lg"
              className="w-full gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Game
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep("upload")}
            >
              ← Back to upload
            </Button>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default LogGame;
