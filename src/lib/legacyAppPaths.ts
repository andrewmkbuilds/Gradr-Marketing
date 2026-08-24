/**
 * Legacy marketing URLs that used to serve product pages.
 *
 * Before the marketing site and the product were split into two deployments,
 * paths like `/login`, `/signup` and `/dashboard` resolved on gradr.me. Those
 * URLs still live in bookmarks, old emails and search results, so they must
 * resolve to their real home on app.gradr.me instead of a dead end.
 *
 * Keys are canonical (lowercased, no trailing slash) marketing paths; values
 * are the path to hand over to on the app surface. Anything not listed here is
 * caught by the router's catch-all hand-off, which forwards the path unchanged.
 */
export const LEGACY_APP_REDIRECTS: Record<string, string> = {
  // Credential flows — the product mounts a single `/auth` route.
  "/login": "/auth",
  "/log-in": "/auth",
  "/sign-in": "/auth",
  "/signin": "/auth",
  "/signup": "/auth?mode=signup",
  "/sign-up": "/auth?mode=signup",
  "/register": "/auth?mode=signup",
  "/create-account": "/auth?mode=signup",
  "/logout": "/auth",
  "/sign-out": "/auth",
  // Password / email flows the product owns.
  "/forgot-password": "/auth?mode=reset",
  "/reset-password": "/auth?mode=reset",
  "/update-password": "/auth?mode=reset",
  "/confirm": "/verify-email",
  "/verify": "/verify-email",
  // Authenticated product entry points.
  "/dashboard": "/dashboard",
  "/home": "/dashboard",
  "/app": "/dashboard",
  "/account": "/settings",
  "/profile": "/settings/profile",
  "/preferences": "/settings",
  "/notifications": "/settings/notifications",
  "/security": "/settings/security",
  "/subscription": "/billing",
  "/plan": "/billing",
  "/invoices": "/billing",
  "/upgrade": "/pricing",
  "/checkout": "/pricing",
  // Product modules under their old marketing-side names.
  "/resumes": "/resume",
  "/resume-builder": "/resume",
  "/ats": "/resume",
  "/ats-checker": "/resume",
  "/applications": "/pipeline",
  "/tracker": "/pipeline",
  "/job-tracker": "/pipeline",
  "/mock-interview": "/interview",
  "/interviews": "/interview",
  "/practice": "/interview",
  "/matches": "/match",
  "/job-matches": "/match",
  "/skills": "/growth",
  "/analytics": "/growth",
  "/insights": "/growth",
};

/** Path prefixes that only ever existed on the product surface. */
export const LEGACY_APP_PREFIXES = [
  "/dashboard",
  "/settings",
  "/billing",
  "/credits",
  "/resume",
  "/match",
  "/jobs",
  "/pipeline",
  "/apply",
  "/applications",
  "/interview",
  "/growth",
  "/admin",
  "/welcome",
  "/onboarding",
  "/verify-email",
  "/auth",
  "/portfolio",
  "/networking",
  "/coach",
  "/integrations",
  "/notifications",
];


/** Normalise like `canonicalPath` does, without resolving SEO aliases. */
function normalize(pathname: string): string {
  let path = pathname.toLowerCase();
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/**
 * The app path a legacy marketing URL should land on, or `null` when the path
 * is not a known product URL (the caller then renders the normal 404).
 */
export function legacyAppTarget(pathname: string): string | null {
  const path = normalize(pathname);
  const mapped = LEGACY_APP_REDIRECTS[path];
  if (mapped) return mapped;
  const prefix = LEGACY_APP_PREFIXES.find((p) => path === p || path.startsWith(`${p}/`));
  return prefix ? path : null;
}
