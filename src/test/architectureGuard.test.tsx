import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";

/**
 * Architecture guard: Gradr stays on Vite + React Router.
 * Blocks TanStack Start creeping in and verifies the router setup plus the
 * critical public/app routes are still declared and rendering.
 */
const ROOT = process.cwd();
const APP = readFileSync(join(ROOT, "src/App.tsx"), "utf8");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const FORBIDDEN = /@tanstack\/(start|react-start|react-router|router|start-[a-z-]+)/;

// This project serves the public brand surfaces only — the authenticated
// product lives in the separate "Gradr (App)" project.
const CRITICAL_ROUTES = [
  "/",
  "/landing",
  "/pricing",
  "/career-advice",
  "/job-search",
  "*",
];

describe("no TanStack Start", () => {
  it("has no TanStack Start packages in package.json", () => {
    const names = [
      ...Object.keys(PKG.dependencies ?? {}),
      ...Object.keys(PKG.devDependencies ?? {}),
    ];
    expect(names.filter((n) => FORBIDDEN.test(n))).toEqual([]);
  });

  it("keeps react-router-dom as the router dependency", () => {
    expect(PKG.dependencies?.["react-router-dom"]).toBeTruthy();
  });

  it("does not import TanStack Start anywhere in App.tsx", () => {
    expect(FORBIDDEN.test(APP)).toBe(false);
  });

  it("wires the CI guardrail into prebuild", () => {
    expect(PKG.scripts?.prebuild ?? "").toContain("check-no-tanstack");
    expect(PKG.scripts?.["check:no-tanstack"]).toBeTruthy();
  });
});

describe("router setup", () => {
  it("mounts the app inside BrowserRouter", () => {
    expect(APP).toMatch(/<BrowserRouter>/);
    expect(APP).toMatch(/from "react-router-dom"/);
  });

  it("declares every critical route", () => {
    const declared = Array.from(APP.matchAll(/<Route\s+path="([^"]+)"/g)).map((m) => m[1]);
    for (const route of CRITICAL_ROUTES) {
      expect(declared, `missing route ${route}`).toContain(route);
    }
  });

  it("renders and navigates with react-router primitives", () => {
    render(
      <MemoryRouter initialEntries={["/pricing"]}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route
            path="/pricing"
            element={
              <div>
                <h1>Pricing</h1>
                <Link to="/">Home</Link>
              </div>
            }
          />
          <Route path="*" element={<p>not found</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("falls back to the catch-all route for unknown paths", () => {
    render(
      <MemoryRouter initialEntries={["/definitely-not-a-route"]}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route path="*" element={<p>not found</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("not found")).toBeInTheDocument();
  });
});
