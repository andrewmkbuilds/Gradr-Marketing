#!/usr/bin/env node
/**
 * Playwright smoke tests for Gradr's marketing-critical pages.
 *
 * This project serves public brand surfaces only; the authenticated product
 * lives on app.gradr.me. We therefore assert that:
 *   - every indexable marketing page renders its expected headline/content,
 *   - every product/auth path either hands off to app.gradr.me or renders a
 *     branded 404/redirect (never product chrome),
 *   - no runtime error surfaces and the loading splash / SEO fallback never
 *     becomes visible.
 *
 * Usage: node scripts/smoke-critical-pages.mjs [baseUrl]
 */
import { launchBrowser, sampleForFlash } from "./lib/browser.mjs";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

const MARKETING_PAGES = [
  { route: "/", name: "landing", expect: [/gradr/i, /resume|interview|career/i] },
  { route: "/landing", name: "landing alias", expect: [/gradr/i, /resume|interview|career/i] },
  { route: "/ats-resume-checker", name: "ats checker", expect: [/ats|resume|checker/i] },
  { route: "/ai-cover-letter-generator", name: "cover letter", expect: [/cover letter/i] },
  { route: "/ai-interview-coach", name: "interview coach", expect: [/interview|coach/i] },
  { route: "/job-application-tracker", name: "job tracker", expect: [/job|application|tracker/i] },
  { route: "/career-advice", name: "career advice", expect: [/career|advice|guide/i] },
  { route: "/job-search", name: "job search", expect: [/job|search|role/i] },
  { route: "/blog/ai-resume-optimization", name: "ai resume blog", expect: [/ai|resume|optimization/i] },
  { route: "/legal", name: "legal hub", expect: [/legal|policies/i] },
  { route: "/privacy", name: "privacy", expect: [/privacy/i] },
  { route: "/terms", name: "terms", expect: [/terms|conditions/i] },
];

const PRODUCT_HANDOFF_PATHS = [
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/login",
  "/signup",
  "/dashboard",
  "/resume",
  "/match",
  "/interview",
  "/growth",
  "/settings",
  "/billing",
];

const IGNORED_CONSOLE =
  /favicon|net::ERR_|Failed to load resource|^Warning:|React Router Future Flag|Download the React DevTools/i;
const ERROR_FALLBACK = /something broke on our side|application error|unexpected error|something went wrong/i;
const APP_CHROME = /\bSign out\b|\bMy dashboard\b|\bCredits remaining\b/i;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`Critical-page smoke against ${BASE}\n`);
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  for (const spec of MARKETING_PAGES) {
    const errors = [];
    const onPageError = (e) => errors.push(String(e));
    const onConsole = (m) => { if (m.type() === "error") errors.push(m.text()); };
    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    try {
      const response = await page.goto(`${BASE}${spec.route}`, { waitUntil: "commit", timeout: 30_000 });
      const flash = await sampleForFlash(page, { samples: 25, intervalMs: 60 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
      const status = response?.status() ?? 0;

      const missing = spec.expect.filter((re) => !re.test(body));
      const fatal = errors.filter((e) => !IGNORED_CONSOLE.test(e));
      const crashed = ERROR_FALLBACK.test(body)
        || (await page.locator("[data-app-error-screen]").count().catch(() => 0)) > 0;
      const appLeaked = APP_CHROME.test(body);

      const renderOk = status < 400 && missing.length === 0 && !crashed && !appLeaked && fatal.length === 0;
      record(
        `${spec.name} (${spec.route}) renders expected UI`,
        renderOk,
        renderOk
          ? `HTTP ${status}`
          : [
              `status=${status}`,
              missing.length ? `missing ${missing.map(String).join(", ")}` : "",
              crashed ? "error screen" : "",
              appLeaked ? "app chrome leaked" : "",
              fatal.slice(0, 2).join(" | "),
            ].filter(Boolean).join(" · "),
      );

      const flashOk = flash.seoVisibleFrames.length === 0 && !flash.splashStuck;
      record(
        `${spec.name} (${spec.route}) no loading/SEO flash`,
        flashOk,
        flashOk
          ? `clean across ${flash.samples} frames`
          : flash.seoVisibleFrames.length
            ? `SEO fallback painted ("${flash.seoVisibleFrames[0].phrase}")`
            : "splash never dismissed",
      );
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }
  }

  // Product/auth paths must never render authenticated chrome here.
  for (const route of PRODUCT_HANDOFF_PATHS) {
    const errors = [];
    const onPageError = (e) => errors.push(String(e));
    const onConsole = (m) => { if (m.type() === "error") errors.push(m.text()); };
    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "commit", timeout: 30_000 });
      await page.waitForTimeout(800);
      const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
      const fatal = errors.filter((e) => !IGNORED_CONSOLE.test(e));
      const appLeaked = APP_CHROME.test(body);
      const hasPassword = (await page.locator('input[type="password"]').count()) > 0;
      const hasSidebar = (await page.locator('[data-sidebar], [data-app-shell]').count()) > 0;

      const ok = !appLeaked && !hasPassword && !hasSidebar && fatal.length === 0;
      record(
        `${route} does not render product chrome`,
        ok,
        ok ? "handoff or 404" : [appLeaked && "app chrome leaked", hasPassword && "password input", hasSidebar && "app shell"].filter(Boolean).join(" · ") || fatal[0],
      );
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`\nFailed:\n${failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Critical-page smoke crashed:", err);
  process.exit(1);
});
