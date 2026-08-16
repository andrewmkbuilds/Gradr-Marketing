import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

/** Code of the win-back discount kept in the payments catalog (both envs). */
const RETENTION_CODE = "GRADRSTAY30";

/**
 * Win-back: applies the retention discount to an existing subscription instead
 * of letting the customer walk. The percentage lives in the payments provider,
 * never in the browser — the client can only ask for "the retention offer".
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: sub } = await admin
      .from("subscribers")
      .select("stripe_subscription_id, subscribed")
      .eq("user_id", user.id)
      .eq("environment", env)
      .maybeSingle();

    const subscriptionId = sub?.stripe_subscription_id as string | undefined;
    if (!subscriptionId || !sub?.subscribed) return json({ error: "no_subscription" }, 404);

    // One retention offer per customer — a second request is refused so the
    // discount cannot be farmed by repeatedly opening the cancel dialog.
    const { data: prior } = await admin
      .from("discount_redemptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("eligibility_type", "retention")
      .limit(1)
      .maybeSingle();
    if (prior) return json({ error: "already_redeemed" }, 409);

    const found = await gatewayFetch(env, `/discounts?code=${encodeURIComponent(RETENTION_CODE)}`);
    const discountId = (await found.json())?.data?.[0]?.id;
    if (!discountId) return json({ error: "offer_unavailable" }, 404);

    const res = await gatewayFetch(env, `/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        discount: { id: discountId, effective_from: "next_billing_period" },
        proration_billing_mode: "do_not_bill",
      }),
    });
    if (!res.ok) {
      console.error("retention offer failed", res.status, await res.text());
      return json({ error: "Unable to apply the offer right now." }, 502);
    }

    await admin.from("discount_redemptions").insert({
      user_id: user.id,
      eligibility_type: "retention",
      percentage: 30,
      environment: env,
      subscription_id: subscriptionId,
    });

    return json({ ok: true, percentage: 30, months: 3 });
  } catch (err) {
    console.error("payments-retention-offer error", err);
    return json({ error: "Unable to apply the offer right now." }, 500);
  }
});
