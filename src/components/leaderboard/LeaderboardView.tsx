import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Medal, Camera, Target, Shield, Star, Globe, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Window = "season" | "7d" | "28d" | "all";
type Stat   = "games" | "wins" | "goals" | "assists" | "saves" | "score";

interface LeaderEntry {
  user_id:    string;
  rl_name:    string;
  avatar_url: string | null;
  stat_value: number;
  rank:       number;
}

const WINDOWS: { value: Window; label: string }[] = [
  { value: "season", label: "This Season" }, // label overridden dynamically once season loads
  { value: "7d",     label: "7 Days"      },
  { value: "28d",    label: "28 Days"     },
  { value: "all",    label: "All Time"    },
];

const STATS: { value: Stat; label: string; icon: React.ElementType; unit: string }[] = [
  { value: "games",   label: "Games",   icon: Camera,  unit: "games"   },
  { value: "wins",    label: "Wins",    icon: Trophy,  unit: "wins"    },
  { value: "goals",   label: "Goals",   icon: Target,  unit: "goals"   },
  { value: "assists", label: "Assists", icon: Star,    unit: "assists" },
  { value: "saves",   label: "Saves",   icon: Shield,  unit: "saves"   },
  { value: "score",   label: "Points",  icon: Star,    unit: "pts"     },
];

const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
const rankBg     = ["bg-yellow-400/10 border-yellow-400/20", "bg-slate-300/10 border-slate-300/20", "bg-amber-600/10 border-amber-600/20"];

type Scope = "global" | "friends";

type Props = {
  currentUserId?: string;
  friendUserIds?: string[];
};

