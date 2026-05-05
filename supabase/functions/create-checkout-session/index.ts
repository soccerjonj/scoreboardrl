import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fail = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!STRIPE_SECRET_KEY) return fail("Stripe not configured", 500);

  // Auth
  const authHeader = req.headers.get("authorization");
  const jwt = authHeader?.replace("Bearer ", "");
  if (!jwt) return fail("Unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return fail("Unauthorized", 401);

  let body: { price_id?: string; success_url?: string; cancel_url?: string };
  try { body = await req.json(); } catch { return fail("Invalid request body"); }

  const { price_id, success_url, cancel_url } = body;
  if (!price_id || !success_url || !cancel_url) return fail("Missing required fields");

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  // Get or create Stripe customer
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("subscriptions")
      .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
  }

  // Determine if subscription or one-time payment
  const price = await stripe.prices.retrieve(price_id);
  const mode = price.type === "recurring" ? "subscription" : "payment";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: mode as "subscription" | "payment",
    line_items: [{ price: price_id, quantity: 1 }],
    success_url,
    cancel_url,
    metadata: { user_id: user.id },
    allow_promotion_codes: true,
  });

  return ok({ url: session.url });
});
