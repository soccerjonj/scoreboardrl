/**
 * delete-account
 * ──────────────
 * Permanently deletes the authenticated user: removes all of their uploaded
 * storage objects (screenshots / avatars / banners) and then deletes the auth
 * user. Database rows (profiles, games, ranks, subscriptions, etc.) cascade
 * automatically via the existing ON DELETE CASCADE FKs on auth.users.id.
 *
 * Required for GDPR/CCPA right-to-erasure.
 *
 * Auth: caller must present their own user JWT in Authorization: Bearer ...
 * Operation runs with the service-role key server-side.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const BUCKET = "screenshots";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "service_role_or_url_missing" });
  }

  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthorized" });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json(401, { error: "unauthorized" });

  const uid = user.id;
  const errors: string[] = [];
  let storageDeleted = 0;

  // Delete every object under each of the user's prefixes. The single bucket
  // is "screenshots" but the app uses three top-level prefixes:
  //   <uid>/...               — legacy game screenshots
  //   avatars/<uid>/...       — current avatar (and orphaned older ones)
  //   banners/<uid>/...       — legacy banner uploads
  const prefixes = [`${uid}`, `avatars/${uid}`, `banners/${uid}`];
  for (const prefix of prefixes) {
    try {
      const { data: files, error: listErr } = await admin.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000 });
      if (listErr) {
        errors.push(`list ${prefix}: ${listErr.message}`);
        continue;
      }
      if (!files || files.length === 0) continue;
      const paths = files
        .filter((f) => (f as any).id) // skip sub-folder entries
        .map((f) => `${prefix}/${f.name}`);
      if (paths.length === 0) continue;
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
      if (rmErr) errors.push(`remove ${prefix}: ${rmErr.message}`);
      else storageDeleted += paths.length;
    } catch (e) {
      errors.push(`${prefix}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Finally, delete the auth user. ON DELETE CASCADE handles DB rows.
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return json(500, { error: `auth_delete_failed: ${delErr.message}`, storage_deleted: storageDeleted, errors });

  return json(200, { deleted: true, storage_deleted: storageDeleted, errors });
});
