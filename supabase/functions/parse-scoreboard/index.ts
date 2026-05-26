const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TIER_QUOTAS: Record<string, number> = { free: 100, pro: 1000, lifetime: Infinity };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return fail("GEMINI_API_KEY is not configured");

    let body: { image_base64?: string; user_rl_name?: string; mime_type?: string };
    try {
      body = await req.json();
    } catch {
      return fail("Invalid request body");
    }

    const { image_base64, user_rl_name, mime_type } = body;
    if (!image_base64) return fail("No image provided");

    // ── Admin client (service role) — used for rate-limit, quota and cache ──────
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let admin: any = null;
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    }

    // Identify the caller. Anonymous calls still parse but skip quota/rate-limit.
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    if (admin && jwt) {
      const { data: { user } } = await admin.auth.getUser(jwt);
      userId = user?.id ?? null;
    }

    // ── Per-user rate limit ─────────────────────────────────────────────────────
    // Stops one person (or a script) from hammering the shared Gemini key and
    // 429-ing everyone else during a spike. The monthly quota is separate.
    if (admin && userId) {
      const { data: rl } = await admin.rpc("check_parse_rate", {
        p_user_id: userId,
        p_limit: 12,
        p_window_seconds: 60,
      });
      if (rl && rl.allowed === false) {
        return ok({
          error: "rate_limited",
          message: "You're parsing too fast — wait a few seconds and tap Retry parse.",
        });
      }
    }

    // ── Cross-session parse cache ────────────────────────────────────────────────
    // Identical image + player name → return the previously parsed result for
    // free (no Gemini call, no quota burn). Keyed on a hash of both because the
    // win/loss result depends on user_rl_name.
    let imageHash: string | null = null;
    if (admin) {
      try {
        imageHash = await sha256Hex(`${image_base64}|${user_rl_name ?? ""}`);
        const { data: cached } = await admin
          .from("parse_cache")
          .select("result")
          .eq("image_hash", imageHash)
          .maybeSingle();
        if (cached?.result) return ok(cached.result);
      } catch {
        // Cache is best-effort; fall through to a live parse.
      }
    }

    // ── Monthly quota ────────────────────────────────────────────────────────────
    if (admin && userId) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("tier")
        .eq("user_id", userId)
        .single();
      const tier = sub?.tier ?? "free";
      const quota = TIER_QUOTAS[tier] ?? 100;
      if (isFinite(quota)) {
        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
        const { data: usage } = await admin.rpc("increment_parse_count", {
          p_user_id: userId,
          p_month: monthStr,
          p_quota: quota,
        });
        if (usage && !usage.allowed) {
          return ok({ error: "quota_exceeded", used: usage.count, quota });
        }
      }
    }

    const prompt = `You are a Rocket League scoreboard parser. Extract all player stats AND match metadata from this screenshot.

RULES:
1. Strip club tags in [brackets] from player names entirely.
2. Blue team is on top, Orange team on bottom.
3. Each row: Name, Score, Goals, Assists, Saves, Shots. Read whatever number is in the last column as "shots". Set "damage" to null always.
   MVP has a star/crown icon.
4. Count players per team to determine game_mode: 1→"1v1", 2→"2v2", 3→"3v3", 4→"4v4".
5. game_type is "competitive" if ANY rank/MMR/division info appears at the bottom. Otherwise "casual".
6. ${user_rl_name ? `result: "win" if "${user_rl_name}"'s team has more goals, "loss" otherwise.` : 'Set result to "win" or "loss" based on which team has more goals for the top (blue) team.'}
7. division_change: Always return "none". Division changes are computed server-side by comparing new_rank_tier against the stored rank.
8. MMR: two numbers left of each player avatar — [mmr_change] [mmr]. Set to null if not visible.
9. new_rank_tier + new_rank_division: Read the CURRENT TIER shown at the bottom of the screen AFTER the match (e.g. "CURRENT TIER: PLATINUM III"). This is the rank the player IS NOW at. Use the same mapping as rule 10. Set both to null if not visible.
   IMPORTANT: This is the RESULTING rank after this game, not the rank before. A player can skip multiple divisions in one game.
