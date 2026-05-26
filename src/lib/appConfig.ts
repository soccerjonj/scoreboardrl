import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight runtime config read from the public `app_config` table.
 *
 * Lets us flip operational switches (e.g. stop accepting screenshot uploads
 * when the Supabase storage bucket is about to hit the 1 GB free-tier cap)
 * from the dashboard without shipping a new build. The table is read-only to
 * clients; only the service role / dashboard can change values.
 *
 * Cached for the lifetime of the tab so it costs at most one tiny query.
 */
let cache: Record<string, unknown> | null = null;
let inflight: Promise<Record<string, unknown>> | null = null;

async function loadConfig(): Promise<Record<string, unknown>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await (supabase as any)
        .from("app_config")
        .select("key, value");
      const map: Record<string, unknown> = {};
      (data ?? []).forEach((r: { key: string; value: unknown }) => {
        map[r.key] = r.value;
      });
      cache = map;
      return map;
    } catch {
      // Network/permission failure: behave as if no overrides exist so the
      // app keeps working with its built-in defaults.
      return {};
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Screenshot uploads are on unless an admin has explicitly disabled them. */
export async function screenshotsEnabled(): Promise<boolean> {
  const cfg = await loadConfig();
  return cfg["screenshots_enabled"] !== false;
}
