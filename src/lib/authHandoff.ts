/**
 * Hand-off from a marketing surface into the product's auth flow.
 *
 * Three things this module owns that plain links cannot:
 *
 * 1. **Deep linking.** Marketing CTAs advertise a specific destination
 *    ("Run a mock interview"). The visitor should land there *after* signing
 *    in, so every hand-off carries `?next=<product path>` which the app reads
 *    on the far side. The value is validated with the same rules the app uses
 *    (`sanitizeNext`) so a crafted CTA can never turn into an open redirect.
 * 2. **Observability.** A cross-origin `location.assign` is fire-and-forget:
 *    if `app.gradr.me` is down, DNS-broken or blocked, the visitor simply
 *    stalls on the marketing page and we never hear about it. We emit
 *    `auth_handoff_started` on click and, if the document is still alive a few
 *    seconds later (no `pagehide`/`visibilitychange`), `auth_handoff_failed`.
 * 3. **Recovery.** That same failure is announced on the window as
 *    `HANDOFF_FAILED_EVENT`, so the UI can offer a Retry instead of leaving the
 *    visitor on a page that appears to have ignored their click.
 */
import { appAuthHref, isCrossOrigin } from "@/lib/appLinks";
import { classifyNext, type NextRejectionReason } from "@/lib/nextRedirect";
import { track } from "@/lib/telemetry/events";

/** How long a real navigation is given before we call the hand-off failed. */
export const HANDOFF_TIMEOUT_MS = 6000;

/** Window event fired when a cross-origin hand-off never left the page. */
export const HANDOFF_FAILED_EVENT = "gradr:auth-handoff-failed";

/** Product paths a marketing CTA may deep-link to after sign-in. */
export type AppDestination = string;

/** Outcome of validating a requested `next` destination. */
export type NextStatus = "none" | "accepted" | "sanitized";

export type NextResolution = {
  /** The validated destination, or null when nothing safe remains. */
  value: string | null;
  status: NextStatus;
  /** What the caller asked for, trimmed for analytics. */
  requested?: string;
  /** Why it was refused — only present when `status` is "sanitized". */
  reason?: NextRejectionReason;
};

/**
 * Validates a requested deep link. Anything that is not a same-origin absolute
 * product path (protocol-relative, absolute URL, backslash tricks, auth loops,
 * over-long) is rejected rather than repaired — the visitor still reaches
 * sign-in, just without the deep link.
 */
export function resolveNextDestination(next?: AppDestination | null): NextResolution {
  if (next === undefined || next === null || next === "") return { value: null, status: "none" };
  const { value, reason } = classifyNext(next);
  return {
    value,
    // `classifyNext` returns the input verbatim when it is already safe, so an
    // unchanged value means "accepted" and anything else was rewritten/dropped.
    status: value === next ? "accepted" : "sanitized",
    requested: next.slice(0, 80),
    reason: value === next ? undefined : (reason ?? undefined),
  };
}


/** Absolute app URL for the sign-in screen, optionally deep-linked. */
export function appSignInHref(next?: AppDestination): string {
  const { value } = resolveNextDestination(next);
  const query = value ? `?next=${encodeURIComponent(value)}` : "";
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

export type HandoffFailureDetail = {
  href: string;
  context: HandoffContext;
  reason: "app_unreachable" | "offline";
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
  const resolved = resolveNextDestination(context.next);
  track("auth_handoff_started", {
    cta_location: context.location,
    destination: href.slice(0, 80),
    next_path: resolved.value ?? undefined,
    next_requested: resolved.requested,
    next_status: resolved.status,
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
    const reason = navigator.onLine ? "app_unreachable" : "offline";
    track("auth_handoff_failed", {
      cta_location: context.location,
      destination: href.slice(0, 80),
      next_path: resolved.value ?? undefined,
      next_requested: resolved.requested,
      next_status: resolved.status,
      reason,
    });
    window.dispatchEvent(
      new CustomEvent<HandoffFailureDetail>(HANDOFF_FAILED_EVENT, {
        detail: { href, context, reason },
      }),
    );
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
