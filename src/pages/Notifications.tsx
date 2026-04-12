import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/layout/AppLayout";
import type { Notification } from "@/hooks/useNotifications";

const typeLabels: Record<Notification["type"], string> = {
  game_shared:   "Game Shared",
  stat_conflict: "Stat Conflict",
  stat_edit:     "Stat Edited",
  friend_request: "Friend Request",
};

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

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
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markRead(n.id); }}
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
                </div>

                {!n.read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                    className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
