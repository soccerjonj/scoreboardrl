/**
 * prune-screenshots
 * ─────────────────
 * Deletes screenshot objects from the `screenshots` bucket for games older
 * than the retention window, and clears the corresponding `games.screenshot_url`
 * column so the DB no longer holds a dangling URL.
 *
 * Why we run this
 * ───────────────
 * The screenshots are kept as a debug-aid / audit trail for the AI parse.
 * Once a game is more than 30 days old we never look at the photo again,
 * but each one is ~200–500 KB and they accumulate fast. On the Free tier
 * we have 1 GB of storage; pruning keeps the bucket flat instead of
 * growing linearly with usage.
 *
 * Auth model
 * ──────────
 * This function is intentionally privileged. The caller must present an
 * Authorization header with the project's SERVICE_ROLE_KEY (which is
 * already on the function's env), OR a matching PRUNE_SECRET env var.
 * Anonymous / anon-key callers are rejected.
 *
 * How to schedule it
 * ──────────────────
 *  Option A — pg_cron + pg_net (everything stays in Supabase, recommended)
 *    Once, in the Supabase SQL editor:
 *
 *      create extension if not exists pg_cron;
 *      create extension if not exists pg_net;
 *
 *      select cron.schedule(
 *        'prune-screenshots-daily',
 *        '15 3 * * *',                      -- every day at 03:15 UTC
 *        $$ select net.http_post(
 *             url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/prune-screenshots',
 *             headers := jsonb_build_object(
 *               'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
 *               'Content-Type',  'application/json'
 *             ),
 *             body    := jsonb_build_object('retention_days', 30)
 *           ); $$
 *      );
 *
 *  Option B — GitHub Actions cron (free, runs on github.com)
 *    Add `.github/workflows/prune-screenshots.yml` with a `schedule:` trigger
 *    and a curl step that POSTs to the same URL with the same Authorization
 *    header (kept in repo secrets).
 *
 *  Option C — cron-job.org / EasyCron
 *    Any external scheduler works — just POST with the Authorization header.
 *
 * Body params (all optional)
 *   { retention_days?: number; dry_run?: boolean; batch_size?: number }
 *
 * Response
 *   { deleted, cleared, batches, errors, dry_run, retention_days }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE     = 200;
const BUCKET                  = "screenshots";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json(405, { error: "method_not_allowed" });

  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL");
  const PRUNE_SECRET     = Deno.env.get("PRUNE_SECRET"); // optional alt auth

  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return json(500, { error: "service_role_or_url_missing" });
  }

  // Auth — accept either the service role JWT or a dedicated shared secret.
  const authHeader = req.headers.get("authorization") ?? "";
  const presented = authHeader.replace(/^Bearer\s+/i, "").trim();
  const authorized =
    (presented && presented === SERVICE_ROLE_KEY) ||
    (PRUNE_SECRET && presented === PRUNE_SECRET);
  if (!authorized) return json(401, { error: "unauthorized" });

  // Parse optional body
  let retentionDays = DEFAULT_RETENTION_DAYS;
  let batchSize     = DEFAULT_BATCH_SIZE;
  let dryRun        = false;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.retention_days === "number" && body.retention_days > 0)
      retentionDays = Math.min(body.retention_days, 365);
    if (typeof body?.batch_size === "number" && body.batch_size > 0)
      batchSize = Math.min(body.batch_size, 1000);
    if (body?.dry_run === true) dryRun = true;
  } catch { /* tolerate empty body */ }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.2");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let deleted = 0;
  let cleared = 0;
  let batches = 0;
  const errors: string[] = [];

  // Loop until we drain everything older than the cutoff. Each iteration is
  // capped to `batchSize` rows so a backlog can't single-shot the function
  // timeout (Edge Functions cap at ~60s).
  while (true) {
    const { data: rows, error: selErr } = await admin
      .from("games")
      .select("id, screenshot_url")
      .not("screenshot_url", "is", null)
      .lt("played_at", cutoff)
      .limit(batchSize);

    if (selErr) {
      errors.push(`select: ${selErr.message}`);
      break;
    }
    if (!rows || rows.length === 0) break;

    batches += 1;

    // Build the storage paths. screenshot_url is the public URL emitted by
    //   supabase.storage.from("screenshots").getPublicUrl(path)
    // → "<SUPABASE_URL>/storage/v1/object/public/screenshots/<path>"
    // We want just the trailing `<path>` portion to pass to .remove().
    const ids: string[] = [];
    const paths: string[] = [];
    for (const r of rows) {
      const url = (r as any).screenshot_url as string | null;
      if (!url) continue;
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) {
        // URL shape we don't recognise — skip the file delete but still
        // clear the column below so we don't keep retrying it.
        ids.push((r as any).id);
        continue;
      }
      ids.push((r as any).id);
      paths.push(url.slice(idx + marker.length));
    }

    if (dryRun) {
      // Don't mutate anything — just count
      deleted += paths.length;
      cleared += ids.length;
      // Avoid infinite loop in dry-run by exiting after one batch
      break;
    }

    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
      if (rmErr) {
        errors.push(`storage.remove (batch ${batches}): ${rmErr.message}`);
        // Continue — clearing the DB column is still useful so we don't keep
        // selecting these rows on every run.
      } else {
        deleted += paths.length;
      }
    }

    if (ids.length > 0) {
      const { error: updErr } = await admin
        .from("games")
        .update({ screenshot_url: null })
        .in("id", ids);
      if (updErr) {
        errors.push(`games.update (batch ${batches}): ${updErr.message}`);
      } else {
        cleared += ids.length;
      }
    }

    // If we got fewer than batchSize, the queue is drained.
    if (rows.length < batchSize) break;
  }

  return json(200, {
    deleted,
    cleared,
    batches,
    errors,
    dry_run: dryRun,
    retention_days: retentionDays,
    cutoff,
  });
});
