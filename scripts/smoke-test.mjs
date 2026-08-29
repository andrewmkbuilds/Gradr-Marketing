#!/usr/bin/env node
/**
 * Production smoke tests.
 *
 * Loads every critical route in a real browser, fails on runtime exceptions or
 * error fallbacks, and verifies that the auth and pricing routes hand the
 * visitor over to the product instead of rendering it here.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                      # against http://localhost:8080
 *   node scripts/smoke-test.mjs https://your.app     # against a deployed build
 *
 * Exit code 0 = all checks passed, 1 = at least one failure.
 */
import { chromium } from "playwright";
import { findChromium } from "./lib/browser.mjs";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Resolve a Chromium binary. Playwright's bundled download is preferred; when
 * the pinned revision isn't present (common in CI images that ship their own
 * browser) we fall back to any Chromium in the shared browser cache or to
 * PLAYWRIGHT_CHROMIUM_PATH / CHROME_PATH.
 */

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (err) {
    const executablePath = findChromium();
    if (!executablePath) throw err;
    console.log(`(using fallback Chromium at ${executablePath})`);
    return chromium.launch({ executablePath });
  }
}

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

/** Public routes that must render for anonymous visitors. */
const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/pricing",
  "/career-advice",
  "/job-search",
  "/blog/ai-resume-optimization",
  "/privacy",
  "/terms",
  "/refund-policy",
];

/** Auth-gated routes: must not crash — a redirect to /auth is a pass. */
const GATED_ROUTES = ["/dashboard", "/resume", "/match", "/interview", "/billing", "/settings"];

/** Static assets that must be served. */
const STATIC_FILES = ["/robots.txt", "/sitemap.xml"];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const icon = ok ? "PASS" : "FAIL";
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Noise that must not fail a smoke run: dev-only React warnings, asset 404s. */
const IGNORED_CONSOLE = /favicon|net::ERR_|Failed to load resource|^Warning:|React Router Future Flag|Download the React DevTools/i;

const ERROR_FALLBACK = /something broke on our side|application error|unexpected error|something went wrong/i;

/** Describe why a rendered page counts as blank, or "" when it rendered fine. */
function blankReason(blank) {
  if (!blank) return "could not inspect the DOM";
  if (blank.rootMissing) return "#root is missing";
  if (blank.rootEmpty) return "#root rendered no elements";
  if (blank.splashStuck) return "splash screen never dismissed";
  if (blank.visibleChars < 40) return `only ${blank.visibleChars} visible characters inside #root`;
  return "";
}

async function visit(page, route) {
  const errors = [];
  const onPageError = (err) => errors.push(String(err));
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  try {
    const response = await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(1200);
    const status = response?.status() ?? 0;
    const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
    // Blank-screen detection: an empty React root, a stuck splash, or the
    // hidden SEO shell being the only thing on screen all mean "blank page".
    const blank = await page.evaluate(() => {
      const root = document.getElementById("root");
      const splash = document.getElementById("app-splash");
      const visibleText = (root?.innerText ?? "").trim();
      return {
        rootMissing: !root,
        rootEmpty: !root || root.childElementCount === 0,
        splashStuck: Boolean(splash && splash.offsetParent !== null),
        visibleChars: visibleText.length,
        errorScreen: Boolean(document.querySelector("[data-app-error-screen]")),
      };
    }).catch(() => null);
    return { status, body, errors, url: page.url(), blank };
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }
}

