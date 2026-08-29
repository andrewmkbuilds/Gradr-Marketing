/**
 * API contract tests.
 *
 * Locks the request/response shapes in `src/lib/contracts/api.ts` against both
 * directions of drift: a fixture that the client must accept, and a malformed
 * payload the contract must reject. A light source-level assertion keeps the
 * edge functions honest — if a response key is renamed in the function, the
 * contract test that names that key fails here, not in production.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CspReportBody,
  EmailEventWebhook,
  EmailTrackQuery,
  ENDPOINT_CONTRACTS,
  ErrorResponse,
  NewsletterConfirmRequest,
  NewsletterConfirmResponse,
  NewsletterSubscribeRequest,
  NewsletterSubscribeResponse,
  UnsubscribeInvalidResponse,
  UnsubscribeRequest,
  UnsubscribeResponse,
} from "@/lib/contracts/api";

const fnSource = (name: string) =>
  readFileSync(path.join(process.cwd(), "supabase/functions", name, "index.ts"), "utf8");

describe("newsletter-subscribe contract", () => {
  it("accepts the request the signup form sends", () => {
    expect(
      NewsletterSubscribeRequest.safeParse({
        email: "reader@example.com",
        firstName: "Ada",
        source: "landing",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed address and an oversized field", () => {
    expect(NewsletterSubscribeRequest.safeParse({ email: "nope" }).success).toBe(false);
    expect(
      NewsletterSubscribeRequest.safeParse({ email: `${"a".repeat(250)}@x.com` }).success,
    ).toBe(false);
  });

  it("accepts both delivered and degraded success responses", () => {
    expect(
      NewsletterSubscribeResponse.safeParse({
        ok: true,
        status: "pending",
        emailDelivered: true,
        deliveryStatus: "sent",
      }).success,
    ).toBe(true);
    expect(
      NewsletterSubscribeResponse.safeParse({
        ok: true,
        status: "pending",
        emailDelivered: false,
        deliveryStatus: "retry_scheduled",
        message: "You are on the list…",
      }).success,
    ).toBe(true);
  });

  it("rejects a success envelope missing ok/status", () => {
    expect(NewsletterSubscribeResponse.safeParse({ status: "pending" }).success).toBe(false);
    expect(NewsletterSubscribeResponse.safeParse({ ok: true }).success).toBe(false);
  });

  it("confirms with a token and returns a confirmed status", () => {
    expect(NewsletterConfirmRequest.safeParse({ action: "confirm", token: "abc" }).success).toBe(true);
    expect(NewsletterConfirmRequest.safeParse({ action: "confirm" }).success).toBe(false);
    expect(
      NewsletterConfirmResponse.safeParse({ ok: true, status: "confirmed", alreadyConfirmed: true })
        .success,
    ).toBe(true);
  });

  it("matches the keys the deployed function actually returns", () => {
    const src = fnSource("newsletter-subscribe");
    for (const key of ["ok: true", "status: 'pending'", "status: 'confirmed'", "emailDelivered", "deliveryStatus"]) {
      expect(src).toContain(key);
    }
  });
});

describe("handle-email-unsubscribe contract", () => {
  it("validates then confirms in two steps", () => {
    expect(UnsubscribeRequest.safeParse({ token: "t".repeat(64) }).success).toBe(true);
    expect(UnsubscribeRequest.safeParse({ token: "t".repeat(64), confirm: true }).success).toBe(true);
    expect(UnsubscribeRequest.safeParse({ token: "" }).success).toBe(false);
    expect(UnsubscribeRequest.safeParse({ token: "t".repeat(200) }).success).toBe(false);
  });

  it("only ever returns a masked address", () => {
    expect(UnsubscribeResponse.safeParse({ valid: true, email: "r•••••@example.com" }).success).toBe(true);
    expect(UnsubscribeResponse.safeParse({ valid: true, email: "reader@example.com" }).success).toBe(false);
  });

  it("reports invalid and already-unsubscribed with a known reason", () => {
    expect(UnsubscribeInvalidResponse.safeParse({ valid: false, reason: "invalid_token" }).success).toBe(true);
    expect(
      UnsubscribeInvalidResponse.safeParse({
        valid: false,
        reason: "already_unsubscribed",
        email: "r•••••@example.com",
      }).success,
    ).toBe(true);
    expect(UnsubscribeInvalidResponse.safeParse({ valid: false, reason: "expired" }).success).toBe(false);
  });

  it("matches the reasons the deployed function emits", () => {
    const src = fnSource("handle-email-unsubscribe");
    expect(src).toContain("invalid_token");
    expect(src).toContain("already_unsubscribed");
    expect(src).toContain("confirm === true");
  });
});

describe("email-track query contract", () => {
  it("accepts opens without a destination and clicks with one", () => {
    expect(EmailTrackQuery.safeParse({ m: "msg_1", t: "open" }).success).toBe(true);
    expect(
      EmailTrackQuery.safeParse({ m: "msg_1", t: "click", u: "https://gradr.me/pricing" }).success,
    ).toBe(true);
  });

  it("rejects clicks without a destination and off-domain redirects", () => {
    expect(EmailTrackQuery.safeParse({ m: "msg_1", t: "click" }).success).toBe(false);
    expect(
      EmailTrackQuery.safeParse({ m: "msg_1", t: "click", u: "https://evil.example/phish" }).success,
    ).toBe(false);
  });
});

describe("webhook contracts", () => {
  it("accepts a browser CSP report and rejects an empty one", () => {
    expect(
      CspReportBody.safeParse({
        "csp-report": {
          "document-uri": "https://gradr.me/",
          "violated-directive": "script-src",
          "blocked-uri": "inline",
        },
      }).success,
    ).toBe(true);
    expect(CspReportBody.safeParse({ "csp-report": {} }).success).toBe(false);
  });

  it("accepts terminal email delivery events and rejects unknown types", () => {
    expect(
      EmailEventWebhook.safeParse({
        id: "evt_1",
        type: "bounce",
        data: { recipient: "reader@example.com", message_id: "msg_1" },
      }).success,
    ).toBe(true);
    expect(
      EmailEventWebhook.safeParse({ id: "evt_1", type: "exploded", data: { recipient: "a@b.co" } })
        .success,
    ).toBe(false);
    expect(EmailEventWebhook.safeParse({ type: "bounce", data: { recipient: "a@b.co" } }).success).toBe(
      false,
    );
  });

  it("handles the reasons the events function maps", () => {
    const src = fnSource("handle-email-events");
    for (const reason of ["bounce", "complaint", "unsubscribe"]) expect(src).toContain(reason);
  });
});

describe("error envelope", () => {
  it("is a single non-empty error string", () => {
    expect(ErrorResponse.safeParse({ error: "Enter a valid email address." }).success).toBe(true);
    expect(ErrorResponse.safeParse({ error: "" }).success).toBe(false);
    expect(ErrorResponse.safeParse({}).success).toBe(false);
  });
});

describe("live contract registry", () => {
  it("names only functions that exist in this repo", () => {
    for (const contract of ENDPOINT_CONTRACTS) {
      expect(() => fnSource(contract.name)).not.toThrow();
      expect(contract.expectStatus.length).toBeGreaterThan(0);
    }
  });
});
