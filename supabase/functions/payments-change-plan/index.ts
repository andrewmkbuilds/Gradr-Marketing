import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { gatewayFetch, PLAN_PRICES, type PaddleEnv } from "../_shared/paddle.ts";

/**
 * Immediate, pro-rated plan changes for existing subscribers.
 *
 * Opening a second checkout for someone who already pays would create a
 * duplicate subscription, so every upgrade/downgrade from inside the app
 * patches the live Paddle subscription instead. Upgrades bill the pro-rated
 * difference right away; downgrades take effect at the next renewal so the
 * customer keeps what they already paid for.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await anon.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const env: PaddleEnv = body?.environment === "live" ? "live" : "sandbox";
    const priceId = typeof body?.priceId === "string" ? body.priceId : "";
    const target = PLAN_PRICES[priceId];
    if (!target) return json({ error: "Unknown plan price" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: sub } = await admin
      .from("subscribers")
      .select("stripe_subscription_id, subscription_tier, price_id, subscribed")
      .eq("user_id", user.id)
      .eq("environment", env)
      .maybeSingle();

    const subscriptionId = sub?.stripe_subscription_id as string | undefined;
    if (!subscriptionId || !sub?.subscribed) {
      // No live subscription — the caller should run a normal checkout.
      return json({ error: "no_subscription" }, 404);
    }
    if (sub.price_id === priceId) return json({ error: "already_on_plan" }, 409);

    // Resolve the human-readable price id to the Paddle id for this env.
    const lookup = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const paddlePriceId = (await lookup.json())?.data?.[0]?.id;
    if (!paddlePriceId) return json({ error: "Price not found" }, 404);

    const RANK: Record<string, number> = { starter: 1, pro: 2, advanced: 3 };
    const isUpgrade = RANK[target.tier] > RANK[String(sub.subscription_tier ?? "free")] ||
      (target.tier === sub.subscription_tier && target.interval === "annual");

    const res = await gatewayFetch(env, `/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        items: [{ price_id: paddlePriceId, quantity: 1 }],
        // Upgrades unlock now and charge the pro-rated difference immediately.
        // Downgrades wait for renewal so paid-for time is never lost.
        proration_billing_mode: isUpgrade
          ? "prorated_immediately"
          : "do_not_bill",
        ...(isUpgrade ? {} : { effective_from: "next_billing_period" }),
      }),
    });

    if (!res.ok) {
      console.error("payments-change-plan failed", res.status, await res.text());
      return json({ error: "Unable to change plan. Please try again." }, 502);
    }

    // The subscription.updated webhook is the source of truth for the DB.
    return json({
      ok: true,
      effect: isUpgrade ? "immediate" : "next_billing_period",
      tier: target.tier,
      interval: target.interval,
    });
  } catch (err) {
    console.error("payments-change-plan error", err);
    return json({ error: "Unable to change plan. Please try again." }, 500);
  }
});
