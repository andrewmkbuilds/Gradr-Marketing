/**
 * Gradr conversion analytics — the canonical event vocabulary.
 *
 * Every event here answers a business question about the acquisition →
 * activation → revenue journey. Adding an event means adding it to
 * `GradrEvent` first, so the funnels stay buildable from a fixed vocabulary and
 * a typo can never silently create a parallel event name.
 *
 * Privacy contract (enforced by `sanitize`): ids, enums, counts, scores and
 * short labels only. Never resume text, interview transcripts, job
 * descriptions, emails, tokens or card data.
 */
import { phCapture, phRegister, phSetPerson, phSetPersonOnce } from "./posthog";
import { attributionProps } from "./attribution";
import { addBreadcrumb } from "./sentry";
import { trackEvent } from "@/lib/analytics";

export type GradrEvent =
  // Acquisition
  | "homepage_viewed"
  | "pricing_viewed"
  | "signup_cta_clicked"
  | "auth_handoff_started"
  | "auth_handoff_failed"
  | "auth_handoff_retried"
  | "authenticated_marketing_handoff"
  | "surface_redirect"
  | "legacy_url_hit"
  | "legacy_url_redirected"
  | "legacy_url_not_found"
  | "not_found_viewed"
  | "not_found_suggestion_clicked"
  | "not_found_offline"
  | "not_found_offline_retry"
  | "not_found_suggestions_cache"
  // Signup
  | "signup_started"
  | "account_created"
  | "signup_completed"
  | "signup_email_completed"
  | "signup_google_completed"
  | "login_completed"
  // Onboarding / activation milestones
  | "onboarding_started"
  | "onboarding_completed"
  | "profile_completed"
  | "career_preferences_completed"
  | "resume_uploaded"
  | "resume_analysis_started"
  | "resume_analysis_completed"
  | "resume_analyzed"
  | "resume_analysis_failed"
  | "resume_improved"
  // Core product activation
  | "job_search_started"
  | "job_saved"
  | "first_job_saved"
  | "job_application_tracked"
  | "mock_interview_started"
  | "mock_interview_completed"
  | "interview_setup_started"
  | "first_interview_completed"
  | "career_dashboard_viewed"
  // Monetization
  | "upgrade_cta_clicked"
  | "checkout_started"
  | "payment_completed"
  | "subscription_created"
  | "upgraded_to_premium"
  | "subscription_cancelled"
  | "subscription_renewed";

export type EventProps = Record<string, string | number | boolean | null | undefined>;

/** Where a signup / upgrade CTA lives. Keeps funnel breakdowns clean. */
export type CtaLocation =
  | "hero"
  | "navbar"
  | "pricing"
  | "feature_section"
  | "footer"
  | "mobile_menu"
  | "final_cta"
  | "guide"
  | "landing_page"
  | "paywall";

const MAX_STRING = 80;

function sanitize(props: EventProps): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      // Anything email-shaped is dropped outright; long free text is refused
      // rather than truncated, so we never half-ship private content.
      if (value.includes("@")) continue;
      if (value.length > MAX_STRING) continue;
      out[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function deviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

let userContext: {
  user_status: "anonymous" | "guest" | "authenticated";
  plan?: string;
  subscription_status?: string;
} = { user_status: "anonymous" };

/**
 * Registers the properties every event should carry (plan, auth status,
 * device) as PostHog super properties, so funnels can be broken down without
 * each call site repeating them.
 */
export function setAnalyticsUserContext(next: {
  status: "anonymous" | "guest" | "authenticated";
  plan?: string | null;
  subscriptionStatus?: string | null;
}) {
  userContext = {
    user_status: next.status,
    plan: next.plan ?? undefined,
    subscription_status: next.subscriptionStatus ?? undefined,
  };
  phRegister(sanitize({ ...userContext, device_type: deviceType() }));
}

/** Durable person properties for cohorting (plan, source, signup method). */
export function setAnalyticsPerson(props: EventProps, once = false) {
  const safe = sanitize(props);
  if (once) phSetPersonOnce(safe);
  else phSetPerson(safe);
}

function baseProps(): Record<string, unknown> {
  return {
    page: typeof window === "undefined" ? undefined : window.location.pathname.slice(0, 96),
    device_type: deviceType(),
    ...userContext,
    ...attributionProps(),
  };
}

/**
 * Captures a funnel event to PostHog, the internal analytics_events table and
 * Sentry breadcrumbs (so a crash carries the journey that produced it).
 */
export function track(event: GradrEvent, props: EventProps = {}) {
  const payload = { ...baseProps(), ...sanitize(props) };
  phCapture(event, payload);
  addBreadcrumb("funnel", event, payload);
  trackEvent(event, payload as EventProps);
}

const fired = new Set<string>();

/**
 * Captures an event at most once per page-load-scoped key. Used for view
 * events that would otherwise double-fire on re-render, StrictMode double
 * effects or tab refocus, which would corrupt funnel conversion rates.
 */
export function trackOnce(event: GradrEvent, props: EventProps = {}, key?: string) {
  const dedupeKey = `${event}:${key ?? props.page ?? "default"}`;
  if (fired.has(dedupeKey)) return;
  fired.add(dedupeKey);
  track(event, props);
}

/** Test seam. */
export function __resetTrackOnce() {
  fired.clear();
}

/**
 * A deliberate click on a primary "create account / start free" control.
 * Never call this for ordinary navigation — the homepage → signup-intent
 * conversion rate depends on this staying an intent signal.
 */
export function trackSignupCta(input: {
  location: CtaLocation;
  text: string;
  authenticated: boolean;
  destination?: string;
}) {
  track("signup_cta_clicked", {
    cta_location: input.location,
    cta_text: input.text.slice(0, MAX_STRING),
    destination: input.destination,
    authenticated: input.authenticated,
  });
}

/** A deliberate click on an upgrade / start-plan control. */
export function trackUpgradeCta(input: {
  location: CtaLocation;
  text: string;
  plan?: string;
  billingPeriod?: string;
  feature?: string;
}) {
  track("upgrade_cta_clicked", {
    cta_location: input.location,
    cta_text: input.text.slice(0, MAX_STRING),
    plan: input.plan,
    billing_period: input.billingPeriod,
    feature: input.feature,
  });
}
