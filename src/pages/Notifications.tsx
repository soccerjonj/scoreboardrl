import { useState } from "react";
import { Bell, Check, CheckCheck, Loader2, X as XIcon } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import type { Notification } from "@/hooks/useNotifications";

const typeLabels: Record<Notification["type"], string> = {
  game_shared:       "Game Shared",
  stat_conflict:     "Stat Conflict",
  stat_edit:         "Stat Edited",
  friend_request:    "Friend Request",
  tournament_invite: "Tournament Invite",
};

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notifications, unreadCount, loading, markRead, markAllRead, refresh } = useNotifications();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  if (!authLoading && !user) { navigate("/auth"); return null; }

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const handleAcceptGameLink = async (n: Notification) => {
    if (!user) return;
    const gameId = (n.payload as { game_id?: string } | null)?.game_id;
    if (!gameId) return;
    setPendingActionId(n.id);
    try {
      const { error } = await supabase
        .from("game_players")
        .update({ submission_status: "approved" })
        .eq("game_id", gameId)
        .eq("user_id", user.id);
      if (error) throw error;
      await markRead(n.id);
      await refresh();
      toast({ title: "Linked", description: "The game now appears on your profile." });
    } catch (err: any) {
      toast({ title: "Couldn't accept", description: err.message, variant: "destructive" });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleRejectGameLink = async (n: Notification) => {
    if (!user) return;
    const gameId = (n.payload as { game_id?: string } | null)?.game_id;
    if (!gameId) return;
    setPendingActionId(n.id);
    try {
      // Reject the link: clear user_id so the game stops being attributed to me,
      // and mark the row rejected for audit.
      const { error } = await supabase
        .from("game_players")
        .update({ submission_status: "rejected", user_id: null })
        .eq("game_id", gameId)
        .eq("user_id", user.id);
      if (error) throw error;
      await markRead(n.id);
      await refresh();
      toast({ title: "Link rejected", description: "The game won't appear on your profile." });
    } catch (err: any) {
      toast({ title: "Couldn't reject", description: err.message, variant: "destructive" });
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="border-border/50 bg-card/80 border-dashed">
            <CardContent className="py-12 text-center space-y-2">
              <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const requiresApproval = n.type === "game_shared"
                && !!(n.payload as { requires_approval?: boolean } | null)?.requires_approval;
              const isBusy = pendingActionId === n.id;

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    // Clicking the body (not the action buttons) navigates to context.
                    if (!n.read) markRead(n.id);
                    if (n.type === "game_shared") {
                      const gameId = (n.payload as { game_id?: string } | null)?.game_id;
                      if (gameId) navigate(`/dashboard?game=${gameId}`);
                    } else if (n.type === "stat_edit") {
                      const gameId = (n.payload as { game_id?: string } | null)?.game_id;
                      if (gameId) navigate(`/dashboard?game=${gameId}`);
                    } else if (n.type === "friend_request") {
                      navigate("/friends");
                    } else if (n.type === "tournament_invite") {
                      const tid = (n.payload as { tournament_id?: string } | null)?.tournament_id;
                      if (tid) navigate(`/tournaments?focus=${tid}`);
                    }
                  }}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                    n.read
                      ? "border-border/40 bg-card/60"
                      : "border-primary/20 bg-primary/5 hover:bg-primary/8"
                  }`}
                >
                  {/* Unread indicator */}
                  <div className="mt-1 flex-shrink-0">
                    {n.read
                      ? <div className="w-2 h-2 rounded-full bg-transparent border border-border/40" />
                      : <div className="w-2 h-2 rounded-full bg-primary" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {typeLabels[n.type] ?? n.type}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(n.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-1">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}

                    {/* Inline Accept / Reject for tagged-in-game notifications */}
                    {requiresApproval && (
                      <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={isBusy}
                          onClick={() => handleAcceptGameLink(n)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Accept
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => handleRejectGameLink(n)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-rl-red hover:bg-rl-red/10 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <XIcon className="w-3 h-3" />}
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {!n.read && !requiresApproval && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