/** Seller identity from the single source of truth (src/content/legal.ts). */
function sellerIdentity() {
  const src = readFileSync(new URL("../src/content/legal.ts", import.meta.url), "utf8");
  const pick = (name) => src.match(new RegExp(`export const ${name} = "([^"]+)"`))?.[1] ?? "";
  return {
    legalName: pick("SELLER_LEGAL_NAME"),
    tradingName: pick("SELLER_TRADING_NAME"),
    contactEmail: pick("SELLER_CONTACT_EMAIL"),
    paths: Array.from(src.matchAll(/\{ path: "([^"]+)", label:/g)).map((m) => m[1]),
  };
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // ---- Static assets -------------------------------------------------
  for (const file of STATIC_FILES) {
    const res = await fetch(`${BASE}${file}`).catch(() => null);
    record(`static ${file}`, Boolean(res?.ok), res ? `HTTP ${res.status}` : "request failed");
  }

  // ---- Public routes -------------------------------------------------
  for (const route of PUBLIC_ROUTES) {
    const { status, body, errors, blank } = await visit(page, route);
    const fatal = errors.filter((e) => !IGNORED_CONSOLE.test(e));
    const reason = blankReason(blank);
    const crashed = ERROR_FALLBACK.test(body) || Boolean(blank?.errorScreen);
    const ok = status < 400 && !reason && !crashed && fatal.length === 0;
    record(
      `route ${route}`,
      ok,
      ok
        ? `HTTP ${status}`
        : `status=${status} blank=${reason || "no"} crashed=${crashed} errors=${fatal.slice(0, 2).join(" | ")}`,
    );
  }

  // ---- Policy pages must carry the required Paddle readiness content --
  const policyExpectations = [
    { route: "/terms", must: [/merchant of record/i, /paddle/i] },
    { route: "/refund-policy", must: [/\b(14|30|60|90)[- ]day/i, /paddle/i] },
    { route: "/privacy", must: [/data controller/i, /paddle/i] },
  ];
  for (const { route, must } of policyExpectations) {
    const { body } = await visit(page, route);
    const missing = must.filter((re) => !re.test(body)).map(String);
    const forbidden = /no refunds|all sales are final/i.test(body);
    record(
      `policy content ${route}`,
      missing.length === 0 && !forbidden,
      missing.length ? `missing ${missing.join(", ")}` : forbidden ? "contains no-refund language" : "ok",
    );
  }

  // ---- Seller name must match the configured legal business name --------
  const seller = sellerIdentity();
  const policyPaths = seller.paths.length ? seller.paths : ["/terms", "/privacy", "/refund-policy"];
  for (const route of policyPaths) {
    const { body } = await visit(page, route);
    const hasLegal = body.includes(seller.legalName);
    const hasEmail = body.includes(seller.contactEmail);
    const staleBrand = /CareerFlow\s*OS/i.test(body);
    record(
      `seller name on ${route}`,
      hasLegal && hasEmail && !staleBrand,
      staleBrand
        ? "page still shows the legacy CareerFlow OS brand"
        : hasLegal && hasEmail
          ? `"${seller.legalName}" + ${seller.contactEmail}`
          : `missing ${[!hasLegal && `seller "${seller.legalName}"`, !hasEmail && "contact email"].filter(Boolean).join(" and ")}`,
    );
  }

  // ---- /auth is a hand-off, never a marketing-rendered sign-in form ------
  // Sign-in lives in the app project (app.gradr.me/auth). This surface must
  // either hand the visitor over (production) or render the 404 (dev/preview),
  // and must never ship a credential form of its own.
  {
    const { body } = await visit(page, "/auth");
    const hasForm = await page.locator('input[type="password"]').count();
    const handsOff = /app\.gradr\.me/.test(body) || /page not found|can.t find that page/i.test(body);
    record(
      "/auth hands off to the product",
      hasForm === 0 && handsOff,
      hasForm ? "marketing surface renders a password field" : "no local sign-in form",
    );
  }

  // ---- Auth-gated routes must not crash ------------------------------
  for (const route of GATED_ROUTES) {
    const { body, errors, url, blank } = await visit(page, route);
    const fatal = errors.filter((e) => !IGNORED_CONSOLE.test(e));
    const reason = blankReason(blank);
    const crashed = ERROR_FALLBACK.test(body) || Boolean(blank?.errorScreen);
    const ok = !crashed && !reason && fatal.length === 0;
    record(
      `gated ${route}`,
      ok,
      ok ? `resolved to ${new URL(url).pathname}` : [reason, ...fatal.slice(0, 2)].filter(Boolean).join(" | "),
    );
  }

  // ---- /pricing hands off to the product's plans page -------------------
  // Checkout is initialised only on app.gradr.me; this surface just forwards,
  // with a crawlable link so the destination survives blocked navigation.
  {
    await visit(page, "/pricing");
    const link = page.locator('a[href*="app.gradr.me/pricing"]').first();
    const linked = await link.isVisible().catch(() => false);
    record("pricing hands off to app.gradr.me", linked, linked ? "crawlable plans link present" : "no hand-off link on /pricing");
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`\nFailed checks:\n${failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke run crashed:", err);
  process.exit(1);
});
