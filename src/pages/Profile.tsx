import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];
type GameType = Database["public"]["Enums"]["game_type"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];
type FriendRequest = Database["public"]["Tables"]["friend_requests"]["Row"];

type RankInput = {
  rank_tier: RankTier;
  rank_division: RankDivision | null;
  mmr: number | null;
};

type FriendProfile = {
  user_id: string;
  username: string;
  rl_account_name: string | null;
};

const gameModes: GameMode[] = ["1v1", "2v2", "3v3"];

const gameModeLabels: Record<GameMode, string> = {
  "1v1": "1v1 Duel",
  "2v2": "2v2 Doubles",
  "3v3": "3v3 Standard",
};

const rankTierOptions: { value: RankTier; label: string }[] = [
  { value: "unranked", label: "Unranked" },
  { value: "bronze_1", label: "Bronze I" },
  { value: "bronze_2", label: "Bronze II" },
  { value: "bronze_3", label: "Bronze III" },
  { value: "silver_1", label: "Silver I" },
  { value: "silver_2", label: "Silver II" },
  { value: "silver_3", label: "Silver III" },
  { value: "gold_1", label: "Gold I" },
  { value: "gold_2", label: "Gold II" },
  { value: "gold_3", label: "Gold III" },
  { value: "platinum_1", label: "Platinum I" },
  { value: "platinum_2", label: "Platinum II" },
  { value: "platinum_3", label: "Platinum III" },
  { value: "diamond_1", label: "Diamond I" },
  { value: "diamond_2", label: "Diamond II" },
  { value: "diamond_3", label: "Diamond III" },
  { value: "champion_1", label: "Champion I" },
  { value: "champion_2", label: "Champion II" },
  { value: "champion_3", label: "Champion III" },
  { value: "grand_champion_1", label: "Grand Champion I" },
  { value: "grand_champion_2", label: "Grand Champion II" },
  { value: "grand_champion_3", label: "Grand Champion III" },
  { value: "supersonic_legend", label: "Supersonic Legend" },
];

const rankDivisionOptions: { value: RankDivision; label: string }[] = [
  { value: "I", label: "Division I" },
  { value: "II", label: "Division II" },
  { value: "III", label: "Division III" },
  { value: "IV", label: "Division IV" },
];

