import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import { billingService, type PlanInterval, type PlanKey } from "@/lib/billing";
import { getPaddleEnvironment } from "@/lib/paddle";
import { track } from "@/lib/telemetry/events";

export interface SubscriptionState {
  subscribed: boolean;
  tier: string | null;
  status: string | null;
  billingInterval: "monthly" | "annual" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const EMPTY: SubscriptionState = {
  subscribed: false,
  tier: null,
  status: null,
  billingInterval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/** Test and live rows share one table — every read must be scoped. */
const paymentEnv = () => getPaddleEnvironment();

export function useSubscription() {
  const { user } = useAuth();
  const env = paymentEnv();

  const query = useQuery({
    queryKey: ["subscription", user?.id, env],
    enabled: Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<SubscriptionState> => {
      const { data, error } = await supabase
        .from("subscribers")
        .select(
          "subscribed, subscription_tier, subscription_status, billing_interval, current_period_end, cancel_at_period_end",
        )
        .eq("user_id", user!.id)
        .eq("environment", env)
        .maybeSingle();
      if (error) throw error;
      if (!data) return EMPTY;
      return {
        subscribed: data.subscribed,
        tier: data.subscription_tier,
        status: data.subscription_status,
        billingInterval: (data.billing_interval as "monthly" | "annual" | null) ?? null,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      };
    },
  });

  const state = query.data ?? EMPTY;
  const tier = (state.tier ?? "free").toLowerCase();

  // A canceled plan keeps working until the paid period actually runs out.
  const periodLive = !state.currentPeriodEnd || new Date(state.currentPeriodEnd) > new Date();
  const active = Boolean(state.subscribed) ||
    (state.status === "canceled" && periodLive && tier !== "free");

  const plan: PlanKey = !active
    ? "free"
    : tier === "starter" || tier === "pro" || tier === "advanced"
      ? (tier as PlanKey)
      : "free";

  return {
    ...state,
    plan,
    isLoading: query.isLoading,
    /** Paying subscriber on any tier. */
    isSubscribed: active,
    isStarter: plan === "starter",
    isPro: plan === "pro" || plan === "advanced",
    isAdvanced: plan === "advanced",
    /** True when the plan is at least as high as `min` in the free < starter < pro order. */
    hasTier: (min: PlanKey) => TIER_RANK[plan] >= TIER_RANK[min],
    refetch: query.refetch,
  };
}

export const TIER_RANK: Record<PlanKey, number> = { free: 0, starter: 1, pro: 2, advanced: 3 };

export interface FeatureAllowance {
  /** null means unlimited. */
  allowance: number | null;
  used: number;
  remaining: number | null;
}

export interface EntitlementSnapshot {
  tier: PlanKey;
  features: Record<"resume" | "application" | "interview", FeatureAllowance>;
}

const EMPTY_FEATURE: FeatureAllowance = { allowance: 0, used: 0, remaining: 0 };

/**
 * Authoritative monthly usage as the server sees it: plan tier, allowance per
 * feature, and how much is left this billing month.
 */
export function useEntitlements() {
  const { user } = useAuth();
  const env = paymentEnv();

  return useQuery({
    queryKey: ["entitlements", user?.id, env],
    enabled: Boolean(user),
    staleTime: 15_000,
    queryFn: async (): Promise<EntitlementSnapshot> => {
      const { data, error } = await supabase.rpc("entitlement_snapshot", { _env: env });
      if (error) throw error;
      const raw = (data ?? {}) as {
        tier?: string;
        features?: Record<string, FeatureAllowance>;
      };
      return {
        tier: (raw.tier as PlanKey) ?? "free",
        features: {
          resume: raw.features?.resume ?? EMPTY_FEATURE,
          application: raw.features?.application ?? EMPTY_FEATURE,
          interview: raw.features?.interview ?? EMPTY_FEATURE,
        },
      };
    },
  });
}

export function useCredits() {
  const { user } = useAuth();
  const env = paymentEnv();

  return useQuery({
    queryKey: ["usage-credits", user?.id, env],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_credits")
        .select("application_credits, interview_credits")
        .eq("user_id", user!.id)
        .eq("environment", env)
        .maybeSingle();
      if (error) throw error;
      return data ?? { application_credits: 0, interview_credits: 0 };
    },
  });
}

/**
 * Keeps balances honest without a refresh: the webhook writes credits and
 * entitlements server-side, so the browser has no other way to learn that a
 * purchase settled.
 */
export function useBillingRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["usage-credits"] });
      void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    };
    const filter = `user_id=eq.${user.id}`;
    const channel = supabase
      .channel(`billing-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "usage_credits", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscribers", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_usage", filter }, invalidate)
      .subscribe();

    // Usage is also consumed in-app (not only by webhooks), so poll gently
    // as a safety net when realtime replication is unavailable.
    const timer = window.setInterval(invalidate, 60_000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}

export function usePurchases() {
  const { user } = useAuth();
  const env = paymentEnv();

  return useQuery({
    queryKey: ["purchases", user?.id, env],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, pack_label, pack_key, credits_granted, amount_total, currency, status, created_at")
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBillingActions() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /** Used by in-page providers (RevenueCat) once a purchase settles. */
  const refreshEntitlements = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["subscription"] });
    await queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    await queryClient.invalidateQueries({ queryKey: ["usage-credits"] });
    await queryClient.invalidateQueries({ queryKey: ["purchases"] });
    toast.success("Purchase complete. Your plan is active.");
  }, [queryClient]);

  /**
   * Checkout outage handling: a dead upgrade button is the worst possible
   * failure, so we always leave the user with a retry and a human to talk to.
   */
  const checkoutFailed = useCallback((retry: () => void) => {
    toast.error("Checkout is temporarily unavailable", {
      description: "The payment provider didn't respond. Retry, or email support@gradr.me and we'll set it up manually.",
      duration: 12000,
      action: { label: "Retry", onClick: retry },
    });
  }, []);

  const startSubscription = useCallback(
    async (interval: PlanInterval, plan: PlanKey = "pro") => {
      setPending(`${plan}-${interval}`);
      // Intent to pay. The paid conversion itself is only ever recorded from
      // the provider webhook — a click is not a payment.
      track("checkout_started", { plan, billing_period: interval, product_type: "subscription" });
      try {
        const { url, completed, effect } = await billingService.createCheckout({ plan, interval });
        if (url) openExternal(url);
        else if (completed && effect === "next_billing_period") {
          // Downgrade: paid-for time is honoured, so nothing changes today.
          await queryClient.invalidateQueries({ queryKey: ["subscription"] });
          toast.success("Plan change scheduled", {
            description: "You keep your current plan until the end of this billing period.",
          });
        } else if (completed) await refreshEntitlements();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.toLowerCase().includes("sign in")) toast.error(message);
        else checkoutFailed(() => void startSubscription(interval, plan));
      } finally {
        setPending(null);
      }
    },
    [refreshEntitlements, checkoutFailed, queryClient],
  );

  const buyPack = useCallback(async (pack: string) => {
    setPending(pack);
    track("checkout_started", { plan: "credit_pack", feature: pack, product_type: "pack" });
    try {
      const { url, completed } = await billingService.createPackCheckout({ pack });
      if (url) openExternal(url);
      else if (completed) await refreshEntitlements();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("sign in")) toast.error(message);
      else checkoutFailed(() => void buyPack(pack));
    } finally {
      setPending(null);
    }
  }, [refreshEntitlements, checkoutFailed]);


  const openPortal = useCallback(async () => {
    setPending("portal");
    try {
      const { url } = await billingService.openCustomerPortal();
      if (url) openExternal(url);
      else toast.info("Manage your plan from the Billing page.");
    } catch {
      toast.error("No subscription to manage yet. Start a plan first, then try again.");
    } finally {
      setPending(null);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    setPending("restore");
    try {
      await billingService.syncSubscription();
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      await queryClient.invalidateQueries({ queryKey: ["usage-credits"] });
      await queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Subscription status refreshed.");
    } catch {
      toast.error("Couldn't refresh your subscription right now.");
    } finally {
      setPending(null);
    }
  }, [queryClient]);

  return { pending, startSubscription, buyPack, openPortal, restorePurchases };
}

/** True when the provider reports a failed/overdue invoice needing user action. */
export function usePaymentIssue() {
  const { status, isLoading } = useSubscription();
  const failing = status === "past_due" || status === "unpaid" || status === "incomplete";
  return { hasPaymentIssue: !isLoading && failing, status };
}
