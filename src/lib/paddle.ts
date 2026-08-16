import { initializePaddle as loadPaddle, type Paddle } from "@paddle/paddle-js";
import { supabase } from "@/integrations/supabase/client";
import { currentPaymentsDiagnostics } from "@/lib/paymentsConfig";
import { reportApiFailure } from "@/lib/monitoring/reliability";

/**
 * Paddle client bootstrap.
 *
 * Config is validated, but validation NEVER throws during module import or
 * render — payments are an optional integration and a missing/mismatched env
 * var must not take the whole app down. Reads (`getPaddleEnvironment`) degrade
 * gracefully; only actions that genuinely need Paddle (`getPaddle`) throw, and
 * they throw inside an event handler where the UI can show an error.
 *
 * Only the client-side token (`test_...` / `live_...`) ever reaches the
 * browser. The server-side API key lives exclusively in edge functions.
 */
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const configuredEnv = import.meta.env.VITE_PAYMENTS_ENVIRONMENT as string | undefined;

export type PaddleEnv = "sandbox" | "live";

/** Internal sentinel for "we could not determine the country" — never sent to Paddle. */
export const UNKNOWN_COUNTRY = "OTHERS";

const diagnostics = currentPaymentsDiagnostics();
const config = {
  ok: diagnostics.ok,
  token: diagnostics.ok ? clientToken : undefined,
  env: diagnostics.environment,
  reason: diagnostics.reason ?? undefined,
};

if (!config.ok) {
  // Loud in the console, silent in the UI — checkout surfaces the error when used.
  console.error(`[payments] disabled: ${config.reason}`);
}

/** True when payments are usable. Gate any payment UI on this. */
export function isPaymentsConfigured(): boolean {
  return config.ok;
}

/** Why payments are unavailable, or null when everything is configured. */
export function getPaymentsConfigError(): string | null {
  return config.ok ? null : (config.reason ?? "Payments are not configured.");
}

/**
 * Environment used for entitlement/subscription reads. Never throws.
 * With no valid config it falls back to the token prefix, then to 'live' —
 * the safe default, since live is the stricter set of records to read.
 */
export function getPaddleEnvironment(): PaddleEnv {
  if (config.ok && config.env) return config.env;
  if (clientToken?.startsWith("test_")) return "sandbox";
  if (configuredEnv === "sandbox" || configuredEnv === "live") return configuredEnv;
  return "live";
}

/** Throws when payments are misconfigured — only call from user actions. */
function requireConfig(): { token: string; env: PaddleEnv } {
  if (!config.ok || !config.token || !config.env) {
    throw new Error(`Payments are unavailable: ${config.reason ?? "not configured"}`);
  }
  return { token: config.token, env: config.env };
}


let paddlePromise: Promise<Paddle> | null = null;

export async function getPaddle(): Promise<Paddle> {
  if (!paddlePromise) {
    const { token, env } = requireConfig();
    paddlePromise = loadPaddle({
      environment: env === "sandbox" ? "sandbox" : "production",
      token,
    }).then((instance) => {
      if (!instance) throw new Error("Paddle.js failed to initialize");
      return instance;
    });
  }
  return paddlePromise;
}

/** Back-compat helper used by the billing provider. */
export async function initializePaddle() {
  await getPaddle();
}

/**
 * Country used for localized pricing.
 *
 * This app is a static SPA, so there is no request handler to read a
 * geo header like `x-vercel-ip-country`. If a CDN/edge injects one into the
 * document as `<meta name="x-geo-country" content="DE">`, we honour it;
 * otherwise we return undefined and let `Paddle.PricePreview()` geolocate the
 * visitor from their IP. The `OTHERS` sentinel stays app-side only.
 */
export function resolveCountryCode(): string | undefined {
  const meta = document
    .querySelector<HTMLMetaElement>('meta[name="x-geo-country"]')
    ?.content?.trim()
    .toUpperCase();
  if (!meta || meta === UNKNOWN_COUNTRY || meta.length !== 2) return undefined;
  return meta;
}

