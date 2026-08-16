import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CREDIT_PACKS,
  EventName,
  PLAN_PRICES,
  verifyWebhook,
  type PaddleEnv,
} from "../_shared/paddle.ts";
import { logSecurityEvent } from "../_shared/securityAudit.ts";
import { capture as phCapture, setPerson as phSetPerson } from "../_shared/posthog.ts";
import { formatDate, formatMoney, sendTransactionalEmail } from "../_shared/sendTransactional.ts";
import { getWriteLog, noteWrite, runWithWriteLog, tracked } from "../_shared/writeLog.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
  }
  return _supabase;
}

async function emailFor(userId: string, env: PaddleEnv): Promise<string> {
  const { data: row } = await db()
    .from("subscribers")
    .select("email")
    .eq("user_id", userId)
    .eq("environment", env)
    .maybeSingle();
  if (row?.email) return row.email as string;
  const { data } = await db().auth.admin.getUserById(userId);
  return data?.user?.email ?? "unknown@gradr.local";
}

/** Billing emails are best-effort; a delivery problem never fails a webhook. */
// deno-lint-ignore no-explicit-any
async function billingEmail(
  template: string,
  recipient: string | null | undefined,
  idempotencyKey: string,
  templateData: Record<string, unknown>,
) {
  if (!recipient || recipient === "unknown@gradr.local") {
    noteWrite({ op: "email.skipped", table: "transactional_email", ok: false, detail: { template }, error: "no recipient email" });
    return;
  }
  const sent = await sendTransactionalEmail({
    templateName: template,
    recipientEmail: recipient,
    idempotencyKey,
    templateData,
  });
  noteWrite({ op: "email.sent", table: "transactional_email", ok: sent, detail: { template, idempotencyKey } });
}

function planLabel(tier?: string | null, interval?: string | null): string {
  const name = tier ? `Gradr ${tier.charAt(0).toUpperCase()}${tier.slice(1)}` : "Gradr Pro";
  return interval ? `${name} (${interval})` : name;
}


/** ---- Paddle state mirror (customers + subscriptions) --------------------- */

