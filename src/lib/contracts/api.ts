/**
 * API contracts for the marketing surface.
 *
 * One place that describes the *shape* of every request this bundle sends to a
 * backend endpoint and the shape of every response it is allowed to act on —
 * plus the webhook payloads the backend accepts from third parties.
 *
 * These schemas are the contract in both directions:
 *  - `src/test/apiContracts.test.ts` asserts fixtures and negative cases, so a
 *    field rename in an edge function fails a unit test instead of production.
 *  - `scripts/check-api-contracts.mjs` replays the same schemas against the
 *    deployed functions in CI, so a drifted deployment fails a gate.
 *
 * Rule: never loosen a schema to make a failing check pass. Change the endpoint
 * and the contract together.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** Every function returns errors in this shape. */
export const ErrorResponse = z.object({
  error: z.string().min(1),
});

/** A masked address — the endpoints never echo a full email to the client. */
const MaskedEmail = z.string().regex(/^.{1,2}[•*]+@.+\..+$/, "email must be masked");

/* ------------------------------------------------------------------ */
/* newsletter-subscribe                                                */
/* ------------------------------------------------------------------ */

export const NewsletterSubscribeRequest = z.object({
  action: z.literal("subscribe").optional(),
  email: z.string().email().max(254),
  firstName: z.string().max(80).optional(),
  topic: z.string().max(80).optional(),
  source: z.string().max(40).optional(),
});

export const NewsletterConfirmRequest = z.object({
  action: z.literal("confirm"),
  token: z.string().min(1).max(128),
});

/**
 * `emailDelivered: false` is a *degraded success*: the signup is stored and the
 * confirmation email is delayed. The UI must keep treating it as a success.
 */
export const NewsletterSubscribeResponse = z.object({
  ok: z.literal(true),
  status: z.literal("pending"),
  emailDelivered: z.boolean().optional(),
  deliveryStatus: z.string().optional(),
  message: z.string().optional(),
});

export const NewsletterConfirmResponse = z.object({
  ok: z.literal(true),
  status: z.literal("confirmed"),
  alreadyConfirmed: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/* handle-email-unsubscribe                                            */
/* ------------------------------------------------------------------ */

export const UnsubscribeRequest = z.object({
  token: z.string().min(1).max(128),
  /** Absent/false validates the token; true performs the unsubscribe. */
  confirm: z.boolean().optional(),
});

export const UnsubscribeValidResponse = z.object({
  valid: z.literal(true),
  success: z.boolean().optional(),
  email: MaskedEmail,
});

export const UnsubscribeInvalidResponse = z.object({
  valid: z.literal(false),
  reason: z.enum(["invalid_token", "already_unsubscribed"]),
  email: MaskedEmail.optional(),
});

export const UnsubscribeResponse = z.union([
  UnsubscribeValidResponse,
  UnsubscribeInvalidResponse,
]);

/* ------------------------------------------------------------------ */
/* email-track (GET query contract)                                    */
/* ------------------------------------------------------------------ */

export const EmailTrackQuery = z
  .object({
    /** message_id of a real row in email_send_log. */
    m: z.string().min(1),
    t: z.enum(["open", "click"]),
    /** Required for clicks; must stay on a gradr.me host (no open redirect). */
    u: z
      .string()
      .url()
      .refine((v) => /(^|\.)gradr\.me$/i.test(new URL(v).hostname), "destination must be a gradr.me host")
      .optional(),
  })
  .refine((q) => q.t !== "click" || Boolean(q.u), "click events require a destination");

/* ------------------------------------------------------------------ */
/* csp-report (webhook: browser → backend)                             */
/* ------------------------------------------------------------------ */

export const CspReportBody = z.object({
  "csp-report": z.object({
    "document-uri": z.string().min(1),
    "violated-directive": z.string().min(1),
    "effective-directive": z.string().optional(),
    "blocked-uri": z.string().optional(),
    disposition: z.string().optional(),
    "status-code": z.number().optional(),
  }),
});

/* ------------------------------------------------------------------ */
/* handle-email-events (webhook: managed email → backend)              */
/* ------------------------------------------------------------------ */

export const EmailEventWebhook = z.object({
  /** Stable id used for idempotent redelivery. */
  id: z.string().min(1),
  type: z.enum(["bounce", "complaint", "unsubscribe", "delivered", "opened", "clicked"]),
  data: z.object({
    recipient: z.string().email(),
    message_id: z.string().nullable().optional(),
  }),
});

/* ------------------------------------------------------------------ */
/* Registry — what the live contract gate replays                      */
/* ------------------------------------------------------------------ */

export interface EndpointContract {
  /** Edge function name. */
  name: string;
  method: "POST" | "GET";
  /** Describes what the sample call exercises. */
  scenario: string;
  /** A request that must be rejected as malformed (contract-level 4xx). */
  invalidRequest?: unknown;
  /** Status codes the endpoint is allowed to answer the sample call with. */
  expectStatus: number[];
  /** Schema the response body must satisfy for those statuses. */
  responseSchema: z.ZodTypeAny;
}

export const ENDPOINT_CONTRACTS: EndpointContract[] = [
  {
    name: "newsletter-subscribe",
    method: "POST",
    scenario: "malformed email is rejected with an error envelope",
    invalidRequest: { action: "subscribe", email: "not-an-email" },
    expectStatus: [400],
    responseSchema: ErrorResponse,
  },
  {
    name: "newsletter-subscribe",
    method: "POST",
    scenario: "unknown action is rejected with an error envelope",
    invalidRequest: { action: "nope" },
    expectStatus: [400],
    responseSchema: ErrorResponse,
  },
  {
    name: "handle-email-unsubscribe",
    method: "POST",
    scenario: "unknown token reports invalid without leaking an address",
    invalidRequest: { token: "0".repeat(64) },
    expectStatus: [400, 404],
    responseSchema: UnsubscribeInvalidResponse,
  },
  {
    name: "handle-email-unsubscribe",
    method: "POST",
    scenario: "missing token is rejected",
    invalidRequest: {},
    expectStatus: [400],
    responseSchema: UnsubscribeInvalidResponse,
  },
];

export type NewsletterSubscribeRequestT = z.infer<typeof NewsletterSubscribeRequest>;
export type UnsubscribeResponseT = z.infer<typeof UnsubscribeResponse>;
