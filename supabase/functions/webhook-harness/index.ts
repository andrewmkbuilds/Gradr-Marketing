/**
 * Webhook test harness (admin only).
 *
 * Three actions, all read-only with respect to product state:
 *   - `sample`  : build a realistic Paddle / RevenueCat test payload
 *   - `sign`    : sign a payload with the configured webhook secret
 *   - `verify`  : verify a signature against a payload (the exact algorithm
 *                 the real handler uses)
 *
 * The harness NEVER replays a payload into the production webhook handler, so
 * it cannot grant entitlements or mutate subscriptions. Every run is recorded
 * in `webhook_delivery_logs` with `source = 'test'`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { logWebhookDelivery } from "../_shared/webhookLog.ts";

type Provider = "paddle" | "revenuecat";
type Env = "sandbox" | "live";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("unauthorized");
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data } = await anon.auth.getUser();
  const user = data?.user;
  if (!user) throw new Error("unauthorized");
  const { data: isAdmin } = await anon.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) throw new Error("forbidden");
  return user.id;
}

function paddleSecret(env: Env): string | null {
  return Deno.env.get(env === "sandbox" ? "PAYMENTS_SANDBOX_WEBHOOK_SECRET" : "PAYMENTS_LIVE_WEBHOOK_SECRET") ?? null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Test payloads mirror the shape the real handlers read. */
function samplePayload(provider: Provider, eventType: string, env: Env, userId: string) {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  if (provider === "revenuecat") {
    return {
      api_version: "1.0",
      event: {
        type: eventType.toUpperCase(),
        id: `evt_test_${crypto.randomUUID()}`,
        app_user_id: userId,
        product_id: "pro_monthly",
        entitlement_ids: ["pro"],
        environment: env === "live" ? "PRODUCTION" : "SANDBOX",
        expiration_at_ms: later.getTime(),
        purchased_at_ms: now.getTime(),
      },
    };
  }
  return {
    event_id: `evt_test_${crypto.randomUUID()}`,
    event_type: eventType,
    occurred_at: now.toISOString(),
    notification_id: `ntf_test_${crypto.randomUUID()}`,
    data: {
      id: `sub_test_${crypto.randomUUID()}`,
      status: eventType.endsWith("canceled") ? "canceled" : "active",
      customer_id: `ctm_test_${crypto.randomUUID()}`,
      custom_data: { userId },
      current_billing_period: { starts_at: now.toISOString(), ends_at: later.toISOString() },
      items: [
        {
          price: { id: "pri_test", import_meta: { external_id: "pro_monthly" } },
          product: { id: "pro_test", import_meta: { external_id: "pro_plan" } },
        },
      ],
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unauthorized";
    return json({ error: msg }, msg === "forbidden" ? 403 : 401);
  }

  const started = Date.now();
  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    const provider = (body.provider === "revenuecat" ? "revenuecat" : "paddle") as Provider;
    const env = (body.environment === "live" ? "live" : "sandbox") as Env;

    if (action === "sample") {
      const eventType = String(body.eventType ?? "subscription.created");
      const payload = samplePayload(provider, eventType, env, String(body.userId ?? adminId));
      return json({ payload, raw: JSON.stringify(payload, null, 2) });
    }

    if (action === "sign" || action === "verify") {
      const raw = typeof body.raw === "string" ? body.raw : JSON.stringify(body.payload ?? {});
      const secret = provider === "paddle" ? paddleSecret(env) : Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? null;

      if (!secret) {
        return json({
          ok: false,
          configured: false,
          message: `No webhook secret configured for ${provider} (${env}).`,
        });
      }

      if (provider === "revenuecat") {
        // RevenueCat authenticates with a shared bearer secret, not an HMAC.
        if (action === "sign") {
          return json({ configured: true, header: "Authorization", value: "Bearer <configured secret>" });
        }
        const supplied = String(body.signature ?? "").replace(/^Bearer\s+/i, "");
        const valid = timingSafeEqual(supplied, secret);
        await logWebhookDelivery({
          provider,
          environment: env,
          source: "test",
          signaturePresent: Boolean(supplied),
          signatureValid: valid,
          verificationError: valid ? null : "shared_secret_mismatch",
          status: valid ? "processed" : "rejected",
          durationMs: Date.now() - started,
          rawBody: raw,
          payload: JSON.parse(raw || "{}"),
        });
        return json({ configured: true, valid, algorithm: "shared-secret (Authorization: Bearer)" });
      }

      const ts = String(body.timestamp ?? Math.floor(Date.now() / 1000));
      const expected = await hmacHex(secret, `${ts}:${raw}`);

      if (action === "sign") {
        return json({ configured: true, header: "Paddle-Signature", value: `ts=${ts};h1=${expected}` });
      }

      const supplied = String(body.signature ?? "");
      const h1 = /h1=([a-f0-9]+)/i.exec(supplied)?.[1] ?? "";
      const suppliedTs = /ts=(\d+)/.exec(supplied)?.[1] ?? ts;
      const recomputed = await hmacHex(secret, `${suppliedTs}:${raw}`);
      const valid = Boolean(h1) && timingSafeEqual(h1, recomputed);
      const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(suppliedTs));
      const fresh = Number.isFinite(ageSeconds) && ageSeconds <= 300;

      const parsed: Record<string, unknown> = JSON.parse(raw || "{}");
      await logWebhookDelivery({
        provider,
        environment: env,
        eventType: parsed?.event_type ?? null,
        eventId: parsed?.event_id ?? null,
        source: "test",
        signaturePresent: Boolean(supplied),
        signatureValid: valid,
        verificationError: valid ? null : "hmac_mismatch",
        status: valid ? "processed" : "rejected",
        durationMs: Date.now() - started,
        rawBody: raw,
        payload: parsed,
      });

      return json({
        configured: true,
        valid,
        fresh,
        ageSeconds,
        algorithm: "HMAC-SHA256 over `ts:body`",
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[webhook-harness]", e instanceof Error ? e.message : e);
    return json({ error: "Harness failed" }, 400);
  }
});
