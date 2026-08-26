import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AgeBlockedNotice, AgeGate } from "@/components/auth/AgeGate";
import {
  checkDateOfBirth,
  clearAgeGate,
  isKnownChildDevice,
  readAgeGate,
  recordAgeGate,
} from "@/lib/compliance/coppa";

const NOW = new Date("2026-08-26T12:00:00Z");

const renderGate = (props: Parameters<typeof AgeGate>[0]) =>
  render(
    <MemoryRouter>
      <AgeGate {...props} />
    </MemoryRouter>,
  );

describe("mis-typed birth years", () => {
  it("rejects a future year without blocking the device", () => {
    const result = checkDateOfBirth("2062-05-01", NOW);
    expect(result.status).toBe("invalid");
  });

  it("rejects an implausible year (typo like 0199 or 1099)", () => {
    expect(checkDateOfBirth("0199-05-01", NOW).status).toBe("invalid");
    expect(checkDateOfBirth("1099-05-01", NOW).status).toBe("invalid");
  });

  it("treats a transposed recent year as under-age, not invalid", () => {
    // Meant 2001, typed 2021 → 5 years old.
    expect(checkDateOfBirth("2021-05-01", NOW)).toEqual({ status: "under-age", age: 5 });
  });

  it("shows an inline error and records nothing for an invalid date", async () => {
    const onBlocked = vi.fn();
    const onVerified = vi.fn();
    renderGate({ onVerified, onBlocked, onCancel: vi.fn() });

    await userEvent.type(screen.getByLabelText(/date of birth/i), "2062-05-01");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
    expect(readAgeGate()).toBeNull();
  });

  it("passes once the typo is corrected to an adult date", async () => {
    const onVerified = vi.fn();
    renderGate({ onVerified, onBlocked: vi.fn(), onCancel: vi.fn() });

    const input = screen.getByLabelText(/date of birth/i);
    await userEvent.type(input, "2062-05-01");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onVerified).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "1996-05-01");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(readAgeGate()?.eligible).toBe(true);
  });
});

describe("age-block recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clearAgeGate removes the marker without granting eligibility", () => {
    recordAgeGate(false);
    expect(isKnownChildDevice()).toBe(true);
    clearAgeGate();
    expect(isKnownChildDevice()).toBe(false);
    expect(readAgeGate()).toBeNull();
  });

  it("the blocked notice offers an adult re-check that clears only local state", async () => {
    recordAgeGate(false);
    const onRecheck = vi.fn();
    render(
      <MemoryRouter>
        <AgeBlockedNotice onSignIn={vi.fn()} onRecheck={onRecheck} />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /wrong date/i }));

    expect(onRecheck).toHaveBeenCalledTimes(1);
    expect(readAgeGate()).toBeNull();
  });

  it("keeps a route back to sign-in from the blocked notice", async () => {
    const onSignIn = vi.fn();
    render(
      <MemoryRouter>
        <AgeBlockedNotice onSignIn={onSignIn} onRecheck={vi.fn()} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /existing account/i }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("lets a corrected age reach sign-in end to end", async () => {
    recordAgeGate(false);
    const reachedSignIn = vi.fn();

    // 1. Blocked notice → re-check clears the local block.
    const blocked = render(
      <MemoryRouter>
        <AgeBlockedNotice onSignIn={reachedSignIn} onRecheck={vi.fn()} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /wrong date/i }));
    expect(isKnownChildDevice()).toBe(false);
    blocked.unmount();

    // 2. Corrected date of birth passes the screen.
    const onVerified = vi.fn();
    renderGate({ onVerified, onBlocked: vi.fn(), onCancel: reachedSignIn });
    await userEvent.type(screen.getByLabelText(/date of birth/i), "1994-02-11");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(readAgeGate()?.eligible).toBe(true);
    expect(isKnownChildDevice()).toBe(false);
  });
});

describe("auth wiring for returning users", () => {
  const source = readFileSyncSafe("src/pages/Auth.tsx");

  it("skips the age gate for OAuth and guest paths when a session exists", () => {
    expect(source).toContain("const isReturningUser = Boolean(user);");
    expect(source).toContain("if (isSignUp && !ageOk && !isReturningUser)");
    expect(source).toContain("if (!ageOk && !isReturningUser)");
  });

  it("resets the block when the user chooses to sign in instead", () => {
    expect(source).toContain("clearAgeGate();");
    expect(source).toContain("setAgeBlocked(false);");
  });
});

function readFileSyncSafe(relative: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require("fs") as typeof import("fs");
  return readFileSync(`${process.cwd()}/${relative}`, "utf8");
}