async function existingEmail(customerId: string): Promise<string | null> {
  const { data } = await db()
    .from("paddle_customers")
    .select("email")
    .eq("customer_id", customerId)
    .maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

// deno-lint-ignore no-explicit-any
async function mirrorCustomer(data: any, env: PaddleEnv, userId?: string | null) {
  if (!data?.id) return;
  const patch: Record<string, unknown> = {
    customer_id: data.id,
    environment: env,
    updated_at: new Date().toISOString(),
  };
  // Never overwrite a known email with a placeholder.
  if (data.email) patch.email = data.email;
  else patch.email = (await existingEmail(data.id)) ?? "unknown@gradr.local";
  if (userId) patch.user_id = userId;
  // Idempotent: keyed on the Paddle customer id, safe for out-of-order retries.
  await db().from("paddle_customers").upsert(patch, { onConflict: "customer_id" });
}

// deno-lint-ignore no-explicit-any
async function mirrorSubscription(data: any, env: PaddleEnv) {
  if (!data?.id) return;
  const item = data.items?.[0];
  const userId = data?.customData?.userId ?? null;

  if (data.customerId) {
    await mirrorCustomer(
      { id: data.customerId, email: userId ? await emailFor(userId, env) : undefined },
      env,
      userId,
    );
  }

  const patch: Record<string, unknown> = {
    subscription_id: data.id,
    customer_id: data.customerId ?? "unknown",
    status: data.status ?? "active",
    price_id: item?.price?.importMeta?.externalId ?? item?.price?.id ?? "unknown",
    product_id: item?.product?.importMeta?.externalId ?? item?.price?.productId ?? "unknown",
    scheduled_change_action: data.scheduledChange?.action ?? null,
    scheduled_change_at: data.scheduledChange?.effectiveAt ?? null,
    current_period_end: data.currentBillingPeriod?.endsAt ?? null,
    environment: env,
    updated_at: new Date().toISOString(),
  };
  if (userId) patch.user_id = userId;

  await tracked(
    { op: "subscription.mirror", table: "paddle_subscriptions", user_id: userId, detail: { subscription_id: data.id, status: patch.status } },
    () => db().from("paddle_subscriptions").upsert(patch, { onConflict: "subscription_id" }),
  );
}

/**
 * Access is granted while Paddle is still collecting: `past_due` keeps working
 * through dunning, and a cancelled/paused plan keeps working until the paid
 * period actually ends. Revoking early and re-granting is worse than trusting
 * Paddle's retry flow.
 */
function isEntitled(status: string, periodEnd: string | null): boolean {
  if (["active", "trialing", "past_due"].includes(status)) return true;
  if (["canceled", "paused"].includes(status)) {
    return Boolean(periodEnd) && new Date(periodEnd as string) > new Date();
  }
  return false;
}

// deno-lint-ignore no-explicit-any
function planFromItems(data: any) {
  const item = data?.items?.[0];
  const externalPriceId = item?.price?.importMeta?.externalId as string | undefined;
  return { externalPriceId, plan: externalPriceId ? PLAN_PRICES[externalPriceId] : undefined };
}

// deno-lint-ignore no-explicit-any
async function upsertSubscription(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId;
  if (!userId) {
    console.error("payments-webhook: no userId in customData");
    return;
  }

  const { externalPriceId, plan } = planFromItems(data);
  if (!externalPriceId) {
    // Raw pri_… ids differ between sandbox and live, so writing one would
    // silently break tier gating after publish.
    console.warn("payments-webhook: missing importMeta.externalId", {
      rawPriceId: data.items?.[0]?.price?.id,
    });
    return;
  }

  const status: string = data.status ?? "active";
  const periodEnd = data.currentBillingPeriod?.endsAt ?? null;
  const entitled = isEntitled(status, periodEnd);

  await tracked(
    {
      op: "entitlement.upsert",
      table: "subscribers",
      user_id: userId,
      detail: { tier: plan?.tier ?? null, interval: plan?.interval ?? null, status, entitled, price_id: externalPriceId },
    },
    () => db().from("subscribers").upsert(
    {
      user_id: userId,
      email: await emailFor(userId, env),
      environment: env,
      // Provider customer/subscription identifiers (Paddle).
      stripe_customer_id: data.customerId ?? null,
      stripe_subscription_id: data.id ?? null,
      subscribed: entitled,
      // Tier always follows the price that is actually on the subscription,
      // so upgrades and downgrades land on the right plan.
      subscription_tier: entitled ? plan?.tier ?? "pro" : null,
      billing_interval: plan?.interval ?? null,
      subscription_status: status,
      price_id: externalPriceId,
      current_period_end: periodEnd,
      cancel_at_period_end: data.scheduledChange?.action === "cancel",
    },
    { onConflict: "user_id,environment" },
  ),
  );

  if (entitled) {
    // Idempotency is keyed on the subscription id so Paddle retries of the same
    // created event never double-send the welcome-to-Pro mail.
    await billingEmail("subscription-started", await emailFor(userId, env), `sub-started-${data.id}`, {
      planName: planLabel(plan?.tier, plan?.interval),
      interval: plan?.interval ?? undefined,
      nextBillingDate: formatDate(periodEnd),
    });
  }
}

const TIER_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, advanced: 3 };

