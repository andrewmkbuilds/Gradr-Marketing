import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { appSignInHref, goToAppAuth, handoffToApp, HANDOFF_TIMEOUT_MS } from "@/lib/authHandoff";
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
