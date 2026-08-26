/**
 * Affiliate click tracker — the only write path into `affiliate_clicks`.
 *
 * The click row is the start of an attribution chain that ends in a payout, so
 * the visitor's browser must not get to say who gets credited. The client sends
 * a referral code and nothing else identifying; this function resolves the
 * affiliate profile itself, verifies the affiliate is active, and inserts as
 * service_role. A database trigger re-checks the code/profile pairing, so even
 * a bug here cannot mis-attribute a click.
 *
 * Public endpoint (no JWT): referral links are clicked by logged-out visitors.
 * Abuse is bounded by a per-visitor, per-IP rate limit and a short dedupe
 * window, so a single visitor cannot inflate an affiliate's click count.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** Clicks per visitor+IP per window, and the window itself. */
const MAX_CLICKS_PER_WINDOW = 10;
const WINDOW_MINUTES = 10;
/** The same visitor hitting the same code again inside this window is one click. */
const DEDUPE_MINUTES = 30;

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/** Attribution window, in days, falling back to the program default. */
const DEFAULT_COOKIE_DAYS = 90;

async function cookieDurationDays(): Promise<number> {
  const { data } = await db
    .from("affiliate_settings")
    .select("cookie_duration_days")
    .eq("id", 1)
    .maybeSingle();
  const days = data?.cookie_duration_days;
  return typeof days === "number" && days > 0 ? days : DEFAULT_COOKIE_DAYS;
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Path + whitelisted query only — referral URLs can carry arbitrary junk. */
function safeLandingPage(value: unknown): string | null {
  const raw = clean(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw, "https://app.gradr.me");
    return `${url.pathname}${url.search}`.slice(0, 300);
  } catch {
    return raw.startsWith("/") ? raw.slice(0, 300) : null;
  }
}

/** IP is hashed, never stored raw: it is only needed to bound abuse. */
async function hashIp(req: Request): Promise<string | null> {
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  const ip = forwarded?.split(",")[0]?.trim();
  if (!ip) return null;
  const salt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    const code = clean(body?.code, 32)?.toUpperCase() ?? "";
    if (!CODE_RE.test(code)) return json({ error: "Invalid referral code" }, 400);

    const visitorKey = clean(body?.visitor_key, 64);
    if (!visitorKey) return json({ error: "visitor_key is required" }, 400);

    // Resolve the affiliate server-side. The client never names a profile id.
    const { data: profile, error: profileError } = await db
      .from("affiliate_profiles")
      .select("id, affiliate_code, status")
      .ilike("affiliate_code", code)
      .maybeSingle();
    if (profileError) throw profileError;

    // An unknown or suspended code is not an error the visitor should learn
    // anything from — the redirect still works, the click is just not logged.
    if (!profile || profile.status !== "active") {
      return json({ tracked: false, reason: "inactive_code" });
    }

    // The visitor's browser needs the attribution window to size its cookie,
    // and this is the only anonymous path that can read it.
    const cookieDays = await cookieDurationDays();

    const ipHash = await hashIp(req);
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    const { count: recent } = await db
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("visitor_key", visitorKey)
      .gte("clicked_at", windowStart);
    if ((recent ?? 0) >= MAX_CLICKS_PER_WINDOW) {
      return json({ tracked: false, reason: "rate_limited" }, 429);
    }

    if (ipHash) {
      const { count: perIp } = await db
        .from("affiliate_clicks")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("clicked_at", windowStart);
      if ((perIp ?? 0) >= MAX_CLICKS_PER_WINDOW * 3) {
        return json({ tracked: false, reason: "rate_limited" }, 429);
      }
    }

    // Re-entering the same link (refresh, back button) is the same click.
    const { data: existing } = await db
      .from("affiliate_clicks")
      .select("id")
      .eq("visitor_key", visitorKey)
      .eq("affiliate_profile_id", profile.id)
      .gte("clicked_at", new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString())
      .order("clicked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return json({
        tracked: true,
        click_id: existing.id,
        deduped: true,
        cookie_duration_days: cookieDays,
      });
    }

    const { data: inserted, error: insertError } = await db
      .from("affiliate_clicks")
      .insert({
        affiliate_profile_id: profile.id,
        affiliate_code: profile.affiliate_code,
        landing_page: safeLandingPage(body?.landing_page),
        utm_source: clean(body?.utm_source, 120),
        utm_medium: clean(body?.utm_medium, 120),
        utm_campaign: clean(body?.utm_campaign, 120),
        session_id: clean(body?.session_id, 64),
        visitor_key: visitorKey,
        ip_hash: ipHash,
        user_agent: clean(req.headers.get("user-agent"), 500),
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return json({ tracked: true, click_id: inserted.id, cookie_duration_days: cookieDays });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("affiliate-track-click error:", message);
    // Tracking must never break the landing page the visitor came for.
    return json({ tracked: false, error: "Tracking failed" }, 500);
  }
});
