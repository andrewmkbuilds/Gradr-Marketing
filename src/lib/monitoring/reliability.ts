/**
 * Gradr reliability monitoring — one funnel for every production failure.
 *
 * Three failure families are tracked with a shared vocabulary so an alert can
 * be built on a single signal instead of a dozen ad-hoc console.error calls:
 *
 *  - `api`     — edge function / REST / storage calls that returned non-2xx
 *  - `auth`    — sign-in, sign-up, session refresh and OAuth callback failures
 *  - `llm`     — model timeouts, truncated streams, unparsable JSON, quota
 *
 * Every incident goes to Sentry (tagged + scrubbed) and PostHog
 * (`reliability_incident`). A rolling burst detector escalates to a Sentry
 * `error` when the same signature repeats past a threshold inside the window,
 * which is what alert rules fire on ("Gradr reliability alert").
 *
 * Privacy: only ids, enums, codes, counts and short labels. Never resume text,
 * transcripts, emails, tokens or request bodies.
 */
import { addBreadcrumb, captureError, Sentry, sentryEnabled } from "@/lib/telemetry/sentry";
import { phCapture } from "@/lib/telemetry/posthog";

export type IncidentKind = "api" | "auth" | "llm" | "storage";

export interface IncidentInput {
  kind: IncidentKind;
  /** Stable, low-cardinality operation name, e.g. "resume-analyze". */
  operation: string;
  /** HTTP status or provider status code when known. */
  status?: number | null;
  /** Short machine code, e.g. "rate_limited", "stream_truncated". */
  code?: string | null;
  /** Human message — truncated and never used as an id. */
  message?: string | null;
  /** Extra low-cardinality context (ids, counts, enums only). */
  context?: Record<string, string | number | boolean | null | undefined>;
  /** Original throwable, when there is one. */
  cause?: unknown;
}

/** Burst thresholds per family: N occurrences of a signature within WINDOW ms. */
const WINDOW_MS = 60_000;
const THRESHOLDS: Record<IncidentKind, number> = {
  api: 3,
  auth: 3,
  llm: 2,
  storage: 2,
};

const recent = new Map<string, number[]>();

function signature(i: IncidentInput) {
  return `${i.kind}:${i.operation}:${i.code ?? i.status ?? "unknown"}`;
}

/** Records the hit and reports whether this signature is now bursting. */
function registerBurst(key: string, kind: IncidentKind) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  return hits.length >= THRESHOLDS[kind];
}

function short(message?: string | null) {
  if (!message) return undefined;
  return message.length > 200 ? `${message.slice(0, 197)}…` : message;
}

/** Classifies a thrown value / response into a stable machine code. */
export function classifyFailure(status?: number | null, message?: string | null): string {
  const text = (message ?? "").toLowerCase();
  if (status === 401 || /unauthor|jwt|session/.test(text)) return "unauthorized";
  if (status === 402 || /credit|quota|billing/.test(text)) return "quota_exhausted";
  if (status === 403 || /forbidden|row-level|policy/.test(text)) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 413 || /too large|payload/.test(text)) return "payload_too_large";
  if (status === 429 || /rate limit/.test(text)) return "rate_limited";
  if (/abort/.test(text)) return "aborted";
  if (/timeout|timed out/.test(text)) return "timeout";
  if (/network|failed to fetch|load failed/.test(text)) return "network";
  if (/cors|cross-origin/.test(text)) return "cors";
  if (/json|unexpected token|parse/.test(text)) return "parse_error";
  if (status && status >= 500) return "server_error";
  if (status && status >= 400) return "client_error";
  return "unknown";
}

/**
 * Report one production failure. Safe no-op when telemetry is not configured,
 * and never throws — monitoring must not be able to break a user flow.
 */
export function reportIncident(input: IncidentInput) {
  try {
    const code = input.code ?? classifyFailure(input.status, input.message ?? asMessage(input.cause));
    const key = signature({ ...input, code });
    const bursting = registerBurst(key, input.kind);

    const props = {
      kind: input.kind,
      operation: input.operation,
      code,
      status: input.status ?? null,
      message: short(input.message ?? asMessage(input.cause)) ?? null,
      bursting,
      ...input.context,
    };

    addBreadcrumb(`reliability.${input.kind}`, input.operation, props);
    phCapture("reliability_incident", props);

    // Expected, self-healing conditions stay as breadcrumbs unless they burst.
    const benign = code === "aborted" || code === "unauthorized" || code === "rate_limited";
    if (benign && !bursting) return;

    if (sentryEnabled()) {
      Sentry.withScope((scope) => {
        scope.setTag("reliability_kind", input.kind);
        scope.setTag("reliability_operation", input.operation);
        scope.setTag("reliability_code", code);
        scope.setLevel(bursting ? "error" : "warning");
        scope.setContext("reliability", props);
        if (input.cause instanceof Error) {
          Sentry.captureException(input.cause);
        } else {
          Sentry.captureMessage(
            bursting
              ? `Gradr reliability alert: ${input.kind}/${input.operation} (${code})`
              : `${input.kind}/${input.operation} failed (${code})`,
          );
        }
      });
    } else if (import.meta.env.DEV) {
      console.warn("[reliability]", props);
    }

    if (bursting) {
      phCapture("reliability_alert", props);
    }
  } catch (err) {
    // Monitoring must never surface as an app error.
    if (import.meta.env.DEV) console.warn("[reliability] reporter failed", err);
  }
}

function asMessage(cause: unknown): string | undefined {
  if (!cause) return undefined;
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return undefined;
}

/** Convenience wrappers so call sites read as intent, not plumbing. */
export const reportApiFailure = (
  operation: string,
  cause: unknown,
  extra?: Omit<IncidentInput, "kind" | "operation" | "cause">,
) => reportIncident({ kind: "api", operation, cause, ...extra });

export const reportAuthFailure = (
  operation: string,
  cause: unknown,
  extra?: Omit<IncidentInput, "kind" | "operation" | "cause">,
) => reportIncident({ kind: "auth", operation, cause, ...extra });

export const reportLlmFailure = (
  operation: string,
  cause: unknown,
  extra?: Omit<IncidentInput, "kind" | "operation" | "cause">,
) => reportIncident({ kind: "llm", operation, cause, ...extra });

export const reportStorageFailure = (
  operation: string,
  cause: unknown,
  extra?: Omit<IncidentInput, "kind" | "operation" | "cause">,
) => reportIncident({ kind: "storage", operation, cause, ...extra });

/**
 * Wrap any promise-returning call so failures are reported with a stable
 * operation name and then rethrown untouched.
 */
export async function monitored<T>(
  kind: IncidentKind,
  operation: string,
  run: () => Promise<T>,
  context?: IncidentInput["context"],
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    reportIncident({ kind, operation, cause: error, context });
    throw error;
  }
}

/** Escape hatch used by the global handlers below. */
export function reportUnhandled(error: unknown, source: string) {
  captureError(error, { source });
}
