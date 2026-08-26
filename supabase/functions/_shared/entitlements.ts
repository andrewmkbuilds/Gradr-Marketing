/**
 * Server-side entitlement enforcement.
 *
 * The client copy in `src/lib/interview/entitlements.ts` is
 * presentation only. This module is the actual gate: it resolves the caller's
 * plan, spends their monthly allowance first, then falls back to purchased
 * credits, all inside one atomic database function.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

export type Feature = "resume" | "application" | "interview";
export type PaymentEnv = "sandbox" | "live";

export interface EntitlementResult {
  allowed: boolean;
  /** 'plan' when covered by the monthly allowance, 'credits' when a pack was spent. */
  source?: "plan" | "credits";
  reason?: "quota_exceeded" | "no_credits";
  tier: string;
  allowance: number | null;
  used: number;
  remaining?: number | null;
  credits?: number;
}

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
  }
  return _admin;
}

/**
 * Which payment environment the caller belongs to. Sent by the client and
 * derived there from the Paddle token prefix; defaults to sandbox so a missing
 * value can never unlock live entitlements it hasn't paid for.
 */
export function resolveEnv(value: unknown): PaymentEnv {
  return value === "live" ? "live" : "sandbox";
}

/** Read-only plan lookup — no usage recorded. */
export async function planTier(userId: string, env: PaymentEnv): Promise<string> {
  const { data, error } = await admin().rpc("current_plan_tier", {
    _user_id: userId,
    _env: env,
  });
  if (error) {
    console.error("planTier error", error);
    return "free";
  }
  return (data as string) ?? "free";
}

/**
 * Spend one unit of a feature. Returns `allowed: false` when the caller is out
 * of both plan allowance and credits — callers must return 402 in that case.
 */
export async function consume(
  userId: string,
  feature: Feature,
  env: PaymentEnv,
  amount = 1,
): Promise<EntitlementResult> {
  const { data, error } = await admin().rpc("consume_entitlement", {
    _user_id: userId,
    _feature: feature,
    _env: env,
    _amount: amount,
  });

  if (error) {
    console.error("consume_entitlement error", error);
    // Fail closed: never hand out AI work when metering is broken.
    return { allowed: false, reason: "quota_exceeded", tier: "free", allowance: 0, used: 0 };
  }
  return data as unknown as EntitlementResult;
}

/** Refund a unit when the downstream AI call failed after metering. */
export async function refund(userId: string, feature: Feature, env: PaymentEnv) {
  const { error } = await admin().rpc("refund_entitlement", {
    _user_id: userId,
    _feature: feature,
    _env: env,
  });
  if (error) console.error("refund_entitlement error", error);
}

/** Standard 402 body so every function speaks the same language to the UI. */
export function paymentRequired(result: EntitlementResult, corsHeaders: Record<string, string>) {
  const message = result.reason === "no_credits"
    ? "You're out of credits for this feature. Buy a credit pack or upgrade your plan."
    : "You've used your monthly allowance for this feature. Upgrade your plan to keep going.";

  return new Response(
    JSON.stringify({
      error: "entitlement_required",
      reason: result.reason ?? "quota_exceeded",
      message,
      entitlement: result,
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
