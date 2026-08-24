#!/usr/bin/env node
/**
 * Canonical / Open Graph URL gate for the marketing surface (Playwright).
 *
 * Every public page must describe itself with a gradr.me URL — a canonical or
 * og:url pointing at a preview host, or at app.gradr.me, splits the SEO surface
 * and de-indexes the page. At the same time, product CTAs on those pages must
 * stay absolute to app.gradr.me, because no product route exists in this bundle.
 *
 * Runs against a served build (metadata is applied by the SEO layer at runtime),
 * under the production hostname so canonicals resolve exactly as they will live.
 *
 *   node scripts/check-canonical-og.mjs [baseUrl]
 */
import { launchChromium } from "./lib/browser.mjs";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const MARKETING_ORIGIN = "https://gradr.me";
const APP_ORIGIN = "https://app.gradr.me";

/** Public marketing pages and the canonical path each must claim. */
const PAGES = [
  "/",
  "/ats-resume-checker",
  "/ai-interview-coach",
  "/ai-cover-letter-generator",
  "/job-application-tracker",
  "/career-advice",
  "/job-search",
  // /pricing is a hand-off shim to app.gradr.me/pricing, not an indexed page.
  "/privacy",
  "/terms",
];

/** Link paths that only exist on the product — must be absolute app URLs. */
const PRODUCT_PREFIXES = [
  "/auth",
  "/login",
  "/signup",
  "/register",
  "/dashboard",
  "/settings",
  "/billing",
  "/credits",
  "/resume",
  "/match",
  "/jobs",
  "/pipeline",
  "/apply",
  "/interview",
  "/growth",
  "/admin",
  "/onboarding",
  "/welcome",
];

const failures = [];
const browser = await launchChromium();

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Serve the local build under the production hostname so the SEO layer emits
  // the real gradr.me canonicals instead of preview-host ones.
  await context.route(`${MARKETING_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const res = await fetch(`${BASE}${url.pathname}${url.search}`).catch(() => null);
    if (!res) return route.abort();
    route.fulfill({
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "text/html" },
      body: Buffer.from(await res.arrayBuffer()),
    });
  });
  // Never actually leave for the product during the audit.
  await context.route(`${APP_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><body>app</body>" }),
  );

  const page = await context.newPage();

  for (const path of PAGES) {
    await page.goto(`${MARKETING_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    const canonical = await page.getAttribute('link[rel="canonical"]', "href").catch(() => null);
    const ogUrl = await page.getAttribute('meta[property="og:url"]', "content").catch(() => null);

    for (const [label, value] of [
      ["canonical", canonical],
      ["og:url", ogUrl],
    ]) {
      if (!value) {
        failures.push(`${path}: missing ${label}`);
        continue;
      }
      if (!value.startsWith(`${MARKETING_ORIGIN}/`) && value !== MARKETING_ORIGIN) {
        failures.push(`${path}: ${label} is "${value}", expected a ${MARKETING_ORIGIN} URL`);
      }
    }
    if (canonical && ogUrl && canonical !== ogUrl) {
      failures.push(`${path}: canonical "${canonical}" and og:url "${ogUrl}" disagree`);
    }

    // Exactly one canonical tag — duplicates give crawlers conflicting signals.
    const canonicalCount = await page.locator('link[rel="canonical"]').count();
    if (canonicalCount !== 1) failures.push(`${path}: ${canonicalCount} canonical tags, expected 1`);

    // Product CTAs must be absolute app.gradr.me links.
    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("href") ?? ""),
    );
    for (const href of hrefs) {
      if (!href) continue;
      const isProductPath = PRODUCT_PREFIXES.some(
        (p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}?`),
      );
      if (isProductPath) {
        failures.push(`${path}: relative product link "${href}" — must be ${APP_ORIGIN}${href}`);
        continue;
      }
      if (href.startsWith(MARKETING_ORIGIN)) {
        const rest = href.slice(MARKETING_ORIGIN.length) || "/";
        if (PRODUCT_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`) || rest.startsWith(`${p}?`))) {
          failures.push(`${path}: product link on the marketing origin "${href}"`);
        }
      }
    }
    if (!failures.some((f) => f.startsWith(`${path}:`))) {
      console.log(`✓ ${path} → ${canonical}`);
    }
  }

  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} metadata / CTA problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ Canonicals and og:url stay on gradr.me; product CTAs stay absolute to app.gradr.me.");
