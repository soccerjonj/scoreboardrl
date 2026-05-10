import { format } from "date-fns";

/**
 * Relative-time string for game timestamps.
 * Recent games stay compact ("Xm ago" / "Xh ago"); older games get full
 * date + time so users can tell exactly when they were played and
 * distinguish multiple games on the same day.
 *
 *   < 60 min → "12m ago"
 *   < 24 h   → "5h ago"
 *   else     → "May 9, 3:42 PM"
 */
export function relativeDate(isoString: string): string {
  const date = new Date(isoString);
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins  <  60) return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return format(date, "MMM d, h:mm a");
}
