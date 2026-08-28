import { describe, it, expect } from "vitest";
import {
  PRODUCTION_ORIGIN,
  canonicalUrlFor,
  deployEnv,
  isMultiSurfaceHost,
  satelliteSubdomainsLive,
  surfaceFromHost,
} from "@/config/domains";

/**
 * Production surface routing contract.
 *
 * The authenticated product is canonically served from app.gradr.me; gradr.me
 * is the public site. Hosting must serve those hostnames independently for this
 * contract to be achievable; an alias redirect happens before this code runs.
 */
describe("surface routing", () => {
  it("maps each production hostname to its surface", () => {
    expect(surfaceFromHost("gradr.me")).toBe("home");
    expect(surfaceFromHost("www.gradr.me")).toBe("home");
    expect(surfaceFromHost("app.gradr.me")).toBe("app");
    expect(surfaceFromHost("marketing.gradr.me")).toBe("marketing");
    expect(surfaceFromHost("news.gradr.me")).toBe("news");
    expect(surfaceFromHost("docs.gradr.me")).toBe("docs");
    expect(surfaceFromHost("affiliates.gradr.me")).toBe("partners");
    expect(surfaceFromHost("partners.gradr.me")).toBe("partners");
    expect(surfaceFromHost("status.gradr.me")).toBe("status");
    expect(surfaceFromHost("support.gradr.me")).toBe("support");
  });

  it("gives status and support their own canonical origins", () => {
    expect(PRODUCTION_ORIGIN.status).toBe("https://status.gradr.me");
    expect(PRODUCTION_ORIGIN.support).toBe("https://support.gradr.me");
    expect(canonicalUrlFor("support", "/contact")).toBe("https://support.gradr.me/contact");
    expect(satelliteSubdomainsLive("status.gradr.me")).toBe(true);
    expect(isMultiSurfaceHost("support.gradr.me")).toBe(false);
  });

  it("treats a satellite host that actually served the bundle as live", () => {
    expect(satelliteSubdomainsLive("app.gradr.me")).toBe(true);
    expect(isMultiSurfaceHost("app.gradr.me")).toBe(false);
    expect(satelliteSubdomainsLive("docs.gradr.me")).toBe(true);
  });

  it("keeps the primary host multi-surface until the app subdomain is served", () => {
    // Without VITE_APP_SUBDOMAIN_LIVE=true, gradr.me must keep serving the
    // product routes, otherwise the app is unreachable behind the platform 302.
    expect(satelliteSubdomainsLive("gradr.me")).toBe(false);
    expect(isMultiSurfaceHost("gradr.me")).toBe(true);
  });

  it("never treats previews or localhost as production", () => {
    expect(deployEnv("id-preview--x.lovable.app")).toBe("preview");
    expect(deployEnv("localhost")).toBe("development");
    expect(isMultiSurfaceHost("localhost")).toBe(true);
  });

  it("canonicalises product URLs to app.gradr.me regardless of host", () => {
    expect(PRODUCTION_ORIGIN.app).toBe("https://app.gradr.me");
    expect(canonicalUrlFor("app", "/dashboard")).toBe("https://app.gradr.me/dashboard");
    // Homepage canonical keeps the trailing slash so it matches index.html.
    expect(canonicalUrlFor("home", "/")).toBe("https://gradr.me/");
  });
});
