import { describe, expect, it, beforeEach } from "vitest";
import {
  loadProfile,
  maskMcpUrl,
  saveProfile,
  validateMcpUrl,
} from "@/lib/mcp/connectionProfile";

describe("validateMcpUrl", () => {
  it("accepts an https endpoint and trims the trailing slash", () => {
    const result = validateMcpUrl("  https://abc.supabase.co/functions/v1/mcp/  ");
    expect(result).toEqual({ ok: true, url: "https://abc.supabase.co/functions/v1/mcp" });
  });

  it("allows http only on loopback", () => {
    expect(validateMcpUrl("http://localhost:54321/functions/v1/mcp").ok).toBe(true);
    expect(validateMcpUrl("http://example.com/mcp").ok).toBe(false);
  });

  it("rejects blanks, junk, credentials and fragments", () => {
    expect(validateMcpUrl("").ok).toBe(false);
    expect(validateMcpUrl("not a url").ok).toBe(false);
    expect(validateMcpUrl("https://user:pw@abc.supabase.co/mcp").ok).toBe(false);
    expect(validateMcpUrl("https://abc.supabase.co/mcp#frag").ok).toBe(false);
  });
});

describe("maskMcpUrl", () => {
  it("masks the project ref but keeps the path readable", () => {
    const masked = maskMcpUrl("https://xaeyjrekewnwjujnrqgu.supabase.co/functions/v1/mcp");
    expect(masked).not.toContain("xaeyjrekewnwjujnrqgu");
    expect(masked).toContain(".supabase.co/functions/v1/mcp");
  });

  it("masks query values", () => {
    expect(maskMcpUrl("https://abc.supabase.co/mcp?token=supersecretvalue")).not.toContain(
      "supersecretvalue",
    );
  });
});

describe("profile persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved profile", () => {
    saveProfile("https://abc.supabase.co/functions/v1/mcp", "Claude");
    const loaded = loadProfile();
    expect(loaded?.url).toBe("https://abc.supabase.co/functions/v1/mcp");
    expect(loaded?.client).toBe("Claude");
  });

  it("ignores invalid stored data", () => {
    localStorage.setItem("gradr.mcp.profile", JSON.stringify({ url: "nope", client: "Claude" }));
    expect(loadProfile()).toBeNull();
  });
});
