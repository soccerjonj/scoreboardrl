import { supabase } from "@/integrations/supabase/client";

/**
 * Short-TTL cache for the `get_leaderboard` RPC.
 *
 * The leaderboard is read on the dashboard preview, the leaderboard page, and
 * profile pages — often several times within seconds of each other. The data
 * only changes when someone logs a game, so a 60s in-memory cache collapses
 * those duplicate reads into one DB call per (window, stat) per minute, which
 * matters a lot under a traffic spike.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function getLeaderboardCached(
  window: string,
  stat?: string
): Promise<any> {
  const key = `${window}|${stat ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const args: Record<string, string> = { p_window: window };
    if (stat) args.p_stat = stat;
    const { data, error } = await (supabase as any).rpc("get_leaderboard", args);
    if (error) throw error;
    cache.set(key, { at: Date.now(), data });
    return data;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}
