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
  result: z.enum(["win", "loss"]).optional(),
  division_change: z.enum(["up", "down", "none"]).optional(),
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
      mmr: z.number().nullable().optional(),
      mmr_change: z.number().nullable().optional(),
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

    const systemPrompt = `You are a Rocket League scoreboard parser. You will receive a photo of a post-match scoreboard from Rocket League. Your job is to extract all player stats AND match metadata accurately.

CRITICAL RULES:
1. Player names in brackets like [XYSD] are CLUB TAGS, NOT part of the username. Strip them entirely. For example, if you see "[RLCS] PlayerName", the username is "PlayerName" only.
2. The scoreboard shows two teams: Blue (top/left) and Orange (bottom/right).
3. Each player row shows: Name, Score, Goals, Assists, Saves, Shots.
4. The MVP has a special icon/indicator next to their name (usually a star or crown).
5. Determine game_mode by counting players per team: 1 per team = "1v1", 2 = "2v2", 3 = "3v3".

GAME TYPE DETECTION - THIS IS CRITICAL:
6. Look at the BOTTOM of the scoreboard screen carefully for rank/division information.
   - If you see ANY rank emblem, rank name (Bronze, Silver, Gold, Platinum, Diamond, Champion, Grand Champion, Supersonic Legend), MMR numbers, division text (Div I, Div II, etc.), or a "DIVISION UP" / "DIVISION DOWN" banner, the match is "competitive".
   - If the bottom shows "UNRANKED" text, it is STILL "competitive" — the player just hasn't completed placement matches yet.
   - The match is "casual" ONLY if there is absolutely NO rank information, NO division info, and NO MMR displayed at the bottom. Casual matches typically show nothing or just XP/rewards at the bottom.
   - When in doubt, default to "competitive" — most Rocket League matches are competitive.

WIN/LOSS DETECTION:
7. ${user_rl_name ? `The user's Rocket League account name is "${user_rl_name}". Find which team this player is on.` : "If you cannot identify the user, skip result detection."}
   - The WINNING team's score column header or area often shows a higher total, or a "WINNER" / crown indicator.
   - Compare total goals: the team with more goals won.
   - ${user_rl_name ? `Set "result" to "win" if "${user_rl_name}"'s team has more goals, "loss" if fewer.` : ""}

DIVISION CHANGE DETECTION:
8. Look at the very bottom of the screen for division change indicators:
   - "DIVISION UP" or an upward arrow/green indicator → division_change = "up"
   - "DIVISION DOWN" or a downward arrow/red indicator → division_change = "down"
   - If the bottom shows "UNRANKED" or just a rank with no up/down indicator → division_change = "none"
   - If no division change info is visible → division_change = "none"

MMR DETECTION (competitive games only):
9. Each player row has two numbers arranged HORIZONTALLY to the LEFT of the player's avatar/name:
   - The number immediately left of the avatar is the player's CURRENT MMR after the match (a 3-5 digit integer, e.g. 785).
   - Further left of that is the MMR CHANGE for this match — shown as +X (green) or -X (red), e.g. +9 or -13.
   - The order from left to right is: [mmr_change] [mmr] [avatar] [player name] [stats...]
   - Extract both for every player. Store mmr_change as a signed integer (negative for losses, e.g. -13).
   - If a player has no MMR change shown (e.g. tournament or placement), set mmr_change to null.
   - If MMR values are not visible at all (casual game or obscured), set both mmr and mmr_change to null.

10. Read EVERY digit carefully. Score is usually 3-4 digits. Goals, assists, saves, shots are usually 0-10.
11. The scoreboard may be from PC, PlayStation, Xbox, or Switch — layouts vary slightly but stats are always in the same order.
12. If platform icons appear next to names (PC monitor, PlayStation logo, Xbox logo, Switch logo), ignore them — they are not part of the name.

Return ONLY a valid JSON object with this exact structure:
{
  "game_mode": "1v1" | "2v2" | "3v3",
  "game_type": "competitive" | "casual",
  ${user_rl_name ? `"result": "win" | "loss",` : ""}
  "division_change": "up" | "down" | "none",
  "players": [
    {
      "name": "PlayerName",
      "team": "blue" | "orange",
      "score": 450,
      "goals": 2,
      "assists": 1,
      "saves": 3,
      "shots": 5,
      "is_mvp": true,
      "mmr": 847,
      "mmr_change": 12
    }
  ]
}

Double-check every number and the game_type before responding. Most matches ARE competitive. Accuracy is critical.`;

    const requestBody = JSON.stringify({
      model: "google/gemini-2.5-pro",
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Parse this Rocket League scoreboard screenshot. Extract all player stats accurately. Also determine: 1) Is this competitive or casual? Look at the bottom for rank/division info. 2) Did the user win or lose? 3) Did they rank up or down? 4) For each player, read the MMR value and MMR change shown to the LEFT of their name. Remember: text in [brackets] is a club tag, NOT part of the username.",
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${image_base64}` },
            },
          ],
        },
      ],
    });

    const MAX_RETRIES = 3;
    let response: Response | null = null;
    let lastError: string = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: requestBody,
        }
      );

      if (res.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (res.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!res.ok) {
        lastError = `AI gateway error: ${res.status}`;
        console.error(`Attempt ${attempt}: ${lastError}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        break;
      }

      response = res;
      break;
    }

    if (!response) {
      throw new Error(lastError || "AI gateway failed after retries");
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
