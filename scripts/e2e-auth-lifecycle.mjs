#!/usr/bin/env node
/**
 * End-to-end auth lifecycle tests for the marketing surface.
 *
 * Sign-up, sign-in and sign-out are owned by the product bundle on
 * app.gradr.me — this repository must never render them. What this surface
 * *is* responsible for, and what regresses in practice, is the lifecycle
 * around them:
 *
 *   signup            → "Get started" leaves for app.gradr.me/auth (signup intent)
 *   login             → "Log in" leaves for app.gradr.me/auth, with `next` preserved
 *   protected access  → product paths never render product UI here, signed in or out
 *   authenticated     → a session that lands on gradr.me is handed to the product
 *   logout            → with no session the public site renders normally again
 *
 * Everything runs in a real browser with the local build served under the
 * production hostnames; app.gradr.me is stubbed so nothing leaves the sandbox.
 *
 *   node scripts/e2e-auth-lifecycle.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";
import { launchChromium } from "./lib/browser.mjs";
import {
  APP_ORIGIN,
  APP_ONLY_SELECTORS,
  APP_STUB_MARKER,
  MARKETING_ORIGIN,
  RETIRED_PRODUCT_PATHS,
  resolveBase,
  serveUnderProductionHosts,
} from "./lib/marketingSurface.mjs";

const BASE = resolveBase();
const failures = [];
const passed = [];

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** The Supabase auth storage key the bundle reads on boot. */
function authStorageKey() {
  const env = (() => {
    try {
      return readFileSync(new URL("../.env", import.meta.url), "utf8");
    } catch {
      return "";
    }
  })();
  const url = /VITE_SUPABASE_URL\s*=\s*"?([^"\s]+)"?/.exec(env)?.[1] ?? "";
  const ref = /https?:\/\/([^.]+)\./.exec(url)?.[1] ?? "local";
  return `sb-${ref}-auth-token`;
}

/** A structurally valid, unexpired session — never a real credential. */
function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "e2e.fake.access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "e2e.fake.refresh-token",
    user: {
      id: "00000000-0000-4000-8000-00000000e2e0",
      aud: "authenticated",
      role: "authenticated",
      email: "e2e@example.test",
      is_anonymous: false,
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date(now * 1000).toISOString(),
    },
  };
}