export interface PreviewedPrice {
  /** Localized, Paddle-formatted total. Render as-is — never re-format. */
  formattedTotal: string;
  currencyCode: string;
  /** Raw subtotal in minor units — only used to render a discounted price. */
  subtotalMinor: number;
}

/**
 * Formats a minor-unit amount in the currency Paddle quoted. Used exclusively
 * for showing an eligibility-discounted price next to the struck-through list
 * price; the list price itself always comes from Paddle verbatim.
 */
export function formatMinorAmount(minor: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(navigator.language, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currencyCode}`;
  }
}

/**
 * Localized prices for a set of human-readable price IDs.
 * Returns a map keyed by the human-readable ID.
 */
/**
 * Retries a transient payments read a couple of times before giving up.
 * Pricing must never be blocked by one flaky network hop — callers fall back
 * to the static USD catalog when this still fails.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw lastError;
}

/**
 * Why a price could not be resolved.
 * - `catalog_missing`: the provider has no price with that external id, so
 *   checkout genuinely cannot start (the catalog needs publishing).
 * - `unavailable`: transport / server error — usually transient.
 */
export type PriceLookupCode = "catalog_missing" | "unavailable";

export class PriceLookupError extends Error {
  readonly code: PriceLookupCode;
  readonly priceId: string;
  readonly status?: number;

  constructor(code: PriceLookupCode, priceId: string, status?: number, message?: string) {
    super(message ?? `Failed to resolve price: ${priceId}`);
    this.name = "PriceLookupError";
    this.code = code;
    this.priceId = priceId;
    this.status = status;
  }
}

export async function previewPrices(
  priceIds: string[],
): Promise<Record<string, PreviewedPrice>> {
  try {
    return await withRetry(() => previewPricesOnce(priceIds));
  } catch (error) {
    const code = error instanceof PriceLookupError ? error.code : "unavailable";
    reportApiFailure("paddle-price-preview", error, {
      code,
      status: error instanceof PriceLookupError ? (error.status ?? null) : null,
      context: {
        environment: getPaddleEnvironment(),
        priceCount: priceIds.length,
        priceId: error instanceof PriceLookupError ? error.priceId : undefined,
      },
    });
    throw error;
  }
}

async function previewPricesOnce(
  priceIds: string[],
): Promise<Record<string, PreviewedPrice>> {

  const paddle = await getPaddle();
  const resolved = await Promise.all(
    priceIds.map(async (id) => [id, await getPaddlePriceId(id)] as const),
  );
  const byPaddleId = new Map(resolved.map(([id, paddleId]) => [paddleId, id]));

  const country = resolveCountryCode();
  const result = await paddle.PricePreview({
    items: resolved.map(([, paddleId]) => ({ priceId: paddleId, quantity: 1 })),
    ...(country ? { address: { countryCode: country } } : {}),
  });

  const out: Record<string, PreviewedPrice> = {};
  for (const line of result.data.details.lineItems) {
    const key = byPaddleId.get(line.price.id);
    if (!key) continue;
    out[key] = {
      // Use the gross total: it is what the customer is actually charged and
      // matches the list price in @/config/pricing (Paddle's `subtotal` strips
      // inclusive VAT in tax-inclusive countries, which understated prices).
      formattedTotal: line.formattedTotals.total,
      currencyCode: result.data.currencyCode,
      subtotalMinor: Number(line.totals.total ?? 0),
    };
  }
  return out;
}

const priceCache = new Map<string, string>();

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const cached = priceCache.get(priceId);
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke("get-paddle-price", {
    body: { priceId, environment: getPaddleEnvironment() },
  });

  if (error || !data?.paddleId) {
    // `FunctionsHttpError` carries the response; 404 means the catalog simply
    // does not have this price yet, which is a different UI story to a 5xx.
    const status =
      (error as { context?: { status?: number } } | null)?.context?.status ??
      (data?.error === "Price not found" ? 404 : undefined);
    const code: PriceLookupCode = status === 404 ? "catalog_missing" : "unavailable";
    throw new PriceLookupError(code, priceId, status, error?.message);
  }

  priceCache.set(priceId, data.paddleId);
  return data.paddleId as string;
}
