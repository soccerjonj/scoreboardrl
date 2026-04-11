import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ScoreboardSchema = z.object({
  game_mode: z.enum(["1v1", "2v2", "3v3"]),
  game_type: z.enum(["competitive", "casual"]),
  players: z.array(
    z.object({
      name: z.string(),
      team: z.enum(["blue", "orange"]),
      score: z.number(),
      goals: z.number(),
      assists: z.number(),
      saves: z.number(),
      shots: z.number(),
      is_mvp: z.boolean(),
    })
  ),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, user_rl_name } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a Rocket League scoreboard parser. You will receive a photo of a post-match scoreboard from Rocket League. Your job is to extract all player stats accurately.

CRITICAL RULES:
1. Player names in brackets like [XYSD] are CLUB TAGS, NOT part of the username. Strip them entirely. For example, if you see "[RLCS] PlayerName", the username is "PlayerName" only.
2. The scoreboard shows two teams: Blue (top/left) and Orange (bottom/right).
3. Each player row shows: Name, Score, Goals, Assists, Saves, Shots.
4. The MVP has a special icon/indicator next to their name (usually a star or crown).
5. Determine game_mode by counting players per team: 1 per team = "1v1", 2 = "2v2", 3 = "3v3".
6. Determine game_type: If you see rank icons/emblems or division info at the bottom, it's "competitive". If you see "UNRANKED" or no rank info, it's "casual".
7. Read EVERY digit carefully. Score is usually 3-4 digits. Goals, assists, saves, shots are usually 0-10.
8. The scoreboard may be from PC, PlayStation, Xbox, or Switch — layouts vary slightly but stats are always in the same order.
9. If platform icons appear next to names (PC monitor, PlayStation logo, Xbox logo, Switch logo), ignore them — they are not part of the name.

${user_rl_name ? `The user's Rocket League account name is "${user_rl_name}". Use this to identify which player is the user.` : ""}

Return ONLY a valid JSON object with this exact structure:
{
  "game_mode": "1v1" | "2v2" | "3v3",
  "game_type": "competitive" | "casual",
  "players": [
    {
      "name": "PlayerName",
      "team": "blue" | "orange",
      "score": 450,
      "goals": 2,
      "assists": 1,
      "saves": 3,
      "shots": 5,
      "is_mvp": true
    }
  ]
}

Double-check every number before responding. Accuracy is critical.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Parse this Rocket League scoreboard screenshot. Extract all player stats accurately. Remember: text in [brackets] is a club tag, NOT part of the username.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${image_base64}` },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content from AI");
    }

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const validated = ScoreboardSchema.parse(parsed);

    return new Response(JSON.stringify(validated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-scoreboard error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof z.ZodError
          ? "Could not parse scoreboard correctly. Please try again or enter stats manually."
          : e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
