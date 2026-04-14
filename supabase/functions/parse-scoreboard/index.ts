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
4. Count players per team to determine game_mode: 1="1v1", 2="2v2", 3="3v3".
5. game_type is "competitive" if ANY rank/MMR/division info appears at the bottom. Otherwise "casual".
6. ${user_rl_name ? `result: "win" if "${user_rl_name}"'s team has more goals, "loss" otherwise.` : 'Set result to "win" or "loss" based on which team has more goals for the top (blue) team.'}
7. division_change: "up", "down", or "none" based on indicators at the bottom of the screen.
8. MMR: two numbers left of each player avatar — [mmr_change] [mmr]. Set to null if not visible.

Return ONLY valid JSON with no extra text or markdown:
{
  "game_mode": "2v2",
  "game_type": "competitive",
  "result": "win",
  "division_change": "none",
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
    const content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;
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
