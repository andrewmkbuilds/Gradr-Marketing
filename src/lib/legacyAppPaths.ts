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
  // Authenticated product entry points.
  "/dashboard": "/dashboard",
  "/home": "/dashboard",
  "/app": "/dashboard",
  "/account": "/settings",
  "/profile": "/settings/profile",
  "/subscription": "/billing",
  "/upgrade": "/pricing",
  "/checkout": "/pricing",
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
  "/interview",
  "/growth",
  "/admin",
  "/welcome",
  "/onboarding",
  "/verify-email",
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
