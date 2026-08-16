/**
 * Links from public/marketing surfaces into the authenticated product.
 *
 * Checkout, billing and every Paddle call live on the app surface
 * (`app.gradr.me`). Marketing surfaces (`gradr.me`, `marketing.gradr.me`) must
 * never start a purchase themselves — their "Buy" / "Upgrade" CTAs simply hand
 * the visitor to the app's pricing route.
 *
 * `urlFor("app", …)` alone is not enough here: on the marketing deployment it
 * falls back to the current origin unless `VITE_APP_SUBDOMAIN_LIVE` is set,
 * which would point a checkout CTA back at the marketing site (and, for a
 * redirect, loop). In production we therefore always resolve to the canonical
 * app origin.
 */
import {
  PRODUCTION_ORIGIN,
  currentSurface,
  isProduction,
  urlFor,
} from "@/config/domains";

/** Pricing route inside the product — the only place checkout may start. */
export const APP_PRICING_PATH = "/pricing";

/**
 * Href for a product path from wherever this code is running.
 * Returns a relative path when already on the app surface (so React Router can
 * handle it), and an absolute app URL from every marketing surface.
 */
export function appHref(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (currentSurface() === "app") return normalized;
  if (isProduction()) return `${PRODUCTION_ORIGIN.app}${normalized}`;
  return urlFor("app", normalized);
}

/** True when the href leaves the current origin (needs a full navigation). */
export function isCrossOrigin(href: string): boolean {
  if (!href.startsWith("http")) return false;
  if (typeof window === "undefined") return true;
  try {
    return new URL(href).origin !== window.location.origin;
  } catch {
    return true;
  }
}

/** Canonical destination for any pricing / upgrade / buy CTA. */
export function appPricingHref(next?: string): string {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return appHref(`${APP_PRICING_PATH}${query}`);
}

/**
 * Send the visitor to the product. Uses the router when the destination is on
 * this origin, a full navigation when it is another surface.
 */
export function goToApp(href: string, navigate?: (to: string) => void): void {
  if (isCrossOrigin(href)) {
    window.location.assign(href);
    return;
  }
  if (navigate) navigate(href);
  else window.location.assign(href);
}