const LeaderboardView = ({ currentUserId, friendUserIds = [] }: Props) => {
  const { user } = useAuth();
  const [window, setWindow] = useState<Window>("season");
  const [stat,   setStat]   = useState<Stat>("games");
  const [scope,  setScope]  = useState<Scope>("global");
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState<{ name: string; ends_at: string | null } | null>(null);

  const hasFriends = friendUserIds.length > 0;

  // Sticky "you" anchor
  const userRowRef = useRef<HTMLAnchorElement>(null);
  const [isUserRowVisible, setIsUserRowVisible] = useState(true);

  // One-time fetch of the current season metadata
  useEffect(() => {
    supabase
      .from("seasons")
      .select("name, ends_at")
      .eq("is_current", true)
      .single()
      .then(({ data }) => { if (data) setCurrentSeason(data); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_leaderboard", {
          p_window: window,
          p_stat:   stat,
        } as any);
        if (error) throw error;
        setEntries((data ?? []) as LeaderEntry[]);
      } catch (err: any) {
        console.error("Leaderboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, window, stat]);

  const activeStat = STATS.find((s) => s.value === stat)!;

  // Dynamic season label — falls back to "This Season" while loading
  const seasonLabel = currentSeason?.name ?? "This Season";

  // Friends scope: filter to current user + friends, re-rank within that group,
  // but preserve the original global rank for display
  const displayedEntries = useMemo(() => {
    if (scope === "global") return entries.map((e) => ({ ...e, globalRank: null as number | null }));
    const allowed = new Set([...(currentUserId ? [currentUserId] : []), ...friendUserIds]);
    return entries
      .filter((e) => allowed.has(e.user_id))
      .map((e, i) => ({ ...e, globalRank: e.rank, rank: i + 1 }));
  }, [scope, entries, currentUserId, friendUserIds]);

  const myEntry = displayedEntries.find((e) => e.user_id === user?.id);

  // Reset visibility when entries reload (scope/window/stat change)
  useEffect(() => { setIsUserRowVisible(true); }, [displayedEntries]);

  // Observe the user's actual row; hide anchor when it's in view
  useEffect(() => {
    const el = userRowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsUserRowVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [myEntry]);

  // "Ending soon" banner: only fires when ends_at is explicitly set AND within 14 days
  const showEndingSoon = (() => {
    if (!currentSeason?.ends_at) return false;
    const days = (new Date(currentSeason.ends_at).getTime() - Date.now()) / 86_400_000;
    return days > 0 && days <= 14;
  })();

  // Label used in the CardDescription
  const activeWindowLabel = window === "season"
    ? seasonLabel
    : WINDOWS.find((w) => w.value === window)?.label ?? window;

  return (
    <div className="space-y-3">

      {/* ── Row 1: scope toggle (if friends) + window picker ── */}
      <div className="flex items-center gap-2">
        {hasFriends && (
          <div className="flex p-0.5 rounded-lg bg-muted/50 border border-border/40 shrink-0">
            <button
              onClick={() => setScope("global")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                scope === "global" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="w-3 h-3" /> Global
            </button>
            <button
              onClick={() => setScope("friends")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                scope === "friends" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3 h-3" /> Friends
            </button>
          </div>
        )}
        <div className="flex p-0.5 rounded-lg bg-muted/50 border border-border/40 flex-1">
          {WINDOWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setWindow(value)}
              className={cn(
                "flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors text-center",
                window === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {value === "season" ? seasonLabel : label}
            </button>
          ))}
        </div>
      </div>

      {/* Season ending soon banner */}
      {showEndingSoon && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/25 text-xs text-yellow-300">
          <span>⚠</span>
          <span>{currentSeason!.name} is ending soon — a new season will start shortly.</span>
        </div>
      )}

      {/* ── Row 2: stat pills (single scrollable row) ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {STATS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setStat(value)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0",
              stat === value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Rankings card */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <activeStat.icon className="w-3.5 h-3.5 text-primary" />
            Most {activeStat.label}
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Camera className="w-2.5 h-2.5" />
            {activeWindowLabel}
          </span>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="py-12 text-center space-y-3 px-4">
              <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="font-display font-semibold">No entries yet</p>
              <p className="text-sm text-muted-foreground">
                {scope === "friends"
                  ? "None of your friends have logged games yet."
                  : "Be the first! Log a game with photo scan to appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {displayedEntries.map((entry, i) => {
                const isMe   = entry.user_id === user?.id;
                const isTop3 = i < 3;
                const profilePath = isMe ? "/profile" : `/profile/${entry.user_id}`;
                return (
                  <Link
                    key={entry.user_id}
                    ref={isMe ? userRowRef : undefined}
                    to={profilePath}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60",
                      isMe && "bg-primary/5",
                      !isMe && "hover:bg-muted/20"
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
                      <img src={entry.avatar_url} alt={entry.rl_name} loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover shrink-0" />
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
                      {entry.globalRank != null && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          #{entry.globalRank} globally
                        </p>
                      )}
                    </div>

                    {/* Value */}
                    <div className="flex items-center gap-1 shrink-0">
                      <activeStat.icon className="w-3 h-3 text-muted-foreground" />
                      <span className="font-display font-bold text-sm">{entry.stat_value.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">{activeStat.unit}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky "you" anchor — visible whenever the user's real row is off-screen */}
      {myEntry && !isUserRowVisible && (() => {
        const anchorTop3 = myEntry.rank <= 3;
        const anchorIdx  = myEntry.rank - 1;
        return (
          <div className="sticky bottom-16 z-10 rounded-xl border border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg shadow-black/20 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5">
              {/* Rank badge */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold shrink-0",
                anchorTop3 ? cn("border", rankBg[anchorIdx]) : "bg-muted/30"
              )}>
                {anchorTop3
                  ? <Medal className={cn("w-4 h-4", rankColors[anchorIdx])} />
                  : <span className="text-muted-foreground">#{myEntry.rank}</span>
                }
              </div>

              {/* Avatar */}
              {myEntry.avatar_url ? (
                <img src={myEntry.avatar_url} alt={myEntry.rl_name} decoding="async" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-display font-bold text-muted-foreground">
                    {(myEntry.rl_name || "?")[0].toUpperCase()}
                  </span>
                </div>
              )}

              {/* Name + optional global rank */}
              <div className="flex-1 min-w-0">
                <p className={cn("font-display font-semibold text-sm truncate", anchorTop3 && rankColors[anchorIdx])}>
                  {myEntry.rl_name || "Unknown"}
                  <span className="ml-2 text-[10px] text-primary font-normal">· you</span>
                </p>
                {myEntry.globalRank != null && (
                  <p className="text-[10px] text-muted-foreground font-mono">#{myEntry.globalRank} globally</p>
                )}
              </div>

              {/* Stat value */}
              <div className="flex items-center gap-1 shrink-0">
                <activeStat.icon className="w-3 h-3 text-muted-foreground" />
                <span className="font-display font-bold text-sm">{myEntry.stat_value.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground">{activeStat.unit}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LeaderboardView;
