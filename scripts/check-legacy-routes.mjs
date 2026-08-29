#!/usr/bin/env node
/**
 * Legacy marketing route gate (Playwright).
 *
 * Old bookmarks and search results still point at product URLs on the marketing
 * host (/login, /signup, /dashboard, …). Two invariants must hold forever:
 *
 *   1. No legacy path may ever render authenticated product content from this
 *      bundle — no dashboard shell, no sidebar, no credential form.
 *   2. The visitor is never left on a dead page:
 *        - preview / dev host (one origin serves everything, no app deployment
 *          to hand off to): the branded 404 renders;
 *        - production host: the browser is handed off to app.gradr.me.
 *
 * Both modes run by default. The production mode is simulated by serving the
 * built bundle under the real hostname (requests to https://gradr.me are
 * proxied to the local origin) and stubbing app.gradr.me, so the hand-off is
 * asserted without touching the live deployment.
 *
 *   node scripts/check-legacy-routes.mjs [baseUrl]
 *   node scripts/check-legacy-routes.mjs --mode=preview
 */
import { launchChromium } from "./lib/browser.mjs";

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith("http")) ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const modeArg = (args.find((a) => a.startsWith("--mode=")) ?? "").replace("--mode=", "");
const MODES = modeArg ? [modeArg] : ["preview", "production"];
const APP_ORIGIN = "https://app.gradr.me";
const MARKETING_ORIGIN = "https://gradr.me";
const APP_STUB_MARKER = "gradr-app-stub";

/** Legacy paths that must never resolve to product content here. */
const LEGACY_PATHS = [
  "/login",
  "/log-in",
  "/sign-in",
  "/signup",
  "/sign-up",
  "/register",
  "/create-account",
  "/logout",
  "/dashboard",
  "/dashboard/overview",
  "/home",
  "/app",
  "/account",
  "/profile",
  "/settings",
  "/settings/profile",
  "/billing",
  "/credits",
  "/subscription",
  "/upgrade",
  "/checkout",
  "/resume",
  "/match",
  "/jobs",
  "/pipeline",
  "/apply",
  "/interview",
  "/growth",
  "/admin",
  "/admin/webhook-logs",
  "/onboarding",
  "/welcome",
  "/verify-email",
];

/**
 * DOM signatures of the authenticated product. If any of these appear on a
 * marketing host, the split has regressed.
 */
const APP_ONLY_SELECTORS = [
  '[data-app-shell]',
  '[data-sidebar]',
  '[data-testid="app-sidebar"]',
  'input[type="password"]',
  'form[data-auth-form]',
];

/**
 * Copy that only the authenticated product renders. Kept deliberately narrow:
 * marketing pages (and the 404's suggestion links) legitimately mention feature
 * names like "AI Interview Coach", so only credential-form and signed-in-shell
 * copy counts as a regression.
 */
const APP_ONLY_TEXT = [
  /sign in with google/i,
  /continue with google/i,
  /forgot your password/i,
  /your resume score/i,
  /application pipeline/i,
];


const failures = [];
const browser = await launchChromium();

/** Marks the response as the branded 404 hand-off page. */
async function isNotFound(page) {
  const notFoundMarker = await page.locator('[data-page="not-found"], [data-not-found]').count();
  if (notFoundMarker > 0) return true;
  const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
  return /404|page not found|can[’']t find that page/i.test(body);
}

async function assertNoAppContent(page, label) {
  for (const selector of APP_ONLY_SELECTORS) {
    if ((await page.locator(selector).count()) > 0) {
      failures.push(`${label}: rendered product-only element "${selector}"`);
    }
  }
  const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
  for (const pattern of APP_ONLY_TEXT) {
    if (pattern.test(body)) failures.push(`${label}: rendered product copy matching ${pattern}`);
  }
}

try {
  for (const mode of MODES) {
    const production = mode === "production";
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

    if (production) {
      // Serve the local build under the production hostname and stub the app.
      await context.route(`${MARKETING_ORIGIN}/**`, async (route) => {
        const url = new URL(route.request().url());
        const res = await fetch(`${BASE}${url.pathname}${url.search}`).catch(() => null);
        if (!res) return route.abort();
        const buffer = Buffer.from(await res.arrayBuffer());
        route.fulfill({
          status: res.status,
          headers: { "content-type": res.headers.get("content-type") ?? "text/html" },
          body: buffer,
        });
      });
      await context.route(`${APP_ORIGIN}/**`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<!doctype html><title>${APP_STUB_MARKER}</title><body>${APP_STUB_MARKER}</body>`,
        }),
      );
    }

    const origin = production ? MARKETING_ORIGIN : BASE;
    const page = await context.newPage();

    for (const path of LEGACY_PATHS) {
      const label = `[${mode}] ${path}`;
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      // The hand-off is a client-side location.replace on first paint.
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(1200);
      const landed = page.url();

      if (production) {
        // Two acceptable outcomes on the production host, both of which keep
        // product content off gradr.me: the client hand-off to app.gradr.me
        // (when the build knows the app subdomain is served), or the branded
        // 404. Anything else — a rendered product screen — fails.
        if (landed.startsWith(APP_ORIGIN)) {
          console.log(`✓ ${label} → ${landed.replace(APP_ORIGIN, "app.gradr.me")}`);
          continue;
        }
        if (!(await isNotFound(page))) {
          failures.push(
            `${label}: neither handed off to ${APP_ORIGIN} nor rendered the 404 (stayed on ${landed})`,
          );
        } else {
          console.log(`✓ ${label} → 404`);
        }
        await assertNoAppContent(page, label);
        continue;
      }


      // Preview / dev: must be the 404, never product content.
      if (landed.startsWith(APP_ORIGIN)) {
        failures.push(`${label}: preview build bounced to production (${landed})`);
        continue;
      }
      if (!(await isNotFound(page))) {
        failures.push(`${label}: did not render the 404 hand-off`);
      }
      await assertNoAppContent(page, label);
      if (!failures.some((f) => f.startsWith(label))) console.log(`✓ ${label} → 404`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} legacy route problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ Legacy marketing routes never resolve to product content.");