// deno-lint-ignore no-explicit-any
async function updateSubscription(data: any, env: PaddleEnv) {
  const status: string = data.status ?? "active";
  const periodEnd = data.currentBillingPeriod?.endsAt ?? null;
  const entitled = isEntitled(status, periodEnd);
  const { externalPriceId, plan } = planFromItems(data);

  // Read the pre-change state so a plan switch can be classified as an
  // upgrade or a downgrade and mailed accordingly.
  const { data: before } = await db()
    .from("subscribers")
    .select("user_id, subscription_tier, billing_interval, price_id, subscription_status")
    .eq("stripe_subscription_id", data.id)
    .eq("environment", env)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    subscribed: entitled,
    subscription_status: status,
    current_period_end: periodEnd,
    cancel_at_period_end: data.scheduledChange?.action === "cancel",
    subscription_tier: entitled ? plan?.tier ?? undefined : null,
  };
  if (externalPriceId) {
    // Plan changes arrive as subscription.updated with new items.
    patch.price_id = externalPriceId;
    if (plan?.interval) patch.billing_interval = plan.interval;
  }
  if (patch.subscription_tier === undefined) delete patch.subscription_tier;

  const { data: updated } = await tracked(
    {
      op: "entitlement.update",
      table: "subscribers",
      user_id: (before?.user_id as string | undefined) ?? data?.customData?.userId ?? null,
      detail: { subscription_id: data.id, status, entitled, tier: plan?.tier ?? null },
    },
    () => db()
      .from("subscribers")
      .update(patch)
      .eq("stripe_subscription_id", data.id)
      .eq("environment", env)
      .select("user_id"),
  );

  // Out-of-order delivery: an update can arrive before the created event.
  // Rebuild the row from the event rather than dropping the entitlement.
  if (!updated?.length && data?.customData?.userId) {
    await upsertSubscription(data, env);
    return;
  }

  const userId = (before?.user_id as string | undefined) ?? data?.customData?.userId;
  if (!userId || !plan || !externalPriceId) return;

  // Plan switch: tier or interval actually changed on a still-live plan.
  const priceChanged = Boolean(before?.price_id) && before?.price_id !== externalPriceId;
  if (entitled && priceChanged) {
    const oldTier = String(before?.subscription_tier ?? "free");
    const isUpgrade = (TIER_RANK[plan.tier] ?? 0) > (TIER_RANK[oldTier] ?? 0) ||
      (plan.tier === oldTier && plan.interval === "annual");
    await billingEmail(
      isUpgrade ? "subscription-upgraded" : "subscription-downgraded",
      await emailFor(userId, env),
      `plan-change-${data.id}-${externalPriceId}`,
      {
        previousPlan: planLabel(oldTier, before?.billing_interval as string | null),
        planName: planLabel(plan.tier, plan.interval),
        interval: plan.interval,
        effectiveDate: isUpgrade ? "Immediately" : formatDate(periodEnd),
        nextBillingDate: formatDate(periodEnd),
      },
    );
  }

  // Scheduled cancellation: confirm it and keep the win-back door open.
  const scheduledCancel = data.scheduledChange?.action === "cancel";
  const wasScheduled = Boolean(before?.subscription_status) && before?.subscription_status === "canceled";
  if (scheduledCancel && !wasScheduled) {
    await sendCancellationEmail(userId, env, plan?.tier ?? null, plan?.interval ?? null, periodEnd, data.id);
  }
}

/** Cancellation confirmation + win-back offer, sent once per subscription. */
async function sendCancellationEmail(
  userId: string,
  env: PaddleEnv,
  tier: string | null,
  interval: string | null,
  periodEnd: string | null,
  subscriptionId: string,
) {
  await billingEmail("subscription-cancelled", await emailFor(userId, env), `sub-cancelled-${subscriptionId}`, {
    planName: planLabel(tier, interval),
    cancelledAt: formatDate(new Date().toISOString()),
    accessUntil: formatDate(periodEnd),
  });

  await db().rpc("enqueue_notification", {
    _user_id: userId,
    _type: "billing_subscription_cancelled",
    _title: "Your plan is cancelled",
    _body: periodEnd
      ? "You keep full access until the end of your paid period. Change your mind any time."
      : "You keep access until the end of your paid period. Change your mind any time.",
    _link: "/pricing",
    _metadata: { subscription_id: subscriptionId },
  });
}

