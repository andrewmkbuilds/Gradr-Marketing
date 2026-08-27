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
  isProduction,
  pinnedSurface,
  surfaceFromHost,
} from "@/config/domains";

/** Pricing route inside the product — the only place checkout may start. */
export const APP_PRICING_PATH = "/pricing";

/**
 * True only for a bundle that genuinely serves the product.
 *
 * `currentSurface()` falls back to "app" for unprefixed paths on dev/preview
 * hosts, which would keep product links on this (marketing) bundle where no
 * product route exists. Only a pinned app bundle, or one served from
 * app.gradr.me in production, may keep such links relative.
 */
function isAppBundle(): boolean {
  return pinnedSurface() === "app" || (isProduction() && surfaceFromHost() === "app");
}

/**
 * Href for a product path from wherever this code is running.
 * Returns a relative path only when this really is the app bundle (so React
 * Router can handle it), and an absolute app URL from every marketing surface.
 */
export function appHref(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isAppBundle()) return normalized;
  return `${PRODUCTION_ORIGIN.app}${normalized}`;
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

/**
 * Absolute destination inside the product for auth / "open the app" CTAs.
 *
 * Unlike {@link appHref}, this never resolves to a path on the current
 * marketing origin: the marketing bundle has no `/auth` or product routes, so a
 * same-origin path would land on the 404 handoff (notably in dev + preview).
 */
export function appAuthHref(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // `currentSurface()` falls back to "app" for unprefixed paths on dev/preview
  // hosts, which would keep the link on this (marketing) bundle. Only a bundle
  // that is genuinely the app — pinned, or served from app.gradr.me — may keep
  // the link relative.
  if (isAppBundle()) return normalized;
  return `${PRODUCTION_ORIGIN.app}${normalized}`;
}

/**
 * Auth routes as the app project actually serves them.
 *
 * The product router mounts `/auth` (with `?mode=signup` for account
 * creation) — there are no `/login` or `/signup` routes on app.gradr.me, so
 * pointing marketing CTAs at those paths would land visitors on the app's 404.
 * Keeping the paths here means one place to change if the app renames them.
 */
export const APP_LOGIN_PATH = "/auth";
export const APP_SIGNUP_PATH = "/auth?mode=signup";

/** Absolute app URL for "Log in" / "Sign in" CTAs on any marketing surface. */
export function appLoginHref(next?: string): string {
  const query = next ? `&next=${encodeURIComponent(next)}` : "";
  return appAuthHref(query ? `${APP_LOGIN_PATH}?${query.slice(1)}` : APP_LOGIN_PATH);
}

/** Absolute app URL for "Get started" / "Sign up" CTAs. */
export function appSignupHref(next?: string): string {
  const query = next ? `&next=${encodeURIComponent(next)}` : "";
  return appAuthHref(`${APP_SIGNUP_PATH}${query}`);
}

/**
 * Absolute destination for a *product* route (`/resume`, `/interview`, …)
 * linked from an editorial page. Marketing bundles have no such routes, so a
 * relative link would fall through to the 404/redirect handler instead of
 * landing on the product directly.
 */
export function appProductHref(path: string): string {
  return appAuthHref(path);
}

/** Canonical entry point into the authenticated product. */
export const APP_DASHBOARD_PATH = "/dashboard";

/** Absolute URL of the product dashboard (or a deep link inside the product). */
export function appDashboardHref(path: string = APP_DASHBOARD_PATH): string {
  return `${PRODUCTION_ORIGIN.app}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Absolute URL inside the Earn portal. Earn lives on its own hostname, so this
 * never resolves to the marketing origin.
 */
export function earnHref(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (pinnedSurface() === "earn") return normalized;
  return `${PRODUCTION_ORIGIN.earn}${normalized}`;
}

const PRODUCT_ROUTES = [
  "/resume",
  "/resumes",
  "/match",
  "/apply",
  "/applications",
  "/interview",
  "/interviews",
  "/jobs",
  "/pipeline",
  "/growth",
  "/dashboard",
  "/billing",
  "/credits",
  "/settings",
  "/profile",
  "/account",
  "/admin",
  "/onboarding",
  "/welcome",
];

/** True when a path is served by the product, not by this marketing bundle. */
export function isProductPath(path: string): boolean {
  const clean = path.split("?")[0];
  return PRODUCT_ROUTES.some((route) => clean === route || clean.startsWith(`${route}/`));
}

