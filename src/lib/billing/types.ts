import { PLAN_PRICING } from "@/config/pricing";

/** Provider-agnostic billing contracts. The app only talks to these types. */

export type PlanInterval = "monthly" | "annual";
export type PlanKey = "free" | "starter" | "pro" | "advanced";

export interface SubscriptionSnapshot {
  subscribed: boolean;
  tier: string | null;
  status: string | null;
  billingInterval: PlanInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutRequest {
  plan: PlanKey;
  interval: PlanInterval;
}

export interface PackCheckoutRequest {
  pack: string;
}

/**
 * Result of a checkout action.
 * - Hosted providers (Stripe) return a `url` the app opens in a new tab.
 * - In-page providers (RevenueCat Web Billing) complete inline and return
 *   `completed: true` with no URL.
 */
export interface CheckoutResult {
  url?: string;
  completed?: boolean;
  /**
   * For in-place plan changes: whether the new plan is live now (upgrade,
   * pro-rated immediately) or starts at the next renewal (downgrade).
   */
  effect?: "immediate" | "next_billing_period";
}

/**
 * Every billing action in the app routes through this interface.
 * Swapping StripeBillingProvider for RevenueCatBillingProvider requires no
 * changes outside `src/lib/billing`.
 */
export interface BillingProvider {
  readonly id: "paddle" | "revenuecat";
  /** Start a subscription checkout. */
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Start a one-off credit pack checkout. */
  createPackCheckout(req: PackCheckoutRequest): Promise<CheckoutResult>;
  /** Open the self-serve management surface (upgrade/downgrade/cancel/resume/card). */
  openCustomerPortal(): Promise<CheckoutResult>;
  /** Re-sync entitlements from the provider into the database. */
  syncSubscription(): Promise<void>;
}

export const PLAN_CATALOG: Record<
  Exclude<PlanKey, "free">,
  { label: string; monthly: number; annual: number }
> = {
  starter: { label: PLAN_PRICING.starter.name, monthly: PLAN_PRICING.starter.monthly, annual: PLAN_PRICING.starter.annual },
  pro: { label: PLAN_PRICING.pro.name, monthly: PLAN_PRICING.pro.monthly, annual: PLAN_PRICING.pro.annual },
  advanced: { label: PLAN_PRICING.advanced.name, monthly: PLAN_PRICING.advanced.monthly, annual: PLAN_PRICING.advanced.annual },
};

/** Entitlement identifier shared by both providers. */
export const PRO_ENTITLEMENT = "Gradr OS Pro";