/** Dunning: a failed renewal marks the plan past_due and warns the customer. */
// deno-lint-ignore no-explicit-any
async function handlePaymentFailed(data: any, env: PaddleEnv) {
  const subscriptionId = data?.subscriptionId ?? null;
  const userId = data?.customData?.userId ?? null;

  let query = db()
    .from("subscribers")
    .update({ subscription_status: "past_due" })
    .eq("environment", env);
  query = subscriptionId
    ? query.eq("stripe_subscription_id", subscriptionId)
    : userId
      ? query.eq("user_id", userId)
      : query.eq("user_id", "00000000-0000-0000-0000-000000000000");

  const { data: rows } = await query.select("user_id");
  const target = (rows?.[0]?.user_id as string | undefined) ?? userId;
  if (!target) return;

  await db().rpc("enqueue_notification", {
    _user_id: target,
    _type: "billing_payment_failed",
    _title: "Your last payment failed",
    _body: "Update your card to keep your plan active — we'll keep retrying in the meantime.",
    _link: "/billing",
    _metadata: { subscription_id: subscriptionId },
  });

  await billingEmail("payment-failed", await emailFor(target, env), `pay-failed-${data?.id ?? subscriptionId}`, {
    amount: formatMoney(data?.details?.totals?.total, data?.currencyCode ?? "USD"),
    failedAt: formatDate(data?.updatedAt ?? new Date().toISOString()),
    updatePaymentUrl: "https://app.gradr.me/billing",
  });
}

/** A completed payment clears a prior dunning state. */
// deno-lint-ignore no-explicit-any
async function clearPaymentIssue(data: any, env: PaddleEnv) {
  const subscriptionId = data?.subscriptionId ?? null;
  if (!subscriptionId) return;
  await db()
    .from("subscribers")
    .update({ subscribed: true, subscription_status: "active" })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env)
    .eq("subscription_status", "past_due");
}

/**
 * Eligibility discounts: record what was actually redeemed, and re-check that
 * the buyer was entitled to it. A discounted transaction from someone with no
 * verified eligibility is logged as a denied security event so it can be
 * investigated — the sale is never blocked after the fact.
 */
// deno-lint-ignore no-explicit-any
async function recordDiscountUse(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId;
  const discountAmount = Number(data?.details?.totals?.discount ?? 0);
  if (!userId || !data?.id || discountAmount <= 0) return;

  const item = data.items?.[0];
  const externalPriceId = item?.price?.importMeta?.externalId as string | undefined;
  const plan = externalPriceId ? PLAN_PRICES[externalPriceId] : undefined;

  const { data: entitled } = await db().rpc("best_discount_for", {
    _user_id: userId,
    _plan: plan?.tier ?? null,
    _interval: plan?.interval ?? null,
  });
  const resolved = (entitled ?? {}) as { percentage?: number; rule_id?: string; eligibility_type?: string };

  const subtotal = Number(data?.details?.totals?.subtotal ?? 0);
  const grandTotal = Number(data?.details?.totals?.grandTotal ?? data?.details?.totals?.total ?? 0);
  const appliedPercent = subtotal > 0 ? Math.round((discountAmount / subtotal) * 10000) / 100 : 0;

  await db().rpc("record_discount_redemption", {
    _user_id: userId,
    _rule_id: resolved.rule_id ?? null,
    _eligibility_type: resolved.eligibility_type ?? null,
    _percentage: appliedPercent,
    _plan: plan?.tier ?? null,
    _interval: plan?.interval ?? null,
    _env: env,
    _transaction_id: String(data.id),
    _subscription_id: data.subscriptionId ?? null,
    _gross: subtotal / 100,
    _discount: discountAmount / 100,
    _net: grandTotal / 100,
    _currency: (data.currencyCode ?? "usd").toLowerCase(),
  });

  const legitimate = Number(resolved.percentage ?? 0) > 0;
  await logSecurityEvent({
    category: "discount",
    event: "discount_redeemed",
    decision: legitimate ? "allowed" : "denied",
    userId,
    env,
    source: "payments-webhook",
    reason: legitimate ? null : "discount_applied_without_verified_eligibility",
    details: {
      transaction_id: String(data.id),
      applied_percent: appliedPercent,
      entitled_percent: resolved.percentage ?? 0,
      paddle_discount_id: data.discountId ?? null,
    },
  });
}

