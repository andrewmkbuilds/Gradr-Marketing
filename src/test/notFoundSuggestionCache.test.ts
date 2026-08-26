import { beforeEach, describe, expect, it } from "vitest";
import {
  NOT_FOUND_DESTINATIONS,
  clearSuggestionCache,
  suggestRoutes,
  suggestRoutesCached,
} from "@/lib/notFoundSuggestions";

describe("suggestRoutesCached", () => {
  beforeEach(() => {
    clearSuggestionCache();
  });

  it("returns the same ranking as the uncached path", () => {
    const direct = suggestRoutes("/ats-resume-checkr");
    const cached = suggestRoutesCached("/ats-resume-checkr");
    expect(cached.source).toBe("computed");
    expect(cached.suggestions.map((s) => s.to)).toEqual(direct.map((s) => s.to));
  });

  it("serves repeat lookups from memory", () => {
    suggestRoutesCached("/interview-coaching");
    expect(suggestRoutesCached("/interview-coaching").source).toBe("memory");
  });

  it("rehydrates from session storage after the in-memory cache is dropped", () => {
    const first = suggestRoutesCached("/job-serch");
    expect(first.suggestions.length).toBeGreaterThan(0);
    // Simulate a reload: memory is gone, sessionStorage survives.
    const stored = window.sessionStorage.getItem("gradr.notfound.suggestions.v1");
    clearSuggestionCache();
    window.sessionStorage.setItem("gradr.notfound.suggestions.v1", stored ?? "{}");

    const second = suggestRoutesCached("/job-serch");
    expect(second.source).toBe("storage");
    expect(second.suggestions.map((s) => s.to)).toEqual(first.suggestions.map((s) => s.to));
  });

  it("discards entries when the destination registry changes", () => {
    suggestRoutesCached("/ats-resume-checkr");
    const shrunk = NOT_FOUND_DESTINATIONS.slice(0, 3);
    // Different registry signature ⇒ recomputed, never a stale destination.
    expect(suggestRoutesCached("/ats-resume-checkr", shrunk).source).toBe("computed");
  });

  it("keeps caching keyed by limit", () => {
    suggestRoutesCached("/resume", NOT_FOUND_DESTINATIONS, 3);
    expect(suggestRoutesCached("/resume", NOT_FOUND_DESTINATIONS, 5).source).toBe("computed");
  });
});
