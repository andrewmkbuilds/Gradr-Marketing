/**
 * Links from the public site into the Gradr Partner Program portal.
 *
 * The partner portal is its own product at `partners.gradr.me` (separate repo,
 * separate deployment). This marketing bundle only carries the public pitch
 * page: application, sign-in, referral links, commissions, payouts, analytics
 * and resources all live on the portal, so every partner action here is an
 * absolute cross-origin link.
 *
 * Affiliate commissions are money and belong to the partner portal. Gradr Earn
 * credits are a separate consumer ledger at `earn.gradr.me` — never link one to
 * the other.
 */
import { PRODUCTION_ORIGIN } from "@/config/domains";

/** Routes the partner portal serves. Kept here so renames land in one place. */
export const PARTNER_PATHS = {
  home: "/",
  apply: "/apply",
  login: "/login",
  dashboard: "/dashboard",
  referrals: "/referrals",
  commissions: "/commissions",
  payouts: "/payouts",
  resources: "/resources",
  support: "/support",
} as const;

/** Absolute URL for a path on the partner portal. */
export function partnersHref(path: string = PARTNER_PATHS.home): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PRODUCTION_ORIGIN.partners}${normalized === "/" ? "" : normalized}`;
}

/** Absolute URL for a path on the Gradr Earn consumer rewards portal. */
export function earnHref(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PRODUCTION_ORIGIN.earn}${normalized === "/" ? "" : normalized}`;
}

/**
 * Legacy affiliate-portal paths that used to be served by this bundle, mapped
 * onto the partner portal so old links and bookmarks still land somewhere real.
 */
export function legacyAffiliateDestination(pathname: string): string {
  const rest = pathname.replace(/^\/affiliate/, "").replace(/^\/partners/, "") || "/";
  const map: Record<string, string> = {
    "/": PARTNER_PATHS.home,
    "/join": PARTNER_PATHS.apply,
    "/apply": PARTNER_PATHS.apply,
    "/dashboard": PARTNER_PATHS.dashboard,
    "/resources": PARTNER_PATHS.resources,
    "/login": PARTNER_PATHS.login,
    "/auth": PARTNER_PATHS.login,
    "/signup": PARTNER_PATHS.apply,
    "/forgot-password": PARTNER_PATHS.login,
    "/reset-password": PARTNER_PATHS.login,
  };
  return partnersHref(map[rest.toLowerCase()] ?? PARTNER_PATHS.home);
}
