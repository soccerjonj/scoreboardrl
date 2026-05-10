import { supabase } from "@/integrations/supabase/client";

/**
 * Result of attempting to link a player_name to a ScoreboardRL account.
 *
 * - `userId`: matched profile's user_id, or null if no match
 * - `status`: 'approved' when no consent is needed (it's the actor themselves, or
 *   a friend with auto-approve on, or no link at all). 'pending' when a real
 *   account was matched but consent is still needed.
 */
export type PlayerLink = {
  userId: string | null;
  status: "approved" | "pending";
};

/**
 * Look up each candidate player_name in `profiles.rl_account_name`. For each
 * matched user, decide whether the link should be auto-approved or pending
 * confirmation, using the same rules used at log-time:
 *
 *   - actorId itself → approved (you're linking yourself)
 *   - friend with auto-approve on → approved
 *   - everyone else → pending (a notification will need to fire)
 *
 * Names without a matched profile resolve to `{ userId: null, status: 'approved' }`
 * (a plain text row, no link).
 *
 * @param names      Array of player_name strings to look up. Case-insensitive.
 * @param actorId    The user_id of the user performing the action (uploader / editor).
 * @param actorRlName Optional: the actor's own rl_account_name. Used so a player
 *                   row with the actor's own gamertag matches even if their
 *                   profile row uses a slightly different casing.
 */
export async function linkPlayersByName(
  names: string[],
  actorId: string,
  actorRlName?: string | null
): Promise<Map<string, PlayerLink>> {
  const norm = (s: string) => s.trim().toLowerCase();
  const result = new Map<string, PlayerLink>();
  const cleaned = Array.from(new Set(names.map((n) => n?.trim()).filter(Boolean))) as string[];
  if (cleaned.length === 0) return result;

  // Look up profiles whose rl_account_name matches any of the names. The
  // .in() call is case-sensitive; we tolerate that and additionally check
  // case-insensitively against the result set client-side.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, rl_account_name")
    .in("rl_account_name", cleaned);

  const nameToUserId = new Map<string, string>();
  (profiles ?? []).forEach((p: any) => {
    if (p.rl_account_name) nameToUserId.set(norm(p.rl_account_name), p.user_id);
  });

  // Look up the actor's accepted friends + their auto-approve flag for this actor
  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select("sender_id, receiver_id, sender_auto_approve, receiver_auto_approve")
    .eq("status", "accepted")
    .or(`sender_id.eq.${actorId},receiver_id.eq.${actorId}`);

  // For each friend, the relevant auto-approve flag is THEIRS (do they trust the actor's logs).
  // sender_auto_approve = sender trusts receiver; receiver_auto_approve = receiver trusts sender.
  // When we're checking "should friendId auto-approve actorId's edits", we look at friendId's flag.
  const friendAutoApprove = new Map<string, boolean>();
  (friendRows ?? []).forEach((r: any) => {
    if (r.sender_id === actorId) {
      // Friend is r.receiver_id; their auto-approve flag for the actor (sender) is receiver_auto_approve
      friendAutoApprove.set(r.receiver_id, r.receiver_auto_approve ?? true);
    } else {
      // Friend is r.sender_id; their auto-approve flag is sender_auto_approve
      friendAutoApprove.set(r.sender_id, r.sender_auto_approve ?? true);
    }
  });

  for (const name of cleaned) {
    const key = norm(name);
    let userId = nameToUserId.get(key) ?? null;

    // Special case: actor's own rl_account_name → match to actor.id
    if (!userId && actorRlName && key === norm(actorRlName)) {
      userId = actorId;
    }

    if (!userId) {
      result.set(name, { userId: null, status: "approved" });
      continue;
    }

    if (userId === actorId) {
      result.set(name, { userId, status: "approved" });
      continue;
    }

    const auto = friendAutoApprove.get(userId);
    if (auto === true) {
      result.set(name, { userId, status: "approved" });
    } else {
      result.set(name, { userId, status: "pending" });
    }
  }

  return result;
}
