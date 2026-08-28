#!/usr/bin/env node
/**
 * End-to-end auth hand-off tests for the marketing host.
 *
 * Everything auth-shaped that touches https://gradr.me must leave for
 * https://app.gradr.me — and the product must never render here. Each case is
 * driven through a real browser with the marketing bundle served under the
 * production hostname (app.gradr.me is stubbed so we stay in the sandbox).
 *
 *   node scripts/e2e-auth-handoff.mjs [baseUrl]
 */
import { launchChromium } from "./lib/browser.mjs";
import {
  APP_ORIGIN,
  APP_ONLY_SELECTORS,
  APP_STUB_MARKER,
  MARKETING_ORIGIN,
  resolveBase,
  serveUnderProductionHosts,
} from "./lib/marketingSurface.mjs";

const BASE = resolveBase();
const failures = [];
const passed = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(name, fn) {
  try {
    await fn();
    passed.push(name);
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`✖ ${name} — ${error.message}`);
  }
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  await serveUnderProductionHosts(context, BASE, [MARKETING_ORIGIN]);

  /** Land on a marketing URL and report where the browser ended up. */
  async function land(path) {
    const page = await context.newPage();
    const hops = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) hops.push(frame.url());
    });
    await page.goto(`${MARKETING_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    return { page, hops, url: page.url() };
  }

  /** The authenticated product must never have rendered on gradr.me. */
  async function assertNoProductUi(page) {
    for (const selector of APP_ONLY_SELECTORS) {
      const count = await page.locator(selector).count();
      assert(count === 0, `product UI "${selector}" rendered on the marketing host`);
    }
  }

  // ------------------------------------------------------------ auth entries
  for (const path of ["/auth", "/auth?mode=signup", "/login", "/signup", "/forgot-password"]) {
    await step(`${path} lands on app.gradr.me`, async () => {
      const { page, url } = await land(path);
      assert(url.startsWith(APP_ORIGIN), `expected app.gradr.me, got ${url}`);
      const stub = await page.locator(`[data-${APP_STUB_MARKER}]`).count();
      assert(stub === 1, "app stub did not render — hand-off did not reach the product");
      await page.close();
    });
  }

  // --------------------------------------------------------- OAuth callbacks
  const CALLBACKS = [
    "/~oauth/callback?code=test-code&state=test-state",
    "/oauth/callback?code=test-code&state=test-state",
    "/auth/callback?code=test-code&state=test-state",
    "/?code=test-code&state=test-state",
  ];
  for (const path of CALLBACKS) {
    await step(`OAuth callback ${path} → app.gradr.me/auth with query intact`, async () => {
      const { page, url } = await land(path);
      const final = new URL(url);
      assert(final.origin === APP_ORIGIN, `expected ${APP_ORIGIN}, got ${final.origin}`);
      assert(final.pathname === "/auth", `expected /auth, got ${final.pathname}`);
      assert(final.searchParams.get("code") === "test-code", "authorization code was dropped");
      assert(final.searchParams.get("state") === "test-state", "state parameter was dropped");
      await page.close();
    });
  }

  await step("implicit-flow hash callback is handed over", async () => {
    const { page, url } = await land("/#access_token=abc123&refresh_token=def456");
    assert(url.startsWith(`${APP_ORIGIN}/auth`), `expected app auth route, got ${url}`);
    assert(url.includes("access_token=abc123"), "token fragment was dropped");
    await page.close();
  });

  // ----------------------------------------- no session is created here
  await step("no Supabase session is written on the marketing origin", async () => {
    const { page } = await land("/~oauth/callback?code=test-code&state=test-state");
    const storage = await context.storageState();
    const marketing = storage.origins.find((o) => o.origin === MARKETING_ORIGIN);
    const authKeys = (marketing?.localStorage ?? []).filter((item) =>
      /^sb-.*-auth-token/.test(item.name),
    );
    assert(authKeys.length === 0, `session written on gradr.me: ${authKeys.map((k) => k.name).join(", ")}`);
    await page.close();
  });

  // ----------------------------------------- the dashboard never renders here
  for (const path of ["/dashboard", "/settings", "/billing", "/interviews", "/resumes", "/profile"]) {
    await step(`${path} never renders the product on gradr.me`, async () => {
      const { page, url } = await land(path);
      await assertNoProductUi(page);
      assert(
        url.startsWith(APP_ORIGIN) || new URL(url).origin === MARKETING_ORIGIN,
        `unexpected destination ${url}`,
      );
      if (new URL(url).origin === MARKETING_ORIGIN) {
        const body = (await page.locator("body").innerText()).toLowerCase();
        assert(
          body.includes("not found") || body.includes("404") || body.includes("redirect"),
          "marketing host served product-shaped content instead of the hand-off/404",
        );
      }
      await page.close();
    });
  }

  // ------------------------------------------------------- CTA-driven signin
  await step("landing 'Sign in' CTA navigates to app.gradr.me", async () => {
    const page = await context.newPage();
    await page.goto(`${MARKETING_ORIGIN}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const cta = page.getByRole("link", { name: /sign in|log in/i }).first();
    const href = await cta.getAttribute("href");
    assert(href?.startsWith(`${APP_ORIGIN}/auth`), `sign-in CTA points at ${href}`);
    await cta.click();
    await page.waitForTimeout(900);
    assert(page.url().startsWith(APP_ORIGIN), `expected app origin, got ${page.url()}`);
    await page.close();
  });
} finally {
  await browser.close();
}

console.log(`\n${passed.length} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  ✖ ${failure}`);
  process.exit(1);
}
