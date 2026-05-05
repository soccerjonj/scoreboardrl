import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Trophy, Medal, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

type Window = "7d" | "28d" | "all";

interface LeaderEntry {
  user_id: string;
  rl_name: string;
  avatar_url: string | null;
  game_count: number;
  rank: number;
}

const WINDOWS: { value: Window; label: string }[] = [
  { value: "7d",  label: "7 Days" },
  { value: "28d", label: "28 Days" },
  { value: "all", label: "All Time" },
];

const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
const rankBg     = ["bg-yellow-400/10 border-yellow-400/20", "bg-slate-300/10 border-slate-300/20", "bg-amber-600/10 border-amber-600/20"];

const Leaderboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [window, setWindow] = useState<Window>("7d");
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_leaderboard", { p_window: window });
        if (error) throw error;
        setEntries((data ?? []) as LeaderEntry[]);
      } catch (err: any) {
        console.error("Leaderboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, window]);

  const myEntry = entries.find((e) => e.user_id === user?.id);

  if (authLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">Most games logged via photo scan</p>
        </div>

        {/* Window tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/50 w-fit animate-fade-in-up">
          {WINDOWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setWindow(value)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                window === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* My position callout (if not in top 10) */}
        {myEntry && myEntry.rank > 10 && (
          <Card className="border-primary/20 bg-primary/5 animate-fade-in-up">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-primary text-lg">#{myEntry.rank}</span>
                <span className="text-sm font-medium">Your position</span>
              </div>
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                {myEntry.game_count} games
              </span>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard list */}
        <Card className="border-border/50 bg-card/80 animate-fade-in-up overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Rankings</CardTitle>
            <CardDescription className="text-xs flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Photo-parsed games only
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center space-y-3 px-4">
                <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="font-display font-semibold">No entries yet</p>
                <p className="text-sm text-muted-foreground">
                  Be the first! Log a game with photo scan to appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {entries.map((entry, i) => {
                  const isMe = entry.user_id === user?.id;
                  const isTop3 = i < 3;
                  return (
                    <div
                      key={entry.user_id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors",
                        isMe && "bg-primary/5",
                        isTop3 && !isMe && "hover:bg-muted/20"
                      )}
                    >
                      {/* Rank */}
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold shrink-0",
                        isTop3 ? cn("border", rankBg[i]) : "bg-muted/30"
                      )}>
                        {isTop3
                          ? <Medal className={cn("w-4 h-4", rankColors[i])} />
                          : <span className="text-muted-foreground">#{entry.rank}</span>
                        }
                      </div>

                      {/* Avatar */}
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt={entry.rl_name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs font-display font-bold text-muted-foreground">
                            {(entry.rl_name || "?")[0].toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-display font-semibold text-sm truncate", isTop3 && rankColors[i])}>
                          {entry.rl_name || "Unknown"}
                          {isMe && <span className="ml-2 text-[10px] text-primary font-normal">· you</span>}
                        </p>
                      </div>

                      {/* Count */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Camera className="w-3 h-3 text-muted-foreground" />
                        <span className="font-display font-bold text-sm">
                          {entry.game_count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Leaderboard;
