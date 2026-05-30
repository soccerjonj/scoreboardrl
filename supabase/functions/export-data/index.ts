/**
 * export-data
 * ───────────
 * Returns a JSON dump of everything the authenticated user has in the system:
 * profile, ranks, games they created, game_players rows they appear in,
 * MMR history, tournaments, friend requests, notifications, subscription.
 *
 * Required for GDPR/CCPA right-to-data-portability. The client offers it as
 * a downloadable JSON file from Settings → Danger Zone.
 *
 * Auth: caller must present their own user JWT in Authorization: Bearer ...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

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

  // Run the queries in parallel. Errors are surfaced per-section so a partial
  // export still returns the rest of the user's data rather than 500ing the
  // whole download.
  const sections = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
    admin.from("ranks").select("*").eq("user_id", uid),
    admin.from("games").select("*").eq("created_by", uid),
    admin.from("game_players").select("*").eq("user_id", uid),
    admin.from("mmr_history").select("*").eq("user_id", uid),
    admin.from("tournaments").select("*").eq("user_id", uid),
    admin.from("friend_requests").select("*").or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
    admin.from("notifications").select("*").eq("user_id", uid),
    admin.from("subscriptions").select("*").eq("user_id", uid).maybeSingle(),
  ]);

  const [profile, ranks, games, gamePlayers, mmrHistory, tournaments, friendRequests, notifications, subscription] = sections;

  return json(200, {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile:         profile.error         ? { error: profile.error.message }         : profile.data,
    ranks:           ranks.error           ? { error: ranks.error.message }           : ranks.data,
    games:           games.error           ? { error: games.error.message }           : games.data,
    game_players:    gamePlayers.error     ? { error: gamePlayers.error.message }     : gamePlayers.data,
    mmr_history:     mmrHistory.error      ? { error: mmrHistory.error.message }      : mmrHistory.data,
    tournaments:     tournaments.error     ? { error: tournaments.error.message }     : tournaments.data,
    friend_requests: friendRequests.error  ? { error: friendRequests.error.message }  : friendRequests.data,
    notifications:   notifications.error   ? { error: notifications.error.message }   : notifications.data,
    subscription:    subscription.error    ? { error: subscription.error.message }    : subscription.data,
  });
});
