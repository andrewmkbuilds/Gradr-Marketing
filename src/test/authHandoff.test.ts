import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  appSignInHref,
  goToAppAuth,
  handoffToApp,
  resolveNextDestination,
  HANDOFF_FAILED_EVENT,
  HANDOFF_TIMEOUT_MS,
} from "@/lib/authHandoff";
import { track } from "@/lib/telemetry/events";

vi.mock("@/lib/telemetry/events", () => ({ track: vi.fn() }));


function setHost(url: string) {
  const location = new URL(url) as unknown as Location;
  (location as unknown as { assign: () => void }).assign = vi.fn();
  Object.defineProperty(window, "location", { value: location, writable: true });
  return location as unknown as Location & { assign: ReturnType<typeof vi.fn> };
}

describe("auth hand-off", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(track).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("sends every marketing CTA to the app auth route", () => {
    setHost("https://gradr.me/");
    expect(appSignInHref()).toBe("https://app.gradr.me/auth");
    // Preview / dev hosts must also leave the marketing bundle, or the CTA
    // lands on the NotFound hand-off route.
    setHost("http://localhost:8080/");
    expect(appSignInHref()).toBe("https://app.gradr.me/auth");
  });

  it("deep-links the intended destination through ?next=", () => {
    setHost("https://gradr.me/");
    expect(appSignInHref("/interview")).toBe("https://app.gradr.me/auth?next=%2Finterview");
  });

  it("tracks a started hand-off and performs a full navigation", () => {
    const location = setHost("https://gradr.me/");
    goToAppAuth({ location: "navbar", next: "/resume" });
    expect(location.assign).toHaveBeenCalledWith("https://app.gradr.me/auth?next=%2Fresume");
    expect(vi.mocked(track).mock.calls[0][0]).toBe("auth_handoff_started");
  });

  it("reports a failure when the app origin never takes over the page", () => {
    setHost("https://gradr.me/");
    goToAppAuth({ location: "hero" });
    vi.advanceTimersByTime(HANDOFF_TIMEOUT_MS + 1);
    const events = vi.mocked(track).mock.calls.map((c) => c[0]);
    expect(events).toContain("auth_handoff_failed");
  });

  it("stays quiet when the browser actually leaves the page", () => {
    setHost("https://gradr.me/");
    goToAppAuth({ location: "hero" });
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(HANDOFF_TIMEOUT_MS + 1);
    const events = vi.mocked(track).mock.calls.map((c) => c[0]);
    expect(events).not.toContain("auth_handoff_failed");
  });

  it("uses the router when already inside the product", () => {
    setHost("https://app.gradr.me/dashboard");
    const navigate = vi.fn();
    handoffToApp("/auth?next=%2Fresume", { location: "navbar" }, navigate);
    expect(navigate).toHaveBeenCalledWith("/auth?next=%2Fresume");
  });
});

describe("next deep-link validation", () => {
  beforeEach(() => vi.mocked(track).mockClear());

  it("accepts safe product paths", () => {
    expect(resolveNextDestination("/interview")).toEqual({
      value: "/interview",
      status: "accepted",
      requested: "/interview",
    });
  });

  it("rejects open-redirect and malformed destinations", () => {
    for (const bad of [
      "//evil.example",
      "https://evil.example/steal",
      "/\\evil.example",
      "javascript:alert(1)",
      "/auth",
      "/" + "a".repeat(600),
    ]) {
      const resolved = resolveNextDestination(bad);
      expect(resolved.value, bad).toBeNull();
      expect(resolved.status, bad).toBe("sanitized");
    }
  });

  it("never puts an unsafe next on the sign-in URL", () => {
    setHost("https://gradr.me/");
    expect(appSignInHref("https://evil.example")).toBe("https://app.gradr.me/auth");
    expect(appSignInHref("/resume")).toBe("https://app.gradr.me/auth?next=%2Fresume");
  });

  it("reports whether next was accepted or sanitized on every event", () => {
    setHost("https://gradr.me/");
    goToAppAuth({ location: "hero", next: "https://evil.example" });
    const [, props] = vi.mocked(track).mock.calls[0];
    expect(props).toMatchObject({ next_status: "sanitized", next_requested: "https://evil.example" });
    expect(props?.next_path).toBeUndefined();
  });
});

describe("hand-off failure recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(track).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("announces the failure so the UI can offer a retry", () => {
    setHost("https://gradr.me/");
    const onFailure = vi.fn();
    window.addEventListener(HANDOFF_FAILED_EVENT, onFailure);
    goToAppAuth({ location: "hero", next: "/resume" });
    vi.advanceTimersByTime(HANDOFF_TIMEOUT_MS + 1);
    window.removeEventListener(HANDOFF_FAILED_EVENT, onFailure);
    expect(onFailure).toHaveBeenCalledTimes(1);
    const detail = (onFailure.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.href).toContain("app.gradr.me/auth");
    expect(detail.context.location).toBe("hero");
  });
});

describe("sanitization reasons and retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(track).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("distinguishes malformed paths from auth-loop patterns", () => {
    expect(resolveNextDestination("//evil.example").reason).toBe("protocol_relative");
    expect(resolveNextDestination("https://evil.example").reason).toBe("not_absolute_path");
    expect(resolveNextDestination("/\\evil.example").reason).toBe("backslash_escape");
    expect(resolveNextDestination("/" + "a".repeat(600)).reason).toBe("too_long");
    expect(resolveNextDestination("/auth").reason).toBe("auth_loop");
    expect(resolveNextDestination("/reset-password").reason).toBe("auth_loop");
    expect(resolveNextDestination("/interview").reason).toBeUndefined();
  });

  it("reports the reason on hand-off analytics", () => {
    setHost("https://gradr.me/");
    goToAppAuth({ location: "hero", next: "/auth" });
    const [, props] = vi.mocked(track).mock.calls[0];
    expect(props).toMatchObject({ next_status: "sanitized", next_reason: "auth_loop" });
  });

  it("records a retry attempt that keeps the original next destination", () => {
    const location = setHost("https://gradr.me/");
    handoffToApp("https://app.gradr.me/auth?next=%2Fresume", {
      location: "hero",
      next: "/resume",
      attempt: 2,
    });
    const events = vi.mocked(track).mock.calls.map((c) => c[0]);
    expect(events[0]).toBe("auth_handoff_retried");
    expect(vi.mocked(track).mock.calls[0][1]).toMatchObject({ attempt: 2, next_path: "/resume" });
    expect(location.assign).toHaveBeenCalledWith("https://app.gradr.me/auth?next=%2Fresume");
  });
});
