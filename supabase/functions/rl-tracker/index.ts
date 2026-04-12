import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { epicUsername } = await req.json();
    if (!epicUsername?.trim()) {
      return new Response(JSON.stringify({ error: "epicUsername is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/epic/${encodeURIComponent(epicUsername.trim())}`;
    const response = await fetch(url, {
      headers: {
        "TRN-Api-Key": Deno.env.get("TRN_API_KEY") ?? "",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ScoreboardRL/1.0)",
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
