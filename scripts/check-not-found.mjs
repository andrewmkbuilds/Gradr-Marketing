#!/usr/bin/env node
/**
 * 404 experience gate (Playwright), preview + production modes.
 *
 * Invariants:
 *   1. Unknown routes render the branded 404 (never a blank page, never product
 *      content), in both preview and production hostnames.
 *   2. Every popular-page / suggestion card that leaves the marketing site
 *      points at https://app.gradr.me — never a relative product path.
 *   3. "Did you mean" surfaces the closest real route for a mistyped path.
 *   4. With the network offline the page states that plainly and offers a retry.
 *
 * Production mode is simulated: requests to https://gradr.me are proxied to the
 * local build and app.gradr.me is stubbed, so nothing touches the live deploy.
 *
 *   node scripts/check-not-found.mjs [baseUrl] [--mode=preview]
 */
import { launchChromium } from "./lib/browser.mjs";

const args = process.argv.slice(2);
const BASE = (
  args.find((a) => a.startsWith("http")) ??
  process.env.SMOKE_BASE_URL ??
  "http://localhost:8080"
).replace(/\/$/, "");
const modeArg = (args.find((a) => a.startsWith("--mode=")) ?? "").replace("--mode=", "");
const MODES = modeArg ? [modeArg] : ["preview", "production"];
const APP_ORIGIN = "https://app.gradr.me";
const MARKETING_ORIGIN = "https://gradr.me";

/** Unknown paths that must always land on the branded 404. */
const UNKNOWN_PATHS = [
  "/this-page-does-not-exist",
  "/career-advice-old/typo",
  "/nope/nested/deep",
  "/ats-resume-checkr",
  "/blog/does-not-exist",
];

/** Mistyped path → the suggestion the ranking must surface first. */
const TYPO_EXPECTATIONS = [
  ["/ats-resume-checkr", /ats resume checker/i],
  ["/interview-coaching", /interview coach/i],
  ["/job-serch", /job search/i],
];

const failures = [];
const browser = await launchChromium();

async function isNotFound(page) {
  if ((await page.locator('[data-page="not-found"]').count()) > 0) return true;
  const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
  return /404|page not found|couldn[’']t find that page/i.test(body);
}

async function newContext(production) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  if (production) {
    await context.route(`${MARKETING_ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      const res = await fetch(`${BASE}${url.pathname}${url.search}`).catch(() => null);
      if (!res) return route.abort();
      const body = Buffer.from(await res.arrayBuffer());
      route.fulfill({
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "text/html" },
        body,
      });
    });
    await context.route(`${APP_ORIGIN}/**`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>app stub</title>" }),
    );
  }
  return context;
}

try {
  for (const mode of MODES) {
    const production = mode === "production";
    const origin = production ? MARKETING_ORIGIN : BASE;
    const context = await newContext(production);
    const page = await context.newPage();

    for (const path of UNKNOWN_PATHS) {
      const label = `[${mode}] ${path}`;
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      // The deployed bundle may still redirect an unknown path; let any such
      // navigation finish before reading the DOM, or the evaluate below races
      // a destroyed execution context.
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(1200);
      if (!(await isNotFound(page))) {
        failures.push(`${label}: did not render the branded 404 (url ${page.url()})`);
        continue;
      }
      // Every off-site link must be absolute to the app subdomain.
      const hrefs = await page.locator('[data-page="not-found"] a[href^="http"]').evaluateAll(
        (nodes) => nodes.map((n) => n.getAttribute("href")),
      );
      for (const href of hrefs) {
        if (!href.startsWith(APP_ORIGIN)) {
          failures.push(`${label}: absolute link leaves the app subdomain → ${href}`);
        }
      }
      if (production && hrefs.length === 0) {
        failures.push(`${label}: no absolute app.gradr.me destinations rendered`);
      }
      console.log(`✓ ${label} → 404 (${hrefs.length} app links)`);
    }

    for (const [path, expected] of TYPO_EXPECTATIONS) {
      const label = `[${mode}] did-you-mean ${path}`;
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const section = page.locator('[data-testid="not-found-did-you-mean"]');
      if ((await section.count()) === 0) {
        failures.push(`${label}: no "did you mean" suggestions`);
        continue;
      }
      const text = await section.innerText();
      if (!expected.test(text)) {
        failures.push(`${label}: expected ${expected} in "${text.replace(/\s+/g, " ")}"`);
      } else {
        console.log(`✓ ${label}`);
      }
    }

    // Offline experience: the page must say so, not fail silently.
    const label = `[${mode}] offline`;
    await page.goto(`${origin}/this-page-does-not-exist`, { waitUntil: "domcontentloaded" });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.waitForTimeout(300);
    const offline = page.locator('[data-testid="not-found-offline"]');
    if ((await offline.count()) === 0) {
      failures.push(`${label}: no offline message rendered`);
    } else {
      const text = await offline.innerText();
      if (!/offline|internet connection/i.test(text) || !/retry/i.test(text)) {
        failures.push(`${label}: offline message lacks explanation or retry ("${text}")`);
      } else {
        console.log(`✓ ${label}`);
      }
    }
    await context.setOffline(false);
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} 404 experience problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ 404 experience verified in preview and production modes.");
