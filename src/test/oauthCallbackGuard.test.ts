import { describe, expect, it, vi } from "vitest";
import {
  APP_AUTH_URL,
  callbackHandoffUrl,
  enforceOAuthCallbackHandoff,
  isOAuthCallbackUrl,
} from "@/lib/auth/oauthCallbackGuard";

vi.mock("@/lib/routing/surfaceRedirectLog", () => ({
  logSurfaceRedirect: vi.fn(),
}));

describe("isOAuthCallbackUrl", () => {
  it("detects callback paths", () => {
    expect(isOAuthCallbackUrl("https://gradr.me/~oauth/callback")).toBe(true);
    expect(isOAuthCallbackUrl("https://gradr.me/auth/callback")).toBe(true);
  });

  it("detects code / state / token_hash responses on any path", () => {
    expect(isOAuthCallbackUrl("https://gradr.me/?code=abc")).toBe(true);
    expect(isOAuthCallbackUrl("https://gradr.me/pricing?state=xyz")).toBe(true);
    expect(isOAuthCallbackUrl("https://gradr.me/?token_hash=t")).toBe(true);
  });

  it("detects implicit-flow hash tokens", () => {
    expect(isOAuthCallbackUrl("https://gradr.me/#access_token=a&refresh_token=b")).toBe(true);
  });

  it("ignores ordinary marketing URLs", () => {
    expect(isOAuthCallbackUrl("https://gradr.me/")).toBe(false);
    expect(isOAuthCallbackUrl("https://gradr.me/pricing?utm_source=x")).toBe(false);
    expect(isOAuthCallbackUrl("https://gradr.me/support?error=form")).toBe(false);
  });
});

describe("callbackHandoffUrl", () => {
  it("folds any callback path into the product /auth route, keeping query + hash", () => {
    expect(callbackHandoffUrl("https://gradr.me/~oauth/callback?code=a&state=b")).toBe(
      `${APP_AUTH_URL}?code=a&state=b`,
    );
    expect(callbackHandoffUrl("https://gradr.me/auth/callback#access_token=t")).toBe(
      `${APP_AUTH_URL}#access_token=t`,
    );
  });
});

describe("enforceOAuthCallbackHandoff", () => {
  const run = (href: string, hostname: string) => {
    const replace = vi.fn();
    const handled = enforceOAuthCallbackHandoff({ href, hostname }, replace);
    return { handled, replace };
  };

  it("hands a callback on the marketing host to app.gradr.me/auth", () => {
    const { handled, replace } = run("https://gradr.me/?code=a&state=b", "gradr.me");
    expect(handled).toBe(true);
    expect(replace).toHaveBeenCalledWith(`${APP_AUTH_URL}?code=a&state=b`);
  });

  it("leaves the product host alone", () => {
    const { handled, replace } = run("https://app.gradr.me/~oauth/callback?code=a", "app.gradr.me");
    expect(handled).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("does nothing outside production", () => {
    const { handled } = run("http://localhost:8080/?code=a", "localhost");
    expect(handled).toBe(false);
  });

  it("does nothing for a normal marketing page", () => {
    const { handled } = run("https://gradr.me/pricing", "gradr.me");
    expect(handled).toBe(false);
  });
});