/**
 * Affiliate attribution. Idempotent by Paddle transaction id: the RPC refuses to
 * create a second commission for the same source record, so webhook retries and
 * duplicate deliveries can never double-pay.
 */
// deno-lint-ignore no-explicit-any
async function recordAffiliateCommission(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId;
  if (!userId || !data?.id) return;

  // Commission basis is configurable: 'net' pays on what the customer actually
  // paid after an eligibility discount, 'gross' pays on the list price.
  const { data: settings } = await db()
    .from("discount_settings")
    .select("affiliate_commission_basis")
    .eq("id", 1)
    .maybeSingle();

  const grandTotal = Number(data?.details?.totals?.grandTotal ?? data?.details?.totals?.total ?? 0);
  const subtotal = Number(data?.details?.totals?.subtotal ?? 0);
  const basisTotal = settings?.affiliate_commission_basis === "gross" && subtotal > 0
    ? subtotal
    : grandTotal;
  // Paddle reports minor units (cents).
  const amount = basisTotal > 0 ? basisTotal / 100 : 0;
  if (amount <= 0) return;

  const { data: commissionId, error } = await db().rpc("record_conversion_commission", {
    _referred_user_id: userId,
    _source_amount: amount,
    _conversion_type: "paid_upgrade",
    _source_record_id: String(data.id),
  });

  if (error) {
    console.error("affiliate commission failed", error.message);
    return;
  }
  if (commissionId) {
    await logSecurityEvent({
      category: "affiliate",
      event: "commission_recorded",
      decision: "allowed",
      userId,
      env,
      source: "payments-webhook",
      details: { commission_id: commissionId, amount, transaction_id: data.id },
    });
  }
}

/** Refunds, chargebacks and cancellations reverse the matching commission. */
// deno-lint-ignore no-explicit-any
async function reverseAffiliateCommission(data: any, env: PaddleEnv, reason: string) {
  const sourceId = data?.transactionId ?? data?.id;
  if (!sourceId) return;
  const { data: count, error } = await db().rpc("reverse_commission_for_source", {
    _source_record_id: String(sourceId),
    _reason: reason,
  });
  if (error) {
    console.error("affiliate reversal failed", error.message);
    return;
  }
  if (Number(count ?? 0) > 0) {
    await logSecurityEvent({
      category: "affiliate",
      event: "commission_reversed",
      decision: "allowed",
      userId: data?.customData?.userId ?? null,
      env,
      source: "payments-webhook",
      details: { reversed: count, reason, source_record_id: String(sourceId) },
    });
  }
}



/** One-off credit packs are granted from completed transactions. */
// deno-lint-ignore no-explicit-any
async function grantPackCredits(data: any, env: PaddleEnv) {
  const userId = data?.customData?.userId;
  if (!userId) return;

  for (const item of data.items ?? []) {
    const priceId = item?.price?.importMeta?.externalId as string | undefined;
    const pack = priceId ? CREDIT_PACKS[priceId] : undefined;
    if (!pack) continue;

    // Idempotency: a transaction id is only ever granted once.
    const { data: existing } = await db()
      .from("purchases")
      .select("id")
      .eq("stripe_session_id", data.id)
      .eq("environment", env)
      .maybeSingle();
    if (existing) continue;

    const quantity = Number(item?.quantity ?? 1) || 1;
    const credits = pack.credits * quantity;

    await tracked(
      { op: "purchase.record", table: "purchases", user_id: userId, detail: { pack: priceId, credits, transaction_id: data.id } },
      () => db().from("purchases").insert({
      user_id: userId,
      stripe_session_id: data.id,
      environment: env,
      pack_key: priceId,
      pack_label: pack.label,
      quantity,
      credits_granted: credits,
      amount_total: Number(data.details?.totals?.total ?? 0),
      currency: (data.currencyCode ?? "usd").toLowerCase(),
      status: "paid",
      }),
    );

    const { data: current } = await db()
      .from("usage_credits")
      .select("application_credits, interview_credits")
      .eq("user_id", userId)
      .eq("environment", env)
      .maybeSingle();

    await tracked(
      { op: "credits.grant", table: "usage_credits", user_id: userId, detail: { kind: pack.kind, credits } },
      () => db().from("usage_credits").upsert(
      {
        user_id: userId,
        environment: env,
        application_credits: Number(current?.application_credits ?? 0) +
          (pack.kind === "application" ? credits : 0),
        interview_credits: Number(current?.interview_credits ?? 0) +
          (pack.kind === "interview" ? credits : 0),
      },
      { onConflict: "user_id,environment" },
      ),
    );

    await billingEmail("payment-successful", await emailFor(userId, env), `pack-paid-${data.id}-${priceId}`, {
      amount: formatMoney(data.details?.totals?.total, (data.currencyCode ?? "USD").toUpperCase()),
      planName: pack.label,
      interval: "one-off",
      paidAt: formatDate(data.billedAt ?? new Date().toISOString()),
      invoiceUrl: "https://app.gradr.me/billing",
    });
  }
}

