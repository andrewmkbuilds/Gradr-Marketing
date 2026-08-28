/**
 * Pre-hydration OAuth callback guard.
 *
 * A provider (or a stale redirect URI) can land an authorization response on a
 * marketing host. If the Supabase client boots first it will happily exchange
 * the code and establish a session on gradr.me — exactly what must never
 * happen. This module runs *before* any Supabase import in `main.tsx`, so the
 * browser leaves for https://app.gradr.me/auth with the full query and hash
 * intact before a session can be created here.
 *
 * The rule is deliberately blunt: on a non-product production host, anything
 * that looks like an auth response (callback path, `?code=`/`?state=`, an
 * implicit-flow `#access_token=`, or an OAuth `?error=`) is handed over.
 */
import { PRODUCTION_ORIGIN, isProduction, isProductHost } from "@/config/domains";
import { logSurfaceRedirect } from "@/lib/routing/surfaceRedirectLog";

/** Where every auth response is finished. */
export const APP_AUTH_URL = `${PRODUCTION_ORIGIN.app}/auth`;

const CALLBACK_PATHS = new Set([
  "/~oauth/callback",
  "/oauth/callback",
  "/auth/callback",
  "/auth/v1/callback",
]);

const CALLBACK_QUERY_KEYS = ["code", "state", "token_hash", "error", "error_description"];
const CALLBACK_HASH_KEYS = ["access_token", "refresh_token", "provider_token", "error"];

/** True when this URL carries an OAuth / magic-link response. */
export function isOAuthCallbackUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (CALLBACK_PATHS.has(parsed.pathname.replace(/\/$/, "") || "/")) return true;
  if (CALLBACK_QUERY_KEYS.some((key) => parsed.searchParams.has(key))) return true;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return CALLBACK_HASH_KEYS.some((key) => hash.has(key));
}

/**
 * Destination for a callback that landed here: always the product's `/auth`
 * route, with the original query and hash preserved verbatim so the app can
 * complete the exchange.
 */
export function callbackHandoffUrl(url: string): string {
  const parsed = new URL(url);
  return `${APP_AUTH_URL}${parsed.search}${parsed.hash}`;
}

/**
 * Redirect an auth response off this host. Returns true when a hand-off was
 * issued (the caller should stop doing anything else).
 */
export function enforceOAuthCallbackHandoff(
  location: { href: string; hostname: string } = window.location,
  replace: (url: string) => void = (url) => window.location.replace(url),
): boolean {
  if (!isProduction(location.hostname)) return false;
  if (isProductHost(location.hostname)) return false;
  if (!isOAuthCallbackUrl(location.href)) return false;

  const destination = callbackHandoffUrl(location.href);
  logSurfaceRedirect({
    reason: "oauth_callback",
    from: new URL(location.href).pathname,
    toOrigin: PRODUCTION_ORIGIN.app,
    toPath: "/auth",
  });
  replace(destination);
  return true;
}
