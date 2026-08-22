/**
 * Plan switching during a Paddle outage.
 *
 * The dangerous failure mode is: `payments-change-plan` errors (Paddle down,
 * gateway 500, timeout) and the provider silently falls through to a fresh
 * overlay checkout — creating a SECOND active subscription for someone who is
 * already paying. This test simulates the outage and asserts checkout is never
 * opened, so at most one subscription can exist.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const checkoutOpen = vi.fn();
const rpc = vi.fn(async () => ({ data: { attempts: 1, alerted: false }, error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.com" } } }) },
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    rpc: (...args: unknown[]) => rpc(...(args as [])),
  },
}));

vi.mock("@/lib/paddle", () => ({
  getPaddle: async () => ({ Checkout: { open: checkoutOpen } }),
  getPaddleEnvironment: () => "sandbox",
  getPaddlePriceId: async (id: string) => `pri_${id}`,
}));

vi.mock("@/hooks/useEligibility", () => ({
  resolveCheckoutDiscount: async () => ({ discountId: null }),
}));

const loadProvider = async () =>
  (await import("@/lib/billing/paddleProvider")).paddleBillingProvider;

describe("plan switch during a Paddle outage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not open a second checkout when the change-plan call 500s", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        context: new Response(JSON.stringify({ error: "paddle_unavailable" }), { status: 500 }),
      }),
    });

    const provider = await loadProvider();
    await expect(provider.createCheckout({ plan: "pro", interval: "annual" })).rejects.toThrow();
    expect(checkoutOpen).not.toHaveBeenCalled();
  });

  it("does not open a checkout when the outage surfaces as a network error", async () => {
    invoke.mockRejectedValue(new Error("Failed to fetch"));

    const provider = await loadProvider();
    await expect(provider.createCheckout({ plan: "pro", interval: "monthly" })).rejects.toThrow();
    expect(checkoutOpen).not.toHaveBeenCalled();
  });

  it("switches in place (no checkout) when the change succeeds", async () => {
    invoke.mockResolvedValue({ data: { ok: true, effect: "immediate" }, error: null });

    const provider = await loadProvider();
    const result = await provider.createCheckout({ plan: "advanced", interval: "monthly" });

    expect(result).toEqual({ completed: true, effect: "immediate" });
    expect(checkoutOpen).not.toHaveBeenCalled();
  });

  it("opens exactly one checkout for a genuinely new subscriber", async () => {
    invoke.mockResolvedValue({ data: { error: "no_subscription" }, error: null });

    const provider = await loadProvider();
    await provider.createCheckout({ plan: "pro", interval: "monthly" });

    expect(checkoutOpen).toHaveBeenCalledTimes(1);
  });

  it("records every checkout attempt so duplicates can be alerted on", async () => {
    invoke.mockResolvedValue({ data: { error: "no_subscription" }, error: null });

    const provider = await loadProvider();
    await provider.createCheckout({ plan: "pro", interval: "monthly" });

    expect(rpc).toHaveBeenCalledWith(
      "record_checkout_attempt",
      expect.objectContaining({ _price_id: "pro_monthly" }),
    );
  });
});
