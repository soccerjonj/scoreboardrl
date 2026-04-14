import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Users2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];

interface SquadMember {
  userId: string;
  rlName: string;
  avatarUrl: string | null;
}

interface FriendOption {
  userId: string;
  rlName: string;
  avatarUrl: string | null;
}

interface SharedGame {
  id: string;
  played_at: string;
  game_mode: GameMode;
  result: string;
}

const STORAGE_KEY = "squad_members";

const loadSquad = (): SquadMember[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SquadMember[]) : [];
  } catch {
    return [];
  }
};

const saveSquad = (members: SquadMember[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
};

const Squad = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [squadMembers, setSquadMembers] = useState<SquadMember[]>(loadSquad);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [sharedGames, setSharedGames] = useState<SharedGame[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Load accepted friends with their profiles
  useEffect(() => {
    if (!user) return;
    const fetchFriends = async () => {
      setLoadingFriends(true);
      try {
        const { data: reqs } = await supabase
          .from("friend_requests")
          .select("sender_id, receiver_id")
          .eq("status", "accepted")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        const friendIds = (reqs || []).map((r) =>
          r.sender_id === user.id ? r.receiver_id : r.sender_id
        );

        if (friendIds.length === 0) {
          setFriends([]);
          return;
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, rl_account_name, avatar_url")
          .in("user_id", friendIds);

        setFriends(
          (profiles || []).map((p) => ({
            userId: p.user_id,
            rlName: p.rl_account_name?.trim() || p.user_id,
            avatarUrl: p.avatar_url ?? null,
          }))
        );
      } catch (err: any) {
        toast({ title: "Failed to load friends", description: err.message, variant: "destructive" });
      } finally {
        setLoadingFriends(false);
      }
    };
    fetchFriends();
  }, [user]);

  // Persist squad to localStorage on change
  useEffect(() => {
    saveSquad(squadMembers);
  }, [squadMembers]);

  // Load squad stats when squad changes
  useEffect(() => {
    if (!user || squadMembers.length === 0) {
      setSharedGames([]);
      setStatsLoaded(false);
      return;
    }

    const fetchStats = async () => {
      setLoadingStats(true);
      setStatsLoaded(false);
      try {
        // Get all games where the current user appeared
        const { data: myPlayerRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", user.id);

        const myGameIds = (myPlayerRows || []).map((r) => r.game_id);
        if (myGameIds.length === 0) {
          setSharedGames([]);
          setStatsLoaded(true);
          return;
        }

        // For each squad member, find which of those games they also appeared in
        const squadUserIds = squadMembers.map((m) => m.userId);

        // Get game_players rows for all squad members in our game set
        const { data: squadRows } = await supabase
          .from("game_players")
          .select("game_id, user_id")
          .in("user_id", squadUserIds)
          .in("game_id", myGameIds);

        // Group by game_id: count how many squad members appeared
        const gameSquadCount = new Map<string, Set<string>>();
        (squadRows || []).forEach((r) => {
          if (!gameSquadCount.has(r.game_id)) gameSquadCount.set(r.game_id, new Set());
          gameSquadCount.get(r.game_id)!.add(r.user_id);
        });

        // Keep only games where ALL squad members appeared
        const allSquadGameIds = Array.from(gameSquadCount.entries())
          .filter(([, members]) => members.size === squadUserIds.length)
          .map(([gid]) => gid);

        if (allSquadGameIds.length === 0) {
          setSharedGames([]);
          setStatsLoaded(true);
          return;
        }

        const { data: gamesData } = await supabase
          .from("games")
          .select("id, played_at, game_mode, result")
          .in("id", allSquadGameIds)
          .order("played_at", { ascending: false });

        setSharedGames((gamesData || []) as SharedGame[]);
        setStatsLoaded(true);
      } catch (err: any) {
        toast({ title: "Failed to load squad stats", description: err.message, variant: "destructive" });
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user, squadMembers]);

  const addMember = (friend: FriendOption) => {
    if (squadMembers.length >= 3) {
      toast({ title: "Squad full", description: "Max 3 teammates (4 total with you).", variant: "destructive" });
      return;
    }
    if (squadMembers.find((m) => m.userId === friend.userId)) return;
    setSquadMembers((prev) => [
      ...prev,
      { userId: friend.userId, rlName: friend.rlName, avatarUrl: friend.avatarUrl },
    ]);
  };

  const removeMember = (userId: string) => {
    setSquadMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const availableFriends = useMemo(
    () => friends.filter((f) => !squadMembers.find((m) => m.userId === f.userId)),
    [friends, squadMembers]
  );

  const totalGames = sharedGames.length;
  const winsTogther = sharedGames.filter((g) => g.result === "win").length;
  const winRateTogether = totalGames > 0 ? Math.round((winsTogther / totalGames) * 100) : null;
  const recentTogether = sharedGames.slice(0, 5);

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
        <div>
          <h1 className="text-2xl font-display font-bold">Squad</h1>
          <p className="text-sm text-muted-foreground">Track stats with your regular teammates</p>
        </div>

        {/* Squad builder */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Your Squad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current squad chips */}
            {squadMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {squadMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5"
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.rlName} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                        <Users2 className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{m.rlName}</span>
                    <button
                      onClick={() => removeMember(m.userId)}
                      className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {squadMembers.length === 0 && (
              <p className="text-sm text-muted-foreground">No teammates added yet.</p>
            )}

            {/* Add teammate section */}
            {squadMembers.length < 3 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Add Teammate
                </p>
                {loadingFriends ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading friends...
                  </div>
                ) : availableFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {friends.length === 0
                      ? "No friends yet. Add friends first!"
                      : "All your friends are already in the squad."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {availableFriends.map((f) => (
                      <button
                        key={f.userId}
                        onClick={() => addMember(f)}
                        className="w-full flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 hover:bg-muted/40 transition-colors px-3 py-2 text-left"
                      >
                        {f.avatarUrl ? (
                          <img src={f.avatarUrl} alt={f.rlName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm font-medium">{f.rlName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Squad stats */}
        {squadMembers.length === 0 ? (
          <Card className="border-border/50 bg-card/80 border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Users2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="font-display font-semibold text-base">Add a teammate to see your squad stats</p>
              <p className="text-sm text-muted-foreground">Select teammates above to view games you've played together</p>
            </CardContent>
          </Card>
        ) : loadingStats ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : statsLoaded && (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-border/50 bg-card/80">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">Games Together</p>
                  <p className="font-display font-bold text-2xl">{totalGames}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/80">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">Wins Together</p>
                  <p className="font-display font-bold text-2xl">{winsTogther}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/80">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                  <p className="font-display font-bold text-2xl">
                    {winRateTogether != null ? `${winRateTogether}%` : "--"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent games together */}
            {recentTogether.length > 0 ? (
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">Recent Games Together</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentTogether.map((game) => {
                    const isWin = game.result === "win";
                    return (
                      <div key={game.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
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
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/50 bg-card/80 border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No games found with all squad members together.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Squad;
