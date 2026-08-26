import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const AUTH_SOURCE = readFileSync(join(process.cwd(), "src/pages/Auth.tsx"), "utf8");
const NOTICE_SOURCE = readFileSync(
  join(process.cwd(), "src/components/auth/AgeGate.tsx"),
  "utf8",
);

describe("auth age-gate guardrails", () => {
  it("does not replace sign-in mode for a device with an under-age marker", () => {
    expect(AUTH_SOURCE).toContain("if (ageBlocked && isSignUp)");
    expect(AUTH_SOURCE).not.toContain("if (ageBlocked) {\n    return (");
  });

  it("gates social authentication only when it may create an account", () => {
    expect(AUTH_SOURCE).toContain("if (isSignUp && !ageOk)");
  });

  it("offers an existing-account sign-in path from the blocked notice", () => {
    expect(NOTICE_SOURCE).toContain("Sign in to an existing account");
    expect(NOTICE_SOURCE).toContain("onClick={onSignIn}");
  });
});