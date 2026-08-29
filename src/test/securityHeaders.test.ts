import { describe, expect, it } from "vitest";
// Plain ESM helper shared with the CI script.
import { ROUTES, checkRoute, evaluateCookies } from "../../scripts/lib/securityHeaders.mjs";

/**
 * Cookie hardening rules — offline, so they gate every run rather than only the
 * production header sweep.
 */
describe("cookie flags", () => {
  const fail = (cookie: string) => evaluateCookies([cookie]).failures;

  it("accepts a hardened session cookie", () => {
    expect(fail("sb-access-token=x; Path=/; Secure; HttpOnly; SameSite=Lax")).toEqual([]);
  });

  it("rejects a session cookie without HttpOnly", () => {
    expect(fail("sb-access-token=x; Path=/; Secure; SameSite=Lax").join()).toMatch(/HttpOnly/);
  });

  it("rejects cookies without Secure or an explicit SameSite", () => {
    expect(fail("session=x; Path=/; HttpOnly; SameSite=Lax").join()).toMatch(/Secure/);
    expect(fail("session=x; Path=/; Secure; HttpOnly").join()).toMatch(/SameSite/);
  });

  it("allows the preference cookies the client reads by design", () => {
    expect(fail("gradr-theme=dark; Path=/; Secure; SameSite=Lax")).toEqual([]);
  });

  it("passes when a route sets no cookies at all", () => {
    expect(evaluateCookies([]).failures).toEqual([]);
  });
});

/**
 * Runtime security-header assertions.
 *
 * Runs against production (or SECURITY_HEADERS_TARGET) and verifies CSP, HSTS
 * and Referrer-Policy on `/auth` and OAuth-related paths. Skipped unless
 * RUN_HEADER_CHECKS=1 so local unit runs stay offline.
 */
const target = (process.env.SECURITY_HEADERS_TARGET || "https://gradr.me").replace(/\/$/, "");
const enabled = process.env.RUN_HEADER_CHECKS === "1";

describe.skipIf(!enabled)(`security headers on ${target}`, () => {
  for (const path of ROUTES as string[]) {
    it(`applies the expected headers to ${path}`, async () => {
      const result = await checkRoute(`${target}${path}`);
      expect(result.failures, result.failures.join("\n")).toEqual([]);
    }, 30_000);
  }
});
