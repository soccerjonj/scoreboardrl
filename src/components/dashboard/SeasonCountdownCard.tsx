import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type CurrentSeason = { name: string; ends_at: string | null };

const DAY_MS = 86_400_000;

/**
 * Compact strip showing how long the current competitive season has left.
 * Reads the seasons row with is_current = true (same source as the Leaderboard
 * "ending soon" banner and the Stats "This Season" window). Renders nothing
 * until an end date is set or once the season has elapsed (rollover pending).
 */
export default function SeasonCountdownCard() {
  const [season, setSeason] = useState<CurrentSeason | null>(null);

  useEffect(() => {
    supabase
      .from("seasons")
      .select("name, ends_at")
      .eq("is_current", true)
      .single()
      .then(({ data }) => { if (data) setSeason(data as CurrentSeason); });
  }, []);

  if (!season?.ends_at) return null;

  const endsAt = new Date(season.ends_at);
  const msLeft = endsAt.getTime() - Date.now();
  if (msLeft <= 0) return null;

  const daysLeft = Math.floor(msLeft / DAY_MS);
  const hoursLeft = Math.floor(msLeft / 3_600_000);

  const remaining =
    daysLeft >= 2 ? `${daysLeft} days`
    : daysLeft === 1 ? "1 day"
    : hoursLeft >= 1 ? `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`
    : "less than an hour";

  const urgent = msLeft <= 14 * DAY_MS;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-4 py-2.5",
        urgent ? "border-yellow-400/30 bg-yellow-400/8" : "border-primary/20 bg-primary/5"
      )}
    >
      <CalendarClock className={cn("w-4 h-4 shrink-0", urgent ? "text-yellow-400" : "text-primary")} />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">
          {season.name} ends in {remaining}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(endsAt, "MMM d")} · a new season starts right after
        </p>
      </div>
    </div>
  );
}
