import { describe, expect, it, beforeEach, vi } from "vitest";
import { appHref, appPricingHref, isCrossOrigin } from "@/lib/appLinks";

/**
 * Marketing surfaces must never start checkout: every "Buy"/"Upgrade" CTA has
 * to resolve to the product's pricing route on app.gradr.me.
 */
function setHost(url: string) {
  Object.defineProperty(window, "location", {
    value: new URL(url) as unknown as Location,
    writable: true,
  });
}

describe("app hand-off links", () => {
  beforeEach(() => vi.resetModules());

  it("points marketing CTAs at the app pricing route", () => {
    setHost("https://gradr.me/");
    expect(appPricingHref()).toBe("https://app.gradr.me/pricing");
    expect(appHref("/auth?next=%2Fpricing")).toBe("https://app.gradr.me/auth?next=%2Fpricing");
  });

  it("keeps links relative once inside the product", () => {
    setHost("https://app.gradr.me/dashboard");
    expect(appPricingHref()).toBe("/pricing");
    expect(isCrossOrigin("/pricing")).toBe(false);
  });

  it("treats another surface's origin as a full navigation", () => {
    setHost("https://marketing.gradr.me/pricing");
    const href = appPricingHref();
    expect(href).toBe("https://app.gradr.me/pricing");
    expect(isCrossOrigin(href)).toBe(true);
  });
});