const createEmptyRanks = (): Record<GameMode, RankInput> =>
  gameModes.reduce((acc, mode) => {
    acc[mode] = { rank_tier: "unranked", rank_division: null, mmr: null };
    return acc;
  }, {} as Record<GameMode, RankInput>);

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rlAccountName, setRlAccountName] = useState("");
  const [ranks, setRanks] = useState<Record<GameMode, RankInput>>(createEmptyRanks());
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<FriendProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendActionId, setFriendActionId] = useState<string | null>(null);

  const refreshFriends = async () => {
    if (!user) return;

    setFriendsLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]);

      if (error) throw error;

      const normalizedRequests = requests || [];
      setFriendRequests(normalizedRequests);

      const otherIds = Array.from(
        new Set(
          normalizedRequests.map((request) =>
            request.sender_id === user.id ? request.receiver_id : request.sender_id,
          ),
        ),
      ).filter(Boolean);

      if (otherIds.length === 0) {
        setFriendProfiles([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, username, rl_account_name")
        .in("user_id", otherIds);

      if (profileError) throw profileError;
      setFriendProfiles(profiles || []);
    } catch (err: any) {
      toast({
        title: "Failed to load friends",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFriendsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      const loadProfile = async () => {
        setLoading(true);
        try {
          const [profileResponse, ranksResponse] = await Promise.all([
            supabase
              .from("profiles")
              .select("rl_account_name")
              .eq("user_id", user.id)
              .single(),
            supabase
              .from("ranks")
              .select("game_mode, rank_tier, rank_division, mmr")
              .eq("user_id", user.id)
              .eq("game_type", "competitive"),
          ]);

          if (profileResponse.error) throw profileResponse.error;
          if (ranksResponse.error) throw ranksResponse.error;

          setRlAccountName(profileResponse.data?.rl_account_name ?? "");

          const nextRanks = createEmptyRanks();
          (ranksResponse.data || []).forEach((row) => {
            nextRanks[row.game_mode] = {
              rank_tier: row.rank_tier ?? "unranked",
              rank_division: row.rank_division ?? null,
              mmr: row.mmr ?? null,
            };
          });
          setRanks(nextRanks);
        } catch (err: any) {
          toast({
            title: "Failed to load profile",
            description: err.message,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };

      loadProfile();
      refreshFriends();
    }
  }, [authLoading, user, navigate, toast]);

  const updateRank = (mode: GameMode, updates: Partial<RankInput>) => {
    setRanks((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        ...updates,
      },
    }));
  };

  const handleTierChange = (mode: GameMode, tier: RankTier) => {
    setRanks((prev) => {
      const current = prev[mode];
      const nextDivision = tier === "unranked" ? null : current.rank_division ?? "I";
      return {
        ...prev,
        [mode]: {
          ...current,
          rank_tier: tier,
          rank_division: nextDivision,
        },
      };
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const trimmedName = rlAccountName.trim();
      const rankPayload = gameModes.map((mode) => {
        const rank = ranks[mode];
        return {
          user_id: user.id,
          game_mode: mode,
          game_type: "competitive" as GameType,
          rank_tier: rank.rank_tier,
          rank_division: rank.rank_tier === "unranked" ? null : rank.rank_division ?? "I",
          mmr: rank.mmr ?? null,
        };
      });

      const [profileResponse, ranksResponse] = await Promise.all([
        supabase
          .from("profiles")
          .update({ rl_account_name: trimmedName.length ? trimmedName : null })
          .eq("user_id", user.id),
        supabase.from("ranks").upsert(rankPayload, {
          onConflict: "user_id,game_mode,game_type",
        }),
      ]);

      if (profileResponse.error) throw profileResponse.error;
      if (ranksResponse.error) throw ranksResponse.error;

      toast({
        title: "Profile updated",
        description: "Your Rocket League account name and ranks were saved.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to save profile",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const profileMap = useMemo(
    () => new Map(friendProfiles.map((profile) => [profile.user_id, profile])),
    [friendProfiles],
  );

  const incomingRequests = useMemo(
    () => friendRequests.filter((request) => request.status === "pending" && request.receiver_id === user?.id),
    [friendRequests, user?.id],
  );

  const outgoingRequests = useMemo(
    () => friendRequests.filter((request) => request.status === "pending" && request.sender_id === user?.id),
    [friendRequests, user?.id],
  );

  const acceptedRequests = useMemo(
    () => friendRequests.filter((request) => request.status === "accepted"),
    [friendRequests],
  );

  const findRequestWith = (targetId: string) =>
    friendRequests.find(
      (request) =>
        (request.sender_id === user?.id && request.receiver_id === targetId) ||
        (request.sender_id === targetId && request.receiver_id === user?.id),
    );

  const getDisplayName = (profile?: FriendProfile | null) =>
    profile?.rl_account_name?.trim() || profile?.username || "Unknown player";

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const query = searchQuery.trim();
    if (!query.length) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, rl_account_name")
        .or(`username.ilike.%${query}%,rl_account_name.ilike.%${query}%`)
        .neq("user_id", user.id)
        .limit(8);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err: any) {
      toast({
        title: "Search failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    setFriendActionId(request.id);
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", request.id);

      if (error) throw error;
      toast({ title: "Friend request accepted" });
      await refreshFriends();
    } catch (err: any) {
      toast({ title: "Failed to accept", description: err.message, variant: "destructive" });
    } finally {
      setFriendActionId(null);
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    if (!user) return;
    setFriendActionId(request.id);
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", request.id);

      if (error) throw error;
      toast({ title: "Friend request declined" });
      await refreshFriends();
    } catch (err: any) {
      toast({ title: "Failed to decline", description: err.message, variant: "destructive" });
    } finally {
      setFriendActionId(null);
    }
  };

  const handleCancelRequest = async (request: FriendRequest) => {
    if (!user) return;
    setFriendActionId(request.id);
    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", request.id);

      if (error) throw error;
      toast({ title: "Request canceled" });
      await refreshFriends();
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    } finally {
      setFriendActionId(null);
    }
  };

  const handleRemoveFriend = async (request: FriendRequest) => {
    if (!user) return;
    setFriendActionId(request.id);
    try {
      if (request.sender_id === user.id) {
        const { error } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", request.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("friend_requests")
          .update({ status: "rejected" })
          .eq("id", request.id);

        if (error) throw error;
      }

      toast({ title: "Friend removed" });
      await refreshFriends();
    } catch (err: any) {
      toast({ title: "Failed to remove friend", description: err.message, variant: "destructive" });
    } finally {
      setFriendActionId(null);
    }
  };

  const handleSendRequest = async (targetId: string) => {
    if (!user) return;

    const existing = findRequestWith(targetId);
    if (existing?.status === "accepted") {
      toast({ title: "Already friends" });
      return;
    }

    if (existing?.status === "pending") {
      if (existing.receiver_id === user.id) {
        await handleAcceptRequest(existing);
      } else {
        toast({ title: "Request already sent" });
      }
      return;
    }

    setFriendActionId(targetId);
    try {
      const { error } = await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: targetId,
        status: "pending",
      });

      if (error) throw error;
      toast({ title: "Friend request sent" });
      await refreshFriends();
    } catch (err: any) {
      toast({ title: "Failed to send request", description: err.message, variant: "destructive" });
    } finally {
      setFriendActionId(null);
    }
  };

  const searchResultsWithStatus = useMemo(() => {
    return searchResults.map((profile) => {
      const request = findRequestWith(profile.user_id);
      let status: "none" | "incoming" | "outgoing" | "accepted" = "none";

      if (request?.status === "accepted") {
        status = "accepted";
      } else if (request?.status === "pending") {
        status = request.receiver_id === user?.id ? "incoming" : "outgoing";
      }

      return { profile, status, request };
    });
  }, [searchResults, friendRequests, user?.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display font-bold text-lg">Profile</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        <form className="space-y-6" onSubmit={handleSave}>
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-xl">Rocket League Account</CardTitle>
              <CardDescription>Use your in-game name so we can match scoreboards and stats.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="rl-account-name">Account Name</Label>
              <Input
                id="rl-account-name"
                placeholder="e.g. RocketAce23"
                value={rlAccountName}
                onChange={(event) => setRlAccountName(event.target.value)}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-xl">Competitive Ranks</CardTitle>
              <CardDescription>Set your current ranks for each competitive playlist.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {gameModes.map((mode) => {
                  const rank = ranks[mode];
                  return (
                    <div
                      key={mode}
                      className="rounded-lg border border-border/60 bg-background/60 p-4 space-y-4"
                    >
                      <div>
                        <p className="font-display text-lg">{gameModeLabels[mode]}</p>
                        <p className="text-xs text-muted-foreground">Manual entry</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Rank Tier</Label>
                        <Select
                          value={rank.rank_tier}
                          onValueChange={(value) => handleTierChange(mode, value as RankTier)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select rank" />
                          </SelectTrigger>
                          <SelectContent>
                            {rankTierOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Division</Label>
                        <Select
                          value={rank.rank_division ?? ""}
                          onValueChange={(value) => updateRank(mode, { rank_division: value as RankDivision })}
                          disabled={rank.rank_tier === "unranked"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={rank.rank_tier === "unranked" ? "N/A" : "Division"} />
                          </SelectTrigger>
                          <SelectContent>
                            {rankDivisionOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>MMR (optional)</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="e.g. 950"
                          value={rank.mmr ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === "") {
                              updateRank(mode, { mmr: null });
                              return;
                            }
                            const parsed = Number(value);
                            if (Number.isNaN(parsed)) return;
                            updateRank(mode, { mmr: parsed });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" variant="hero" size="lg" className="w-full sm:w-auto gap-2" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </Button>
        </form>

        <section className="space-y-6">
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-xl">Add Friends</CardTitle>
              <CardDescription>Search by username or Rocket League account name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearch}>
                <Input
                  placeholder="Search players"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <Button type="submit" variant="hero" disabled={searching || !searchQuery.trim()}>
                  {searching ? "Searching..." : "Search"}
                </Button>
                {searchResults.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </form>

              <div className="space-y-2">
                {searching ? (
                  <p className="text-sm text-muted-foreground">Searching players...</p>
                ) : null}
                {!searching && searchResults.length === 0 && searchQuery.trim().length > 0 ? (
                  <p className="text-sm text-muted-foreground">No players found.</p>
                ) : null}

                {searchResultsWithStatus.map(({ profile, status, request }) => (
                  <div
                    key={profile.user_id}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-display text-sm font-semibold">{getDisplayName(profile)}</p>
                      <p className="text-xs text-muted-foreground">@{profile.username}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {status === "accepted" ? (
                        <Badge variant="secondary">Friends</Badge>
                      ) : null}
                      {status === "outgoing" ? (
                        <Button variant="outline" size="sm" disabled>
                          Pending
                        </Button>
                      ) : null}
                      {status === "incoming" && request ? (
                        <>
                          <Button
                            size="sm"
                            variant="hero"
                            disabled={friendActionId === request.id}
                            onClick={() => handleAcceptRequest(request)}
                            type="button"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={friendActionId === request.id}
                            onClick={() => handleDeclineRequest(request)}
                            type="button"
                          >
                            Decline
                          </Button>
                        </>
                      ) : null}
                      {status === "none" ? (
                        <Button
                          size="sm"
                          variant="hero"
                          onClick={() => handleSendRequest(profile.user_id)}
                          disabled={friendActionId === profile.user_id}
                          type="button"
                        >
                          Add Friend
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-xl">Friend Requests</CardTitle>
              <CardDescription>Manage incoming and outgoing requests.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Incoming</p>
                {friendsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading requests...</p>
                ) : null}
                {!friendsLoading && incomingRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No incoming requests.</p>
                ) : null}
                {incomingRequests.map((request) => {
                  const profile = profileMap.get(request.sender_id);
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
                    >
                      <div>
                        <p className="font-display text-sm font-semibold">{getDisplayName(profile)}</p>
                        {profile?.username ? (
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="hero"
                          disabled={friendActionId === request.id}
                          onClick={() => handleAcceptRequest(request)}
                          type="button"
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={friendActionId === request.id}
                          onClick={() => handleDeclineRequest(request)}
                          type="button"
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Outgoing</p>
                {friendsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading requests...</p>
                ) : null}
                {!friendsLoading && outgoingRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outgoing requests.</p>
                ) : null}
                {outgoingRequests.map((request) => {
                  const profile = profileMap.get(request.receiver_id);
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
                    >
                      <div>
                        <p className="font-display text-sm font-semibold">{getDisplayName(profile)}</p>
                        {profile?.username ? (
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={friendActionId === request.id}
                        onClick={() => handleCancelRequest(request)}
                        type="button"
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-xl">Your Friends</CardTitle>
              <CardDescription>Compare stats with your friends on the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {friendsLoading ? (
                <p className="text-sm text-muted-foreground">Loading friends...</p>
              ) : null}
              {!friendsLoading && acceptedRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No friends yet. Add someone above.</p>
              ) : null}
              {acceptedRequests.map((request) => {
                const otherId = request.sender_id === user.id ? request.receiver_id : request.sender_id;
                const profile = profileMap.get(otherId);
                return (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
                  >
                    <div>
                      <p className="font-display text-sm font-semibold">{getDisplayName(profile)}</p>
                      {profile?.username ? (
                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={friendActionId === request.id}
                      onClick={() => handleRemoveFriend(request)}
                      type="button"
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Profile;