Deno.serve((req) => runWithWriteLog(() => handleRequest(req)));

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const env = (new URL(req.url).searchParams.get("env") || "sandbox") as PaddleEnv;

  // Delivery ledger id, so a handler failure can be retried/reconciled later.
  let deliveryEventId: string | null = null;

  try {
    const event = await verifyWebhook(req, env);
    // deno-lint-ignore no-explicit-any
    const eventUserId = ((event.data as any)?.customData?.userId ?? null) as string | null;

    // deno-lint-ignore no-explicit-any
    deliveryEventId = ((event as any)?.eventId ?? null) as string | null;
    if (deliveryEventId) {
      await db().from("webhook_deliveries").upsert(
        {
          provider: "paddle",
          event_id: deliveryEventId,
          event_type: String(event.eventType),
          environment: env,
          signature_verified: true,
          state: "processing",
          user_id: eventUserId,
          payload: event.data as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" },
      );
    }



    await logSecurityEvent({
      category: "billing_webhook",
      event: String(event.eventType),
      decision: "received",
      userId: eventUserId,
      env,
      source: "payments-webhook",
      details: {
        // deno-lint-ignore no-explicit-any
        event_id: (event as any)?.eventId ?? null,
        // deno-lint-ignore no-explicit-any
        status: (event.data as any)?.status ?? null,
        // deno-lint-ignore no-explicit-any
        customer_id: (event.data as any)?.customerId ?? (event.data as any)?.id ?? null,
        // deno-lint-ignore no-explicit-any
        subscription_id: (event.data as any)?.subscriptionId ?? null,
      },
    });

    switch (event.eventType) {
      case EventName.SubscriptionCreated: {
        await mirrorSubscription(event.data, env);
        await upsertSubscription(event.data, env);
        // deno-lint-ignore no-explicit-any
        const created = planFromItems(event.data as any);
        const revenueProps = {
          plan: created.plan?.tier ?? "unknown",
          billing_period: created.plan?.interval ?? "unknown",
          environment: env,
          // deno-lint-ignore no-explicit-any
          amount: Number((event.data as any)?.items?.[0]?.price?.unitPrice?.amount ?? 0) / 100,
          // deno-lint-ignore no-explicit-any
          currency: (event.data as any)?.currencyCode ?? null,
        };
        // Ledgered against the Paddle event id so a missing or duplicated
        // conversion event is detectable, not just invisible.
        const analyticsCtx = { providerEventId: deliveryEventId, source: "payments-webhook", environment: env };
        await phCapture("subscription_created", eventUserId, revenueProps, analyticsCtx);
        await phCapture("payment_completed", eventUserId, revenueProps, analyticsCtx);
        await phCapture("upgraded_to_premium", eventUserId, revenueProps, analyticsCtx);
        await phSetPerson(eventUserId, {
          plan: created.plan?.tier ?? "unknown",
          billing_period: created.plan?.interval ?? "unknown",
          is_paying: true,
          subscription_status: "active",
        });
        break;
      }
      case EventName.SubscriptionUpdated:
        // A scheduled cancellation is NOT a cancellation: we mirror the
        // scheduled change but keep the status Paddle reports.
        await mirrorSubscription(event.data, env);
        await updateSubscription(event.data, env);
        break;
      case EventName.SubscriptionCanceled: {
        await mirrorSubscription({ ...event.data, status: "canceled" }, env);
        await updateSubscription({ ...event.data, status: "canceled" }, env);
        // deno-lint-ignore no-explicit-any
        const canceled = planFromItems(event.data as any);
        if (eventUserId) {
          await sendCancellationEmail(
            eventUserId,
            env,
            canceled.plan?.tier ?? null,
            canceled.plan?.interval ?? null,
            // deno-lint-ignore no-explicit-any
            (event.data as any)?.currentBillingPeriod?.endsAt ?? null,
            // deno-lint-ignore no-explicit-any
            String((event.data as any)?.id ?? ""),
          );
        }
        await phCapture("subscription_cancelled", eventUserId, {
          plan: canceled.plan?.tier ?? "unknown",
          billing_period: canceled.plan?.interval ?? "unknown",
          environment: env,
        }, { providerEventId: deliveryEventId, source: "payments-webhook", environment: env });
        await phSetPerson(eventUserId, { is_paying: false, subscription_status: "canceled" });
        break;
      }
      case EventName.CustomerCreated:
      case EventName.CustomerUpdated:
        await mirrorCustomer(event.data, env);
        break;
      case EventName.TransactionCompleted:
        await clearPaymentIssue(event.data, env);
        await grantPackCredits(event.data, env);
        await recordDiscountUse(event.data, env);
        await recordAffiliateCommission(event.data, env);
        await phCapture("payment_completed", eventUserId, {
          environment: env,
          // deno-lint-ignore no-explicit-any
          amount: Number((event.data as any)?.details?.totals?.grandTotal ?? 0) / 100,
          // deno-lint-ignore no-explicit-any
          currency: (event.data as any)?.currencyCode ?? null,
          // deno-lint-ignore no-explicit-any
          product_type: (event.data as any)?.subscriptionId ? "subscription" : "pack",
        }, { providerEventId: deliveryEventId, source: "payments-webhook", environment: env });
        break;
      case EventName.TransactionPaymentFailed:
        await handlePaymentFailed(event.data, env);
        break;
      case EventName.AdjustmentCreated:
        // Refunds / chargebacks arrive as adjustments against a transaction.
        await reverseAffiliateCommission(event.data, env, "refund_adjustment");
        break;


      default:
        console.log("Unhandled event:", event.eventType);
    }
    await logSecurityEvent({
      category: "billing_webhook",
      event: String(event.eventType),
      decision: "processed",
      userId: eventUserId,
      env,
      source: "payments-webhook",
    });

    if (deliveryEventId) {
      const writes = getWriteLog();
      await db().from("webhook_deliveries").update({
        state: writes.some((w) => !w.ok && w.op !== "email.skipped") ? "processed_with_errors" : "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
        user_id: eventUserId,
        write_results: writes,
        updated_at: new Date().toISOString(),
      }).eq("event_id", deliveryEventId);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    const message = e instanceof Error ? e.message : String(e);
    await logSecurityEvent({
      category: "billing_webhook",
      event: "verification_or_handler_error",
      decision: "failed",
      env,
      source: "payments-webhook",
      reason: message,
    });
    if (deliveryEventId) {
      // Left in `failed` for payments-reconcile to repair from the Paddle API.
      const { data: row } = await db()
        .from("webhook_deliveries")
        .select("attempts")
        .eq("event_id", deliveryEventId)
        .maybeSingle();
      await db().from("webhook_deliveries").update({
        state: "failed",
        write_results: getWriteLog(),
        last_error: message.slice(0, 500),
        attempts: Number(row?.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("event_id", deliveryEventId);
    }
    // Non-2xx makes Paddle retry the delivery on its own schedule.
    return new Response("Webhook error", { status: 400 });
  }
}
