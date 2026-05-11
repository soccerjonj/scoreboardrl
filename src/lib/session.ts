/**
 * Session detection — a "session" is the contiguous block of games ending at
 * the most recent one, bounded by gaps of at most SESSION_GAP_MS between
 * consecutive games. The threshold matches Stats > Together's session pill
 * so the home-tab banner and the analysis surface agree on what counts as
 * "this session".
 */

export const SESSION_GAP_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Returns the contiguous block of games ending at the most recent one,
 * walking backwards until the gap between consecutive games exceeds
 * SESSION_GAP_MS. Input order is irrelevant — output preserves the
 * caller's input ordering (i.e. we filter, not re-sort).
 */
export function getSessionGames<T extends { id: string; played_at: string }>(games: T[]): T[] {
  if (games.length === 0) return [];
  const sorted = [...games].sort(
    (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
  );
  const ids = new Set<string>([sorted[0].id]);
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      new Date(sorted[i - 1].played_at).getTime() -
      new Date(sorted[i].played_at).getTime();
    if (gap > SESSION_GAP_MS) break;
    ids.add(sorted[i].id);
  }
  return games.filter((g) => ids.has(g.id));
}
