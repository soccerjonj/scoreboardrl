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

    const prompt = `You are a Rocket League scoreboard parser. Extract all player stats AND match metadata from this screenshot.

RULES:
1. Strip club tags in [brackets] from player names entirely.
2. Blue team is on top, Orange team on bottom.
3. Each row: Name, Score, Goals, Assists, Saves, Shots. MVP has a star/crown icon.
4. Count players per team to determine game_mode: 1="1v1", 2="2v2", 3="3v3", 4="4v4".
5. game_type is "competitive" if ANY rank/MMR/division info appears at the bottom. Otherwise "casual".
6. ${user_rl_name ? `result: "win" if "${user_rl_name}"'s team has more goals, "loss" otherwise.` : 'Set result to "win" or "loss" based on which team has more goals for the top (blue) team.'}
7. division_change: Look for an EXPLICIT rank-change indicator — an upward arrow (↑), "RANK UP", upward chevron, or similar for "up"; a downward arrow (↓), "RANK DOWN", downward chevron for "down". If NO such indicator is visible, use "none". Most games do NOT result in a rank change — default to "none" when unsure.
8. MMR: two numbers left of each player avatar — [mmr_change] [mmr]. Set to null if not visible.
9. new_rank_tier + new_rank_division: Read the CURRENT TIER shown at the bottom of the screen AFTER the match (e.g. "CURRENT TIER: PLATINUM III"). This is the rank the player IS NOW at. Map it exactly:
   - "Bronze 1"→"bronze_1", "Bronze 2"→"bronze_2", "Bronze 3"→"bronze_3"
   - "Silver 1"→"silver_1", "Silver 2"→"silver_2", "Silver 3"→"silver_3"
   - "Gold 1"→"gold_1", "Gold 2"→"gold_2", "Gold 3"→"gold_3"
   - "Platinum 1"→"platinum_1", "Platinum 2"→"platinum_2", "Platinum 3"→"platinum_3"
   - "Diamond 1"→"diamond_1", "Diamond 2"→"diamond_2", "Diamond 3"→"diamond_3"
   - "Champion 1"→"champion_1", "Champion 2"→"champion_2", "Champion 3"→"champion_3"
   - "Grand Champion 1"→"grand_champion_1", "Grand Champion 2"→"grand_champion_2", "Grand Champion 3"→"grand_champion_3"
   - "Supersonic Legend"→"supersonic_legend" (no division)
   For new_rank_division read the division indicator (I, II, III, IV). Set both to null if not visible.
   IMPORTANT: This is the RESULTING rank after this game, not the rank before. A player can skip multiple divisions in one game.

Return ONLY valid JSON with no extra text or markdown:
{
  "game_mode": "2v2",
  "game_type": "competitive",
  "result": "win",
  "division_change": "none",
  "new_rank_tier": "diamond_1",
  "new_rank_division": "I",
  "players": [
    {"name":"PlayerName","team":"blue","score":450,"goals":2,"assists":1,"saves":3,"shots":5,"is_mvp":true,"mmr":847,"mmr_change":12}
  ]
}`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime_type || "image/jpeg", data: image_base64 } },
        ],
      }],
      generationConfig: { maxOutputTokens: 4096, temperature: 0 },
    };

    let response: Response | null = null;
    let lastError = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      );

      if (res.status === 429) {
        const rateLimitBody = await res.text();
        console.error("Gemini 429:", rateLimitBody);
        return fail(`Rate limited by Gemini: ${rateLimitBody.slice(0, 200)}`);
      }

      if (!res.ok) {
        const errBody = await res.text();
        lastError = `Gemini error ${res.status}: ${errBody}`;
        console.error(`Attempt ${attempt}: ${lastError}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        break;
      }

      response = res;
      break;
    }

    if (!response) return fail(lastError || "Gemini API failed");

    const aiResult = await response.json();
    // gemini-2.5-flash may return a "thought" part before the actual response part
    const parts: { text?: string; thought?: boolean }[] = aiResult.candidates?.[0]?.content?.parts ?? [];
    const responsePart = parts.find((p) => !p.thought && typeof p.text === "string");
    const content = responsePart?.text;
    if (!content) {
      console.error("Gemini full response:", JSON.stringify(aiResult));
      return fail("No response from Gemini");
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

    return ok(parsed);
  } catch (e) {
    console.error("Unhandled error:", e);
    return fail(e instanceof Error ? e.message : "Unknown error");
  }
});
