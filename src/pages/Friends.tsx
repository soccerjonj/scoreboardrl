import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, UserPlus, Users2, X, CheckCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

type FriendRequest = Database["public"]["Tables"]["friend_requests"]["Row"];
type FriendProfile = { user_id: string; username: string; rl_account_name: string | null };

const getDisplayName = (p?: FriendProfile | null) => p?.rl_account_name?.trim() || p?.username || "Unknown";

const Friends = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<FriendProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [justSent, setJustSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at, updated_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]);
      if (error) throw error;

      const reqs = requests || [];
      setFriendRequests(reqs);

      const otherIds = Array.from(new Set(reqs.map((r) => (r.sender_id === user.id ? r.receiver_id : r.sender_id)))).filter(Boolean);
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, rl_account_name").in("user_id", otherIds);
        setFriendProfiles(profiles || []);
      } else {
        setFriendProfiles([]);
      }
    } catch (err: any) {
      toast({ title: "Failed to load friends", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  const profileMap = useMemo(() => new Map(friendProfiles.map((p) => [p.user_id, p])), [friendProfiles]);
  const incoming = useMemo(() => friendRequests.filter((r) => r.status === "pending" && r.receiver_id === user?.id), [friendRequests, user?.id]);
  const outgoing = useMemo(() => friendRequests.filter((r) => r.status === "pending" && r.sender_id === user?.id), [friendRequests, user?.id]);
  const accepted = useMemo(() => friendRequests.filter((r) => r.status === "accepted"), [friendRequests]);

  const findRequestWith = (targetId: string) =>
    friendRequests.find((r) => (r.sender_id === user?.id && r.receiver_id === targetId) || (r.sender_id === targetId && r.receiver_id === user?.id));

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase.from("profiles").select("user_id, username, rl_account_name").or(`username.ilike.%${q}%,rl_account_name.ilike.%${q}%`).neq("user_id", user.id).limit(8);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleAccept = async (req: FriendRequest) => {
    setActionId(req.id);
    try {
      const { error } = await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", req.id);
      if (error) throw error;
      toast({ title: "Friend request accepted" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setActionId(null); }
  };

  const handleDecline = async (req: FriendRequest) => {
    setActionId(req.id);
    try {
      const { error } = await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", req.id);
      if (error) throw error;
      toast({ title: "Request declined" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setActionId(null); }
  };

  const handleCancel = async (req: FriendRequest) => {
    setActionId(req.id);
    try {
      const { error } = await supabase.from("friend_requests").delete().eq("id", req.id);
      if (error) throw error;
      toast({ title: "Request canceled" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setActionId(null); }
  };

  const handleRemove = async (req: FriendRequest) => {
    setActionId(req.id);
    try {
      if (req.sender_id === user?.id) {
        const { error } = await supabase.from("friend_requests").delete().eq("id", req.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", req.id);
        if (error) throw error;
      }
      toast({ title: "Friend removed" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setActionId(null); }
  };

  // Auto-approve toggle removed — columns don't exist yet

  const handleSend = async (targetId: string) => {
    if (!user) return;
    const existing = findRequestWith(targetId);
    if (existing?.status === "accepted") { toast({ title: "Already friends" }); return; }
    if (existing?.status === "pending") {
      if (existing.receiver_id === user.id) { await handleAccept(existing); }
      else { toast({ title: "Request already sent" }); }
      return;
    }
    setActionId(targetId);
    try {
      const { error } = await supabase.from("friend_requests").insert({ sender_id: user.id, receiver_id: targetId, status: "pending" });
      if (error) throw error;
      toast({ title: "Friend request sent" });
      setJustSent((prev) => new Set(prev).add(targetId));
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setActionId(null); }
  };

  const searchWithStatus = useMemo(() => searchResults.map((p) => {
    const req = findRequestWith(p.user_id);
    let status: "none" | "incoming" | "outgoing" | "accepted" = "none";
    if (req?.status === "accepted") status = "accepted";
    else if (req?.status === "pending") status = req.receiver_id === user?.id ? "incoming" : "outgoing";
    return { profile: p, status, request: req };
  }), [searchResults, friendRequests, user?.id]);

  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Friends</h1>
            <p className="text-sm text-muted-foreground">Connect with teammates to compare stats</p>
          </div>
          <Link to="/squad">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Users2 className="w-4 h-4" />
              View Squad →
            </Button>
          </Link>
        </div>

        {/* Search */}
        <Card className="border-border/50 bg-card/80">
          <CardContent className="pt-4 pb-4 space-y-3">
            <form className="flex gap-2" onSubmit={handleSearch}>
              <Input placeholder="Search by username or RL name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9" />
              <Button type="submit" size="sm" variant="hero" disabled={searching || !searchQuery.trim()} className="gap-1">
                <Search className="w-3.5 h-3.5" />
                Search
              </Button>
              {searchResults.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSearchResults([]); setSearchQuery(""); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </form>

            {searchWithStatus.map(({ profile, status, request }) => (
              <div key={profile.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                <div>
                  <p className="font-display text-sm font-semibold">{getDisplayName(profile)}</p>
                  <p className="text-xs text-muted-foreground">@{profile.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  {status === "accepted" && <Badge variant="secondary">Friends</Badge>}
                  {status === "outgoing" && <Badge variant="outline">Pending</Badge>}
                  {status === "incoming" && request && (
                    <>
                      <Button size="sm" variant="hero" disabled={actionId === request.id} onClick={() => handleAccept(request)}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={actionId === request.id} onClick={() => handleDecline(request)}>Decline</Button>
                    </>
                  )}
                  {status === "none" && (
                    justSent.has(profile.user_id) ? (
                      <span className="flex items-center gap-1.5 text-sm text-rl-green font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Request sent!
                      </span>
                    ) : (
                      <Button size="sm" variant="hero" onClick={() => handleSend(profile.user_id)} disabled={actionId === profile.user_id} className="gap-1">
                        <UserPlus className="w-3.5 h-3.5" />
                        Add
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Incoming Requests */}
        {incoming.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                Incoming Requests
                <Badge variant="secondary" className="text-xs">{incoming.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {incoming.map((req) => {
                const p = profileMap.get(req.sender_id);
                return (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                    <div>
                      <p className="font-display text-sm font-semibold">{getDisplayName(p)}</p>
                      {p?.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="hero" disabled={actionId === req.id} onClick={() => handleAccept(req)}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={actionId === req.id} onClick={() => handleDecline(req)}>Decline</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Outgoing Requests */}
        {outgoing.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Outgoing Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {outgoing.map((req) => {
                const p = profileMap.get(req.receiver_id);
                return (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                    <div>
                      <p className="font-display text-sm font-semibold">{getDisplayName(p)}</p>
                      {p?.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                    </div>
                    <Button size="sm" variant="outline" disabled={actionId === req.id} onClick={() => handleCancel(req)}>Cancel</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Friends List */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Your Friends</CardTitle>
            <CardDescription className="text-xs">Compare stats with friends on the Stats page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {accepted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No friends yet. Search for players above!</p>
            ) : (
              accepted.map((req) => {
                const otherId = req.sender_id === user.id ? req.receiver_id : req.sender_id;
                const p = profileMap.get(otherId);
                const isSender = req.sender_id === user.id;
                const autoApprove = false; // auto-approve not yet implemented
                return (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                    <Link to={`/profile/${otherId}`} className="hover:underline min-w-0">
                      <p className="font-display text-sm font-semibold">{getDisplayName(p)}</p>
                      {p?.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={actionId === req.id} onClick={() => handleRemove(req)}>Remove</Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Friends;
