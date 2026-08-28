import { describe, it, expect, afterEach } from "vitest";
import { surfaceBase, surfaceFromPath, urlFor } from "@/config/domains";
import { authPath, sanitizeNext } from "@/lib/nextRedirect";

/**
 * Cross-surface navigation contract.
 *
 * A visitor on marketing / docs / news / affiliates who clicks into the product
 * must land on a real app route on the hostname that actually serves it, with
 * the intended destination preserved in `next=` so the session survives the
 * hop instead of dumping the user on a generic dashboard.
 */
function setHost(origin: string) {
  const url = new URL(origin);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, href: url.href, origin: url.origin, hostname: url.hostname, pathname: url.pathname },
  });
}
const realLocation = window.location;

describe("cross-surface navigation", () => {
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  });

  const entryPoints = [
    { path: "/marketing", surface: "marketing" as const },
    { path: "/docs", surface: "docs" as const },
    { path: "/news", surface: "news" as const },
    { path: "/affiliate", surface: "partners" as const },
    { path: "/partners", surface: "partners" as const },
  ];

  it("resolves each public entry point to its own surface", () => {
    for (const { path, surface } of entryPoints) {
      expect(surfaceFromPath(path)).toBe(surface);
    }
  });

  it("sends product links to app.gradr.me even from the marketing apex", () => {
    setHost("https://gradr.me/docs");
    for (const { path } of entryPoints) {
      const link = urlFor("app", "/dashboard");
      // The product is never served by this bundle: a product link from the
      // marketing host must cross to the app hostname, never resolve locally.
      expect(new URL(link).hostname).toBe("app.gradr.me");
      expect(surfaceFromPath(path)).not.toBeNull();
    }
  });

  it("sends Earn links to earn.gradr.me from the marketing apex", () => {
    setHost("https://gradr.me/");
    expect(new URL(urlFor("earn", "/")).hostname).toBe("earn.gradr.me");
  });


  it("links from a satellite host straight into the app host when it is served", () => {
    setHost("https://docs.gradr.me/start");
    expect(urlFor("app", "/dashboard")).toBe("https://app.gradr.me/dashboard");
    expect(surfaceBase("app", "docs.gradr.me")).toBe("");
  });

  it("preserves the intended destination through the auth hop", () => {
    setHost("https://app.gradr.me/career");
    expect(authPath("/career")).toBe("/auth?next=%2Fcareer");
    expect(urlFor("app", authPath("/career"))).toBe("https://app.gradr.me/auth?next=%2Fcareer");
  });

  it("never forwards an off-site next= target", () => {
    expect(sanitizeNext("https://evil.example/phish")).toBeNull();
    expect(sanitizeNext("//evil.example")).toBeNull();
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
  });
});
