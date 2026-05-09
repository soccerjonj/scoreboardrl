import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Medal, Camera, Target, Shield, Star, Globe, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  // Friends scope: filter to current user + friends, re-rank within that group
  const displayedEntries = useMemo(() => {
    if (scope === "global") return entries;
    const allowed = new Set([...(currentUserId ? [currentUserId] : []), ...friendUserIds]);
    return entries
      .filter((e) => allowed.has(e.user_id))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [scope, entries, currentUserId, friendUserIds]);

  const myEntry = displayedEntries.find((e) => e.user_id === user?.id);

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
    <div className="space-y-4">
      {/* Scope toggle — only shown when friend data is available */}
      {hasFriends && (
        <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/50 w-fit">
          <button
            onClick={() => setScope("global")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              scope === "global"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            Global
          </button>
          <button
            onClick={() => setScope("friends")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              scope === "friends"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Friends
          </button>
        </div>
      )}

      {/* Window tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/50 w-fit">
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
            {value === "season" ? seasonLabel : label}
          </button>
        ))}
      </div>

      {/* Season ending soon banner — only shown when ends_at is set and within 14 days */}
      {showEndingSoon && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/25 text-xs text-yellow-300">
          <span>⚠</span>
          <span>{currentSeason!.name} is ending soon — a new season will start shortly.</span>
        </div>
      )}

      {/* Stat category pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setStat(value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
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

      {/* My position callout (if outside top 10) */}
      {myEntry && myEntry.rank > 10 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-primary text-lg">#{myEntry.rank}</span>
              <span className="text-sm font-medium">Your position</span>
            </div>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <activeStat.icon className="w-3.5 h-3.5" />
              {myEntry.stat_value} {activeStat.unit}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Rankings card */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <activeStat.icon className="w-4 h-4 text-primary" />
            Most {activeStat.label}
          </CardTitle>
          <CardDescription className="text-xs flex items-center gap-1">
            <Camera className="w-3 h-3" />
            Photo-parsed games · {activeWindowLabel}
          </CardDescription>
        </CardHeader>
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
                      <img src={entry.avatar_url} alt={entry.rl_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
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
    </div>
  );
};

export default LeaderboardView;
