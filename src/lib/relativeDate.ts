import { format } from "date-fns";

/**
 * Compact relative-time string for game timestamps.
 *   < 60 min → "12m ago"
 *   < 24 h   → "5h ago"
 *   < 7 d    → "2d ago"
 *   else     → "May 9"
 */
export function relativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  60) return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  return format(new Date(isoString), "MMM d");
}
