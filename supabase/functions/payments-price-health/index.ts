import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

/**
 * Admin health check for the price resolver.
 *
 * Verifies that `get-paddle-price` can actually reach Paddle and resolve every
 * catalog price, and — crucially — surfaces the EXACT failure instead of the
 * generic 500 the resolver returns to end users: the name of the missing
 * secret, or the verbatim Paddle API error code/detail.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Secrets every Paddle server call needs, per environment. */
const REQUIRED_SECRETS: Record<PaddleEnv, string[]> = {
  sandbox: ["PADDLE_SANDBOX_API_KEY", "LOVABLE_API_KEY"],
  live: ["PADDLE_LIVE_API_KEY", "LOVABLE_API_KEY"],
};

interface PriceCheck {
  priceId: string;
  ok: boolean;
  paddleId?: string;
  status?: number;
  ms?: number;
  errorCode?: string;
  error?: string;
}

async function checkPrice(environment: PaddleEnv, priceId: string): Promise<PriceCheck> {
  const started = Date.now();
  try {
    const res = await gatewayFetch(
      environment,
      `/prices?external_id=${encodeURIComponent(priceId)}`,
    );
    const ms = Date.now() - started;
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const err = body?.error ?? {};
      return {
        priceId,
        ok: false,
        status: res.status,
        ms,
        errorCode: typeof err.code === "string" ? err.code : `http_${res.status}`,
        error: typeof err.detail === "string"
          ? err.detail
          : `Paddle returned HTTP ${res.status}.`,
      };
    }

    const paddleId = body?.data?.[0]?.id;
    if (!paddleId) {
      return {
        priceId,
        ok: false,
        status: res.status,
        ms,
        errorCode: "price_not_found",
        error: `No price with external_id '${priceId}' exists in the ${environment} catalog.`,
      };
    }
    return { priceId, ok: true, paddleId, status: res.status, ms };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing = REQUIRED_SECRETS[environment].find((s) => message.includes(s));
    return {
      priceId,
      ok: false,
      ms: Date.now() - started,
      errorCode: missing ? "missing_secret" : "network_error",
      error: missing
        ? `Secret ${missing} is not configured for the ${environment} environment.`
        : message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await asUser.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const environment: PaddleEnv = body?.environment === "live" ? "live" : "sandbox";
    const requested: string[] = Array.isArray(body?.priceIds)
      ? body.priceIds.filter((p: unknown) => typeof p === "string" && p.length <= 64).slice(0, 20)
      : [];
    const priceIds = requested.length ? requested : ["pro_monthly"];

    const secrets = REQUIRED_SECRETS[environment].map((name) => ({
      name,
      present: Boolean(Deno.env.get(name)),
    }));
    const missingSecrets = secrets.filter((s) => !s.present).map((s) => s.name);

    if (missingSecrets.length) {
      return json({
        environment,
        healthy: false,
        secrets,
        missingSecrets,
        prices: priceIds.map<PriceCheck>((priceId) => ({
          priceId,
          ok: false,
          errorCode: "missing_secret",
          error: `Secret ${missingSecrets[0]} is not configured for the ${environment} environment.`,
        })),
        checkedAt: new Date().toISOString(),
      });
    }

    const prices = await Promise.all(priceIds.map((p) => checkPrice(environment, p)));

    return json({
      environment,
      healthy: prices.every((p) => p.ok),
      secrets,
      missingSecrets,
      prices,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("payments-price-health error", err);
    return json({ error: err instanceof Error ? err.message : "Health check failed" }, 500);
  }
});
