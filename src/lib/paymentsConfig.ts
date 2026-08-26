/**
 * Pure diagnostics for the Paddle client configuration.
 *
 * Kept free of side effects and of `import.meta.env` reads at module scope so
 * it can be unit-tested and reused by the pricing banner, the admin payments
 * status page and `src/lib/paddle.ts` itself.
 */

export type PaddleEnvName = "sandbox" | "live";

export const PAYMENTS_ENV_VARS = ["VITE_PAYMENTS_CLIENT_TOKEN", "VITE_PAYMENTS_ENVIRONMENT"] as const;
export type PaymentsEnvVar = (typeof PAYMENTS_ENV_VARS)[number];

export interface PaymentsEnvInput {
  VITE_PAYMENTS_CLIENT_TOKEN?: string;
  VITE_PAYMENTS_ENVIRONMENT?: string;
}

export interface PaymentsIssue {
  /** Variable the problem belongs to, when it maps to one. */
  variable?: PaymentsEnvVar;
  /** Human readable description of what is wrong. */
  message: string;
  /** Concrete remediation step shown in the banner / admin page. */
  fix: string;
}

export interface PaymentsDiagnostics {
  /** True when checkout can be opened. */
  ok: boolean;
  /** Env vars that are entirely absent or blank. */
  missing: PaymentsEnvVar[];
  /** All problems, including value mismatches (not just missing vars). */
  issues: PaymentsIssue[];
  /** Resolved environment when valid. */
  environment?: PaddleEnvName;
  /** Environment implied by the token prefix, when a token is present. */
  tokenEnvironment?: PaddleEnvName;
  /** Safe, truncated token preview for admin display — never the full token. */
  tokenPreview?: string;
  /** Single-line summary; null when everything is configured. */
  reason: string | null;
}

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Masked token preview, e.g. `test_a1b2…f9c3`. Never returns the full token. */
export function previewToken(token: string): string {
  if (token.length <= 12) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 9)}…${token.slice(-4)}`;
}

export function diagnosePaymentsConfig(env: PaymentsEnvInput): PaymentsDiagnostics {
  const token = clean(env.VITE_PAYMENTS_CLIENT_TOKEN);
  const configuredEnv = clean(env.VITE_PAYMENTS_ENVIRONMENT);

  const missing: PaymentsEnvVar[] = [];
  const issues: PaymentsIssue[] = [];

  if (!token) {
    missing.push("VITE_PAYMENTS_CLIENT_TOKEN");
    issues.push({
      variable: "VITE_PAYMENTS_CLIENT_TOKEN",
      message: "The Paddle client-side token is not set, so Paddle.js cannot initialize.",
      fix: "Add VITE_PAYMENTS_CLIENT_TOKEN with your Paddle client-side token (starts with test_ for sandbox, live_ for production), then rebuild and republish.",
    });
  }

  const tokenEnvironment: PaddleEnvName | undefined = token
    ? token.startsWith("test_")
      ? "sandbox"
      : "live"
    : undefined;

  // The environment is primarily derived from the client token prefix, which
  // is the single source of truth after the build-time token swap. The explicit
  // env var is an optional override/validation only.
  const resolvedEnv: PaddleEnvName | undefined =
    configuredEnv === "sandbox" || configuredEnv === "live"
      ? configuredEnv
      : tokenEnvironment;

  if (!configuredEnv) {
    // Env var is optional; we derive from the token prefix. Still surface it in
    // the missing list so the admin page shows it can be set explicitly.
    missing.push("VITE_PAYMENTS_ENVIRONMENT");
  } else if (configuredEnv !== "sandbox" && configuredEnv !== "live") {
    issues.push({
      variable: "VITE_PAYMENTS_ENVIRONMENT",
      message: `VITE_PAYMENTS_ENVIRONMENT must be 'sandbox' or 'live', got '${configuredEnv}'.`,
      fix: "Correct the value to exactly 'sandbox' or 'live' (lowercase), or remove it to derive from the token prefix.",
    });
  } else if (tokenEnvironment && tokenEnvironment !== configuredEnv) {
    issues.push({
      message: `Environment mismatch: VITE_PAYMENTS_ENVIRONMENT is '${configuredEnv}' but the client token is a '${tokenEnvironment}' token.`,
      fix: `Either switch VITE_PAYMENTS_ENVIRONMENT to '${tokenEnvironment}', or replace the token with a ${configuredEnv} one.`,
    });
  }

  const ok = issues.length === 0 && tokenEnvironment !== undefined;
  const environment = ok ? (resolvedEnv as PaddleEnvName) : undefined;

  return {
    ok,
    missing,
    issues,
    environment,
    tokenEnvironment,
    tokenPreview: token ? previewToken(token) : undefined,
    reason: ok ? null : issues.map((i) => i.message).join(" "),
  };
}

/** Diagnostics for the environment this bundle was built with. */
export function currentPaymentsDiagnostics(): PaymentsDiagnostics {
  return diagnosePaymentsConfig({
    VITE_PAYMENTS_CLIENT_TOKEN: import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined,
    VITE_PAYMENTS_ENVIRONMENT: import.meta.env.VITE_PAYMENTS_ENVIRONMENT as string | undefined,
  });
}

/**
 * Environment used for entitlement/eligibility reads on this surface. Never
 * throws: with no valid config it falls back to the token prefix, then to
 * 'live' — the safe default, since live is the stricter set of records.
 *
 * The marketing surface does not open checkout (that lives on app.gradr.me),
 * so this is the only Paddle-shaped value the public bundle still needs.
 */
export function currentPaymentsEnvironment(): PaddleEnvName {
  const diagnostics = currentPaymentsDiagnostics();
  if (diagnostics.ok && diagnostics.environment) return diagnostics.environment;
  if (diagnostics.tokenEnvironment) return diagnostics.tokenEnvironment;
  const configured = (import.meta.env.VITE_PAYMENTS_ENVIRONMENT as string | undefined)?.trim();
  return configured === "sandbox" ? "sandbox" : "live";
}
