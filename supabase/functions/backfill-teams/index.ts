import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PlayerForCarry {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
}

function calculateCarryScores(players: PlayerForCarry[]): Array<{ name: string; carry_score: number }> {
  const results = players.map((p) => ({ name: p.name, carry_score: 0 }));

  for (const team of ["blue", "orange"] as const) {
    const teamPlayers = players.filter((p) => p.team === team);
    const teamSize = teamPlayers.length;
    if (teamSize <= 1) continue;

    const opponents = players.filter((p) => p.team !== team);
    const teamGoals = teamPlayers.reduce((s, p) => s + p.goals, 0);
    const teamAssists = teamPlayers.reduce((s, p) => s + p.assists, 0);
    const teamShots = teamPlayers.reduce((s, p) => s + p.shots, 0);
    const teamSaves = teamPlayers.reduce((s, p) => s + p.saves, 0);
    const teamScore = teamPlayers.reduce((s, p) => s + p.score, 0);
    const goalsAgainst = opponents.reduce((s, p) => s + p.goals, 0);

    const teamAvgSaves = teamSaves / teamSize;
    const teamAvgScore = teamScore / teamSize;
    const teamAvgInvolvement = teamPlayers.reduce((s, p) => s + p.goals + p.assists + p.shots + p.saves, 0) / teamSize;
    const teamOffenseWeight = teamGoals * 3 + teamAssists * 2;

    const hiddenContribs = teamPlayers.map((p) =>
      Math.max(p.score - (p.goals * 100 + p.assists * 50 + p.saves * 50 + p.shots * 10), 0)
    );
    const teamAvgHidden = hiddenContribs.reduce((s, h) => s + h, 0) / teamSize;
    const goalDiff = Math.abs(teamGoals - goalsAgainst);
    const closenessMult = 1 / (1 + goalDiff * 0.15);
    const isLoser = teamGoals < goalsAgainst;

    const rawCarries = teamPlayers.map((p, i) => {
      const offensive = teamOffenseWeight > 0
        ? (p.goals * 3 + p.assists * 2) / teamOffenseWeight
        : 0;

      const savesRatio = teamAvgSaves > 0 ? p.saves / teamAvgSaves : (p.saves > 0 ? 2 : 0);
      const clutchFactor = (p.saves + goalsAgainst) > 0 ? p.saves / (p.saves + goalsAgainst) : 0;
      const defensiveLoad = Math.min(savesRatio * clutchFactor, 3);

      const scorePremium = teamAvgScore > 0
        ? Math.min(Math.max((p.score - teamAvgScore) / teamAvgScore, -1), 2)
        : 0;

      const ratioToAvg = teamAvgHidden > 0 ? hiddenContribs[i] / teamAvgHidden : (hiddenContribs[i] > 0 ? 1 : 0);
      const hiddenFrac = p.score > 0 ? hiddenContribs[i] / p.score : 0;
      const residualCarryIndex = Math.min(ratioToAvg * (1 + hiddenFrac * 2), 3);

      const involvement = p.goals + p.assists + p.shots + p.saves;
      const involvementRate = teamAvgInvolvement > 0
        ? Math.min(involvement / teamAvgInvolvement, 3)
        : involvement > 0 ? 1 : 0;

      let raw =
        offensive          * 0.25 +
        defensiveLoad      * 0.25 +
        scorePremium       * 0.25 +
        residualCarryIndex * 0.15 +
        involvementRate    * 0.10;

      const pillarsAboveAvg = [
        p.goals   > teamGoals / teamSize,
        p.assists > teamAssists / teamSize,
        p.saves   > teamAvgSaves,
        p.shots   > teamPlayers.reduce((s, tp) => s + tp.shots, 0) / teamSize,
        p.score   > teamAvgScore,
      ].filter(Boolean).length;
      raw *= 1.0 + pillarsAboveAvg * 0.1;

      if (p.goals >= 2 && p.shots + p.saves + p.assists < 3) raw *= 0.75;
      raw *= closenessMult;
      if (isLoser && savesRatio > 1.5) raw *= 0.9;

      return Math.max(raw, 0);
    });

    const maxIdx = rawCarries.indexOf(Math.max(...rawCarries));
    const topRaw = rawCarries[maxIdx];
    const totalRaw = rawCarries.reduce((s, r) => s + r, 0);
    const fairShare = 1 / teamSize;
    const topShare = totalRaw > 0 ? topRaw / totalRaw : fairShare;
    const excess = Math.max(topShare - fairShare, 0);
    const maxExcess = 1 - fairShare;
    const carryScore = maxExcess > 0
      ? Math.max(Math.round(Math.pow(excess / maxExcess, 0.6) * 100), 1)
      : 1;

    const winner = results.find((r) => r.name === teamPlayers[maxIdx].name);
    if (winner) winner.carry_score = carryScore;
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let reqLimit = 3;
    let recalculate = false;
    try {
      const body = await req.json();
      console.log("Body received:", JSON.stringify(body));
      reqLimit = body.limit || 3;
      recalculate = !!body.recalculate;
    } catch { /* no body */ }
    const batchLimit = Math.min(reqLimit, 50);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If recalculate mode, just recalc carry scores for games that already have teams
    if (recalculate) {
      const { data: games, error: gamesErr } = await supabase
        .from("games")
        .select("id, game_mode, result, game_players (id, player_name, team, score, goals, assists, saves, shots)")
        .order("played_at", { ascending: false })
        .limit(batchLimit);

      if (gamesErr) throw gamesErr;

      console.log(`Recalculate: found ${(games || []).length} games`);

      const results: any[] = [];
      const normName = (n: string) => n?.trim().toLowerCase() ?? "";

      for (const game of (games || [])) {
        const players = game.game_players || [];
        const allHaveTeam = players.every((p: any) => p.team === "blue" || p.team === "orange");
        if (!allHaveTeam || players.length <= 2) {
          results.push({ game_id: game.id, status: "skip", reason: "missing teams or 1v1" });
          continue;
        }

        const carryInput: PlayerForCarry[] = players.map((p: any) => ({
          name: p.player_name,
          team: p.team as "blue" | "orange",
          score: p.score || 0,
          goals: p.goals || 0,
          assists: p.assists || 0,
          saves: p.saves || 0,
          shots: p.shots || 0,
        }));

        const carryResults = calculateCarryScores(carryInput);

        // Reset all carry scores to 0 first, then set the carriers
        for (const player of players) {
          const cr = carryResults.find((c) => normName(c.name) === normName(player.player_name));
          await supabase
            .from("game_players")
            .update({ carry_score: cr?.carry_score ?? 0 })
            .eq("id", player.id);
        }

        results.push({ game_id: game.id, status: "ok", players: players.length });
      }

      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Original backfill logic for team assignment
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("id, game_mode, result, screenshot_url, game_players (id, player_name, team, score, goals, assists, saves, shots, carry_score)")
      .not("screenshot_url", "is", null)
      .order("played_at", { ascending: false });

    if (gamesErr) throw gamesErr;

    const needsTeam = (games || []).filter((g: any) =>
      g.game_players?.some((p: any) => p.team === null)
    ).slice(0, batchLimit);

    console.log(`Processing ${needsTeam.length} games this batch`);
    const results: any[] = [];

    for (const game of needsTeam) {
      try {
        const imgRes = await fetch(game.screenshot_url);
        if (!imgRes.ok) {
          results.push({ game_id: game.id, status: "skip", reason: "screenshot fetch failed" });
          continue;
        }
        const imgBuf = new Uint8Array(await imgRes.arrayBuffer());
        let base64 = "";
        const chunkSize = 8192;
        for (let i = 0; i < imgBuf.length; i += chunkSize) {
          const chunk = imgBuf.subarray(i, Math.min(i + chunkSize, imgBuf.length));
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            max_tokens: 2048,
            messages: [
              {
                role: "system",
                content: `You are a Rocket League scoreboard parser. Given a post-match screenshot, identify which team each player is on.
The scoreboard always shows Blue team players on top and Orange team players on the bottom.
Text in [brackets] is a club tag — strip it from player names.
Return ONLY a JSON array of objects with "name" and "team" fields. Example:
[{"name":"Player1","team":"blue"},{"name":"Player2","team":"blue"},{"name":"Player3","team":"orange"},{"name":"Player4","team":"orange"}]`,
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Identify which team each player is on in this Rocket League scoreboard." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
                ],
              },
            ],
          }),
        });

        if (!aiRes.ok) {
          results.push({ game_id: game.id, status: "skip", reason: `AI error ${aiRes.status}` });
          if (aiRes.status === 429) await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content;
        if (!content) {
          results.push({ game_id: game.id, status: "skip", reason: "no AI content" });
          continue;
        }

        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        const teamAssignments: Array<{ name: string; team: string }> = JSON.parse(jsonStr);
        const normName = (n: string) => n?.trim().toLowerCase() ?? "";
        const players = game.game_players || [];

        for (const player of players) {
          const match = teamAssignments.find(
            (a) => normName(a.name) === normName(player.player_name)
          );
          if (match && (match.team === "blue" || match.team === "orange")) {
            await supabase
              .from("game_players")
              .update({ team: match.team })
              .eq("id", player.id);
            player.team = match.team;
          }
        }

        const allHaveTeam = players.every((p: any) => p.team === "blue" || p.team === "orange");
        if (allHaveTeam && players.length > 2) {
          const carryInput: PlayerForCarry[] = players.map((p: any) => ({
            name: p.player_name,
            team: p.team as "blue" | "orange",
            score: p.score || 0,
            goals: p.goals || 0,
            assists: p.assists || 0,
            saves: p.saves || 0,
            shots: p.shots || 0,
          }));

          const carryResults = calculateCarryScores(carryInput);
          for (const cr of carryResults) {
            const row = players.find((p: any) => normName(p.player_name) === normName(cr.name));
            if (row) {
              await supabase
                .from("game_players")
                .update({ carry_score: cr.carry_score })
                .eq("id", row.id);
            }
          }
        }

        results.push({ game_id: game.id, status: "ok", players: players.length });
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        results.push({ game_id: game.id, status: "error", reason: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("backfill-teams error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
