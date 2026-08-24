/**
 * Hand-off from a marketing surface into the product's auth flow.
 *
 * Two things this module owns that plain links cannot:
 *
 * 1. **Deep linking.** Marketing CTAs advertise a specific destination
 *    ("Run a mock interview"). The visitor should land there *after* signing
 *    in, so every hand-off carries `?next=<product path>` which the app reads
 *    on the far side.
 * 2. **Observability.** A cross-origin `location.assign` is fire-and-forget:
 *    if `app.gradr.me` is down, DNS-broken or blocked, the visitor simply
 *    stalls on the marketing page and we never hear about it. We emit
 *    `auth_handoff_started` on click and, if the document is still alive a few
 *    seconds later (no `pagehide`/`visibilitychange`), `auth_handoff_failed`.
 */
import { appAuthHref, isCrossOrigin } from "@/lib/appLinks";
import { track } from "@/lib/telemetry/events";

/** How long a real navigation is given before we call the hand-off failed. */
export const HANDOFF_TIMEOUT_MS = 6000;

/** Product paths a marketing CTA may deep-link to after sign-in. */
export type AppDestination = string;

/** Absolute app URL for the sign-in screen, optionally deep-linked. */
export function appSignInHref(next?: AppDestination): string {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return appAuthHref(`/auth${query}`);
}

export type HandoffContext = {
  /** Where the CTA lives, for funnel breakdowns. */
  location: string;
  /** Product path the visitor asked for, if any. */
  next?: AppDestination;
  /** Whether a session already exists on this surface. */
  authenticated?: boolean;
};

/**
 * Navigate to a product URL, tracking whether the hand-off actually left this
 * page. Same-origin destinations use the router (nothing can be unreachable).
 */
export function handoffToApp(
  href: string,
  context: HandoffContext,
  navigate?: (to: string) => void,
): void {
  const crossOrigin = isCrossOrigin(href);
  track("auth_handoff_started", {
    cta_location: context.location,
    destination: href.slice(0, 80),
    next_path: context.next,
    cross_origin: crossOrigin,
    authenticated: Boolean(context.authenticated),
  });

  if (!crossOrigin) {
    if (navigate) navigate(href);
    else window.location.assign(href);
    return;
  }

  let settled = false;
  const settle = () => {
    settled = true;
    window.removeEventListener("pagehide", settle);
    document.removeEventListener("visibilitychange", onVisibility);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") settle();
  };
  window.addEventListener("pagehide", settle, { once: true });
  document.addEventListener("visibilitychange", onVisibility);

  window.setTimeout(() => {
    if (settled) return;
    settle();
    // Still here: the browser never left this document, so the app origin did
    // not answer (offline, DNS, TLS, blocked, or a hosting outage).
    track("auth_handoff_failed", {
      cta_location: context.location,
      destination: href.slice(0, 80),
      next_path: context.next,
      reason: navigator.onLine ? "app_unreachable" : "offline",
    });
  }, HANDOFF_TIMEOUT_MS);

  window.location.assign(href);
}

/** Convenience: send the visitor to sign-in, deep-linked to `next`. */
export function goToAppAuth(
  context: HandoffContext,
  navigate?: (to: string) => void,
): void {
  handoffToApp(appSignInHref(context.next), context, navigate);
}