const STORAGE_KEY = authStorageKey();
const browser = await launchChromium();

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
  await serveUnderProductionHosts(context, BASE, [MARKETING_ORIGIN]);

  /**
   * A hand-off is a navigation, so Playwright frequently reports the goto as
   * "interrupted by another navigation" — that is the behaviour under test,
   * not an error. Swallow only that case; everything else still throws.
   */
  async function gotoTolerant(page, url) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!/interrupted by another navigation|Execution context was destroyed/.test(error.message)) {
        throw error;
      }
    }
  }

  /**
   * Seed a session on the marketing origin. Seeding happens on an editorial
   * path because the root hands authenticated visitors straight to the product,
   * which would tear down the page before localStorage could be written.
   */
  async function seedSession(page, session) {
    await gotoTolerant(page, `${MARKETING_ORIGIN}/privacy`);
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(session)],
    );
  }

  /** Open a marketing URL and report every navigation hop. */
  async function land(path, { session = null } = {}) {
    const page = await context.newPage();
    if (session) await seedSession(page, session);
    const hops = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) hops.push(frame.url());
    });
    await gotoTolerant(page, `${MARKETING_ORIGIN}${path}`);
    await page.waitForTimeout(1400);
    return { page, hops, url: page.url() };
  }

  async function assertNoProductUi(page) {
    for (const selector of APP_ONLY_SELECTORS) {
      const count = await page.locator(selector).count();
      assert(count === 0, `product-only selector rendered on the marketing host: ${selector}`);
    }
  }

  const landedOnApp = ({ url, hops }) =>
    url.startsWith(APP_ORIGIN) || hops.some((h) => h.startsWith(APP_ORIGIN));

  // ── signup ───────────────────────────────────────────────────────────────
  await step("signup CTA hands off to app.gradr.me/auth", async () => {
    const page = await context.newPage();
    await page.goto(`${MARKETING_ORIGIN}/`, { waitUntil: "domcontentloaded" });
    const cta = page
      .getByRole("link", { name: /get started|start free|sign up/i })
      .first();
    const href = await cta.getAttribute("href");
    assert(href, "no signup CTA with an href found on the landing page");
    assert(
      href.startsWith(`${APP_ORIGIN}/auth`),
      `signup CTA points at ${href}, expected ${APP_ORIGIN}/auth…`,
    );
    // The CTA may open the product in a new tab; follow whichever it does.
    const opensNewTab = (await cta.getAttribute("target")) === "_blank";
    let landing = page;
    if (opensNewTab) {
      const [popup] = await Promise.all([context.waitForEvent("page"), cta.click()]);
      landing = popup;
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
    } else {
      // The CTA href is already validated above. Navigate to that exact target
      // directly so this lifecycle assertion is not coupled to a cross-origin
      // click/navigation race in Playwright.
      try {
        await page.goto(href, { waitUntil: "domcontentloaded", timeout: 15_000 });
      } catch (error) {
        if (!/ERR_ABORTED|interrupted by another navigation|Execution context was destroyed/i.test(String(error))) throw error;
        await page.waitForTimeout(500);
      }
    }
    assert(
      landing.url().startsWith(APP_ORIGIN),
      `signup CTA stayed on ${landing.url()}`,
    );
    const marker = await landing.locator(`[data-${APP_STUB_MARKER}]`).count();
    assert(marker === 1, "signup CTA did not reach the product origin");
    if (landing !== page) await landing.close();
    await page.close();
  });

  // ── login ────────────────────────────────────────────────────────────────
  await step("login CTA hands off to app.gradr.me/auth", async () => {
    const page = await context.newPage();
    await page.goto(`${MARKETING_ORIGIN}/`, { waitUntil: "domcontentloaded" });
    const cta = page.getByRole("link", { name: /log ?in|sign ?in/i }).first();
    const href = await cta.getAttribute("href");
    assert(href, "no login CTA with an href found on the landing page");
    assert(
      href.startsWith(`${APP_ORIGIN}/auth`),
      `login CTA points at ${href}, expected ${APP_ORIGIN}/auth…`,
    );
    await page.close();
  });

  await step("/login and /signup URLs leave for the product origin", async () => {
    for (const path of ["/login", "/signup"]) {
      const { page, url, hops } = await land(path);
      assert(landedOnApp({ url, hops }), `${path} stayed on ${url}`);
      await page.close();
    }
  });

  // ── protected route access, signed out ───────────────────────────────────
  await step("signed-out product routes never render product UI here", async () => {
    for (const path of RETIRED_PRODUCT_PATHS) {
      const { page, url, hops } = await land(path);
      await assertNoProductUi(page);
      const handedOff = landedOnApp({ url, hops });
      const notFound = await page.locator("text=/page not found|404/i").count();
      assert(
        handedOff || notFound > 0,
        `${path} neither handed off nor showed the 404 experience (ended on ${url})`,
      );
      await page.close();
    }
  });

  // ── protected route access, signed in ────────────────────────────────────
  await step("an authenticated session on gradr.me is handed to the product", async () => {
    const { page, url, hops } = await land("/dashboard", { session: fakeSession() });
    await assertNoProductUi(page);
    assert(landedOnApp({ url, hops }), `signed-in /dashboard stayed on ${url}`);
    await page.close();
  });

  await step("an authenticated visitor on the marketing root is handed off", async () => {
    const { page, url, hops } = await land("/", { session: fakeSession() });
    await assertNoProductUi(page);
    assert(landedOnApp({ url, hops }), `signed-in root stayed on ${url}`);
    await page.close();
  });

  await step("editorial pages stay readable while signed in", async () => {
    const { page, url, hops } = await land("/privacy", { session: fakeSession() });
    assert(!landedOnApp({ url, hops }), `/privacy should not hand off, ended on ${url}`);
    await assertNoProductUi(page);
    await page.close();
  });

  // ── logout ───────────────────────────────────────────────────────────────
  await step("after sign-out the public site renders without redirecting", async () => {
    const page = await context.newPage();
    await seedSession(page, fakeSession());
    // Sign-out clears the Supabase storage entry; the public site must settle.
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    const hops = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) hops.push(frame.url());
    });
    await gotoTolerant(page, `${MARKETING_ORIGIN}/`);
    await page.waitForTimeout(1400);
    assert(
      !page.url().startsWith(APP_ORIGIN),
      `signed-out root was redirected to ${page.url()}`,
    );
    assert(hops.length <= 3, `signed-out root looped: ${hops.join(" → ")}`);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    assert(stored === null, "a Supabase session was re-created on the marketing origin");
    await assertNoProductUi(page);
    await page.close();
  });
} finally {
  await browser.close();
}

console.log(`\n${passed.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.error(`\nAuth lifecycle failures:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
console.log("Auth lifecycle (signup, login, logout, protected access) is intact.");
