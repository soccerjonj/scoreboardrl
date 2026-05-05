import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Camera, ChevronRight, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface LeaderEntry {
  user_id: string;
  rl_name: string;
  avatar_url: string | null;
  stat_value: number;
  rank: number;
}

const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

const LeaderboardPreviewCard = () => {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .rpc("get_leaderboard", { p_window: "7d" })
      .then(({ data }) => {
        setEntries(((data ?? []) as LeaderEntry[]).slice(0, 3));
        setLoading(false);
      });
  }, []);

  if (!loading && entries.length === 0) return null;

  return (
    <Card className="border-border/50 bg-card/80 animate-fade-in-up overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            This Week's Leaders
          </CardTitle>
          <Link to="/leaderboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="w-7 h-7 rounded-lg bg-muted/40 animate-pulse" />
                <div className="flex-1 h-4 bg-muted/40 rounded animate-pulse" />
                <div className="w-6 h-4 bg-muted/40 rounded animate-pulse" />
              </div>
            ))
          : entries.map((entry, i) => (
              <div key={entry.user_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                  <Medal className={`w-4 h-4 ${rankColors[i]}`} />
                </div>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt={entry.rl_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold">{(entry.rl_name || "?")[0].toUpperCase()}</span>
                  </div>
                )}
                <span className="text-sm font-medium flex-1 truncate">{entry.rl_name || "Unknown"}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Camera className="w-3 h-3" />
                  {entry.stat_value}
                </span>
              </div>
            ))
        }
      </CardContent>
    </Card>
  );
};

export default LeaderboardPreviewCard;
