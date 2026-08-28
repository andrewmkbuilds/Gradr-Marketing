/**
 * Runtime log for every hostname-aware redirect this bundle performs.
 *
 * The marketing bundle bounces visitors to other hosts in several places
 * (OAuth callbacks, product paths, the Earn portal, www → apex). When someone
 * reports "I was signed in and landed on the wrong site", we need to be able to
 * see which hop fired, from where, and why — so all of them funnel through here
 * instead of calling `window.location.replace` directly.
 *
 * Output is intentionally boring: a single console line (visible in production
 * telemetry capture), a Sentry breadcrumb, and a PostHog event. Never log query
 * strings — an OAuth `code`/`state` must not end up in an analytics payload.
 */
import { addBreadcrumb } from "@/lib/telemetry/sentry";
import { track } from "@/lib/telemetry/events";

export type SurfaceRedirectReason =
  | "oauth_callback"
  | "auth_handoff"
  | "product_path"
  | "authenticated_root"
  | "earn_portal"
  | "satellite_surface"
  | "legacy_affiliate"
  | "www_apex";

export interface SurfaceRedirectLog {
  /** Why this hop fired. */
  reason: SurfaceRedirectReason;
  /** Path on the current host (no query — it may carry auth secrets). */
  from: string;
  /** Destination origin, e.g. https://app.gradr.me. */
  toOrigin: string;
  /** Destination path (no query). */
  toPath: string;
  /** True when a signed-in session was present on this host. */
  authenticated?: boolean;
}

/** Origin + path only: strips query and hash so no token can be logged. */
export function safeTarget(url: string): { origin: string; path: string } {
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "https://gradr.me" : window.location.href);
    return { origin: parsed.origin, path: parsed.pathname };
  } catch {
    return { origin: "unknown", path: "unknown" };
  }
}

/** Record a hostname-aware redirect. Safe to call before React mounts. */
export function logSurfaceRedirect(entry: SurfaceRedirectLog): void {
  const host = typeof window === "undefined" ? "unknown" : window.location.hostname;
  const payload = {
    reason: entry.reason,
    host,
    from: entry.from,
    to_origin: entry.toOrigin,
    to_path: entry.toPath,
    authenticated: entry.authenticated ?? false,
  };

  // Plain console line so production log capture and the CI console gate can
  // both see the hop without needing analytics consent.
  console.info("[surface-redirect]", JSON.stringify(payload));

  try {
    addBreadcrumb("navigation", "surface_redirect", payload);
    track("surface_redirect", payload);
  } catch {
    /* telemetry is best-effort; the redirect must still happen */
  }
}

/** Log the hop, then hand the browser over. */
export function redirectToSurface(url: string, entry: Omit<SurfaceRedirectLog, "toOrigin" | "toPath">): void {
  const { origin, path } = safeTarget(url);
  logSurfaceRedirect({ ...entry, toOrigin: origin, toPath: path });
  window.location.replace(url);
}
