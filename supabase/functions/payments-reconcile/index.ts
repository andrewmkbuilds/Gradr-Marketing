import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

/**
 * Payments reconciliation.
 *
 * Webhooks are the fast path; Paddle's API is the source of truth. This
 * function pulls live subscription state and repairs any drift caused by a
 * dropped, out-of-order or failed webhook delivery. It also reports the
 * delivery backlog so the admin dashboard can show how healthy the pipe is.
 *
 * Admin-only. Safe to re-run — every write is an idempotent upsert/update.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_TIERS: Record<string, { tier: string; interval: string }> = {
  starter_monthly: { tier: "starter", interval: "monthly" },
  starter_annual: { tier: "starter", interval: "annual" },
  pro_monthly: { tier: "pro", interval: "monthly" },
  pro_annual: { tier: "pro", interval: "annual" },
  advanced_monthly: { tier: "advanced", interval: "monthly" },
  advanced_annual: { tier: "advanced", interval: "annual" },
};

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function isEntitled(status: string, periodEnd: string | null): boolean {
  if (["active", "trialing", "past_due"].includes(status)) return true;
  if (["canceled", "paused"].includes(status)) {
    return Boolean(periodEnd) && new Date(periodEnd as string) > new Date();
  }
  return false;
}

/** Subset of the Paddle subscriptions API response this job reconciles against. */
type PaddleRemoteSubscription = {
  id?: string;
  status?: string;
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  items?: {
    price?: {
      import_meta?: { external_id?: string } | null;
      importMeta?: { externalId?: string } | null;
    } | null;
  }[];
};

function externalPriceId(sub: PaddleRemoteSubscription): string | undefined {
  const item = sub?.items?.[0];
  return item?.price?.import_meta?.external_id ?? item?.price?.importMeta?.externalId ?? undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await asUser.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const env = (body.environment === "live" ? "live" : "sandbox") as PaddleEnv;
    const dryRun = body.dryRun === true;

    // ---- 1. Pull authoritative subscription state from Paddle -------------
    const res = await gatewayFetch(env, "/subscriptions?per_page=200");
    if (!res.ok) {
      return json({ error: `Paddle API error ${res.status}` }, 502);
    }
    const payload = await res.json();
    const remote: PaddleRemoteSubscription[] = payload?.data ?? [];

    const repaired: { subscription_id: string; field: string; from: unknown; to: unknown }[] = [];

    const { data: mirrored } = await db()
      .from("paddle_subscriptions")
      .select("subscription_id, status, current_period_end, user_id, price_id")
      .eq("environment", env);
    const mirrorBySub = new Map((mirrored ?? []).map((m) => [m.subscription_id, m]));

    for (const sub of remote) {
      const status: string = sub.status ?? "active";
      const periodEnd: string | null = sub.current_billing_period?.ends_at ?? null;
      const priceId = externalPriceId(sub) ?? sub.items?.[0]?.price?.id ?? "unknown";
      const userId: string | null = sub.custom_data?.userId ?? mirrorBySub.get(sub.id)?.user_id ?? null;
      const local = mirrorBySub.get(sub.id);

      const drifted =
        !local ||
        local.status !== status ||
        (local.current_period_end ?? null) !== periodEnd ||
        local.price_id !== priceId;

      if (!drifted) continue;
      repaired.push({
        subscription_id: sub.id,
        field: !local ? "missing_mirror" : "status_or_period",
        from: local ? { status: local.status, period_end: local.current_period_end } : null,
        to: { status, period_end: periodEnd },
      });
      if (dryRun) continue;

      await db().from("paddle_subscriptions").upsert(
        {
          subscription_id: sub.id,
          customer_id: sub.customer_id ?? "unknown",
          status,
          price_id: priceId,
          product_id: sub.items?.[0]?.price?.product_id ?? "unknown",
          current_period_end: periodEnd,
          scheduled_change_action: sub.scheduled_change?.action ?? null,
          scheduled_change_at: sub.scheduled_change?.effective_at ?? null,
          environment: env,
          updated_at: new Date().toISOString(),
          ...(userId ? { user_id: userId } : {}),
        },
        { onConflict: "subscription_id" },
      );

      if (userId) {
        const entitled = isEntitled(status, periodEnd);
        const plan = PLAN_TIERS[priceId];
        await db()
          .from("subscribers")
          .update({
            subscribed: entitled,
            subscription_status: status,
            subscription_tier: entitled ? plan?.tier ?? "pro" : null,
            billing_interval: plan?.interval ?? null,
            current_period_end: periodEnd,
            cancel_at_period_end: sub.scheduled_change?.action === "cancel",
            price_id: priceId,
          })
          .eq("user_id", userId)
          .eq("environment", env);
      }
    }

    // ---- 2. Report the webhook delivery backlog ---------------------------
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: deliveries } = await db()
      .from("webhook_deliveries")
      .select("state, event_type, last_error, created_at")
      .eq("provider", "paddle")
      .gte("created_at", since);

    const byState: Record<string, number> = {};
    for (const d of deliveries ?? []) byState[d.state] = (byState[d.state] ?? 0) + 1;

    return json({
      environment: env,
      dryRun,
      remoteSubscriptions: remote.length,
      repaired: repaired.length,
      details: repaired.slice(0, 50),
      deliveries: { window: "7d", byState, failed: byState.failed ?? 0 },
      reconciledAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("payments-reconcile error:", e);
    return json({ error: "Reconciliation failed" }, 500);
  }
});