10. Per-player rank_tier + rank_division: Each player row has a small rank badge/icon. Read it for every player and map it using:
   - Bronze 1→"bronze_1", Bronze 2→"bronze_2", Bronze 3→"bronze_3"
   - Silver 1→"silver_1", Silver 2→"silver_2", Silver 3→"silver_3"
   - Gold 1→"gold_1", Gold 2→"gold_2", Gold 3→"gold_3"
   - Platinum 1→"platinum_1", Platinum 2→"platinum_2", Platinum 3→"platinum_3"
   - Diamond 1→"diamond_1", Diamond 2→"diamond_2", Diamond 3→"diamond_3"
   - Champion 1→"champion_1", Champion 2→"champion_2", Champion 3→"champion_3"
   - Grand Champion 1→"grand_champion_1", Grand Champion 2→"grand_champion_2", Grand Champion 3→"grand_champion_3"
   - Supersonic Legend→"supersonic_legend" (rank_division: null)
   Set rank_division to I, II, III, or IV from the badge. Set both to null if the badge is unreadable.

Return ONLY valid JSON with no extra text or markdown:
{
  "game_mode": "2v2",
  "game_type": "competitive",
  "result": "win",
  "division_change": "none",
  "new_rank_tier": "diamond_1",
  "new_rank_division": "I",
  "players": [
    {"name":"PlayerName","team":"blue","score":450,"goals":2,"assists":1,"saves":3,"shots":5,"is_mvp":true,"mmr":847,"mmr_change":12,"rank_tier":"diamond_1","rank_division":"I"}
  ]
}`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime_type || "image/jpeg", data: image_base64 } },
        ],
      }],
      generationConfig: {
        // gemini-2.5-flash is a THINKING model — its internal reasoning tokens
        // count against maxOutputTokens. At 4096 a busy 3v3/4v4 board with
        // per-player rank + MMR could exhaust the budget mid-thought and return
        // truncated/empty JSON (finishReason: MAX_TOKENS), which surfaced to
        // users as "failed to parse". 8192 leaves ample room for thinking + the
        // full JSON payload.
        maxOutputTokens: 8192,
        temperature: 0,
        // Force structured JSON so we never have to strip markdown fences and
        // JSON.parse can't choke on stray prose.
        responseMimeType: "application/json",
      },
    };

    let response: Response | null = null;
    let lastError = "";

    // Retry on transient failures (429 rate-limit, 5xx) with exponential
    // backoff. Previously a 429 failed instantly with no retry — under load on
    // the Gemini free tier that turned every rate-limit into a parse failure.
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      );

      if (res.ok) {
        response = res;
        break;
      }

      const errBody = await res.text();
      lastError = `Gemini error ${res.status}: ${errBody}`;
      console.error(`Attempt ${attempt}: ${lastError.slice(0, 300)}`);

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 4) {
        // Respect Retry-After (seconds) when present, else exponential backoff.
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 8000)
            : 800 * Math.pow(2, attempt - 1); // 0.8s → 1.6s → 3.2s
        // Add jitter so many simultaneous failures don't all retry on the same
        // tick and re-spike Gemini in lockstep.
        const jitter = Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, waitMs + jitter));
        continue;
      }
      break;
    }

    if (!response) {
      // Give a friendlier message for the most common transient case.
      if (lastError.includes("429")) {
        return fail("Gemini is rate-limiting right now. Wait a moment and tap Retry parse.");
      }
      return fail(lastError || "Gemini API failed");
    }

    const aiResult = await response.json();
    const candidate = aiResult.candidates?.[0];
    const finishReason = candidate?.finishReason;
    // gemini-2.5-flash may return a "thought" part before the actual response part
    const parts: { text?: string; thought?: boolean }[] = candidate?.content?.parts ?? [];
    const responsePart = parts.find((p) => !p.thought && typeof p.text === "string");
    const content = responsePart?.text;
    if (!content) {
      console.error("Gemini empty content. finishReason:", finishReason, "full:", JSON.stringify(aiResult).slice(0, 800));
      // MAX_TOKENS means the model ran out of budget mid-response — almost
      // always recoverable on a retry, so tell the user that explicitly.
      if (finishReason === "MAX_TOKENS") {
        return fail("That scoreboard was too detailed to read in one pass — tap Retry parse.");
      }
      return fail("No response from Gemini. Tap Retry parse or enter stats manually.");
    }

    // Strip markdown code fences if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Gemini JSON:", jsonStr);
      return fail("Could not parse scoreboard. Please try again or enter stats manually.");
    }

    // Remember this result so an identical re-upload (any user/device) is free.
    if (admin && imageHash) {
      admin
        .from("parse_cache")
        .upsert({ image_hash: imageHash, result: parsed })
        .then(() => {}, () => {});
    }

    return ok(parsed);
  } catch (e) {
    console.error("Unhandled error:", e);
    return fail(e instanceof Error ? e.message : "Unknown error");
  }
});
