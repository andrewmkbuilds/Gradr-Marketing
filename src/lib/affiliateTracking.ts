/**
 * Affiliate referral tracking — 90-day cookie attribution.
 *
 * Flow:
 *  1. captureReferralFromUrl()  — runs on app load. If `?ref=CODE` present,
 *     the `affiliate-track-click` edge function validates the code, logs the
 *     click as service_role and reports back the cookie window from
 *     `affiliate_settings.cookie_duration_days` (default 90). Logged-out
 *     visitors have no direct database access to affiliate data at all.
 *  2. getReferralCookie() / getClickId() — read current tracking values.
 *  3. attributeSignupReferral() — called right after a user successfully
 *     signs up, calls `attribute_signup_referral` RPC and clears the cookie.
 */
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/safeStorage";


const COOKIE_NAME = "cf_ref";
const CLICK_COOKIE_NAME = "cf_ref_click";
const VISITOR_KEY = "cf_visitor_key";
const DEFAULT_DAYS = 90;

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function getVisitorKey(): string {
  let key = safeStorage.get(VISITOR_KEY);
  if (!key) {
    key = crypto.randomUUID();
    safeStorage.set(VISITOR_KEY, key);
  }
  return key;
}

export function getReferralCookie(): string | null {
  return getCookie(COOKIE_NAME);
}

export function getClickId(): string | null {
  return getCookie(CLICK_COOKIE_NAME);
}

export async function captureReferralFromUrl() {
  try {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (!code) return;

    // Validate the code (RPC returns array)
    const { data: lookup } = await supabase.rpc("lookup_affiliate_by_code", { _code: code });
    const hit = Array.isArray(lookup) ? lookup[0] : null;
    if (!hit || !hit.is_active) return;

    // Pull cookie duration from public settings, fall back to 90.
    let days = DEFAULT_DAYS;
    const { data: settingsRows } = await supabase.rpc("get_affiliate_public_settings");
    const settings = Array.isArray(settingsRows) ? settingsRows[0] : settingsRows;
    if (settings?.cookie_duration_days) days = settings.cookie_duration_days;

    setCookie(COOKIE_NAME, code, days);

    // Log the click server-side. The browser only reports the referral code —
    // the edge function resolves which affiliate gets credited, so a visitor
    // can never attribute their own click to an arbitrary affiliate, and the
    // table stays closed to client writes.
    const { data: click } = await supabase.functions.invoke("affiliate-track-click", {
      body: {
        code,
        landing_page: window.location.pathname + window.location.search,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
        visitor_key: getVisitorKey(),
      },
    });

    if (click?.click_id) setCookie(CLICK_COOKIE_NAME, click.click_id, days);
  } catch (e) {
    // Tracking is best-effort — never block the app
    console.warn("[affiliate] capture failed", e);
  }
}

export async function attributeSignupReferral() {
  const code = getReferralCookie();
  if (!code) return;
  try {
    const clickId = getClickId();
    const { data } = await supabase.rpc("attribute_signup_referral", {
      _code: code,
      _click_id: clickId ?? undefined,
    });
    if (data) {
      // Successfully attributed — clear cookie to prevent re-attribution
      clearCookie(COOKIE_NAME);
      clearCookie(CLICK_COOKIE_NAME);
    }
  } catch (e) {
    console.warn("[affiliate] signup attribution failed", e);
  }
}
