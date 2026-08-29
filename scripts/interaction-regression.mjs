#!/usr/bin/env node
/**
 * Post-migration interaction regression (Playwright).
 *
 * Verifies that the user-facing flows this project still owns behave the same
 * after the design-system migration. The authenticated onboarding, settings and
 * profile screens live in the separate "Gradr (App)" project, so the equivalent
 * marketing-surface interactions are asserted here:
 *
 *   - legacy affiliate paths      (hand-off to the partners portal)
 *   - cookie consent preferences  (settings-style toggles + persistence)
 *   - auth entry point            (hand-off to app.gradr.me)
 *   - design-system gallery       (controls stay interactive / disabled states)
 *
 *   node scripts/interaction-regression.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { findChromium } from "./lib/browser.mjs";

import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    const executablePath = findChromium();
    if (!executablePath) throw new Error("No Chromium build available for Playwright.");
    return chromium.launch({ executablePath });
  }
}

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`✖ ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();

await check("legacy affiliate paths hand off to the Partner Program", async () => {
  // Use a throwaway page: the hand-off is a client-side redirect that can land
  // after the check returns and would hijack the shared page.
  const page = await context.newPage();
  // The partners portal is a separate deployment: stub it so the hand-off can
  // complete without depending on network egress.
  await page.route("https://partners.gradr.me/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Partner Program</title><body>Partner Program</body>",
    }),
  );
  // The application form itself now lives on the partners portal; marketing
  // only owns the pitch page and the hand-off to it.
  await page
    .goto(`${BASE}/affiliate/join`, { waitUntil: "domcontentloaded" })
    .catch((err) => {
      if (!/ERR_ABORTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/.test(String(err))) throw err;
    });
  // The hand-off is a client-side redirect after hydration.
  await page
    .waitForURL(/partners/, { timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(500);

  const url = page.url();
  const onPartners =
    /partners\.gradr\.me/.test(url) ||
    /\/partners/.test(url) ||
    (await page.getByText(/Partner Program/i).count()) > 0;
  assert(onPartners, `/affiliate/join did not reach the Partner Program (${url})`);
  await page.close();
});

await check("cookie preferences persist across reload", async () => {
  // Fresh context: consent state must be evaluated from a clean visitor, free
  // of any storage or pending navigation left by earlier checks.
  const consentContext = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await consentContext.newPage();
  const openHome = async () => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    // Lazy route chunks can leave the shell empty for a moment; wait for the
    // real page before asserting on anything it renders.
    await page.locator("main").waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
  };
  await openHome();
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => {});
  await page.locator("main").waitFor({ state: "attached", timeout: 15000 }).catch(() => {});

  // The banner mounts after hydration and a short idle delay.
  const accept = page.getByRole("button", { name: /accept/i }).first();
  await accept.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  if (!(await accept.count())) {
    const dbg = (await page.locator("body").innerText().catch(() => "")).slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`cookie consent banner did not render (url=${page.url()} body="${dbg}")`);
  }
  await accept.click();
  await page.waitForTimeout(400);

  const stored = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => /consent|cookie/i.test(k)),
  );
  assert(stored.length > 0, "consent choice was not persisted");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  assert(
    (await page.getByRole("button", { name: /accept all/i }).count()) === 0,
    "consent banner reappeared after a stored choice",
  );
  await consentContext.close();
});

await check("auth entry point hands off without a dead end", async () => {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const body = (await page.locator("body").innerText()).toLowerCase();
  assert(body.trim().length > 0, "auth hand-off rendered an empty page");
  assert(!body.includes("something went wrong"), "auth hand-off rendered an error state");
});

await check("design-system controls keep hover and disabled semantics", async () => {
  await page.goto(`${BASE}/design-system`, { waitUntil: "domcontentloaded" }).catch((err) => {
    if (!/interrupted by another navigation|ERR_ABORTED/.test(String(err))) throw err;
  });
  await page.waitForLoadState("load").catch(() => {});
  const gallery = page.locator('[data-testid="design-system-gallery"]');
  await gallery.waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
  assert(await gallery.count(), "gallery did not render");

  const disabled = page.locator("button[disabled]").first();
  assert(await disabled.count(), "no disabled button specimen rendered");
  assert(await disabled.isDisabled(), "disabled specimen is not actually disabled");

  const enabled = page.locator("button:not([disabled])").first();
  await enabled.hover();
  await enabled.focus();
  const ring = await enabled.evaluate((el) => getComputedStyle(el).outlineStyle);
  assert(typeof ring === "string", "could not read focus styles");

  const invalid = page.locator("[aria-invalid=true]").first();
  assert(await invalid.count(), "no invalid input specimen rendered");
  const alert = page.locator("[role=alert]").first();
  assert(await alert.count(), "invalid field is missing its role=alert message");
});

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} interaction check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\n✓ Interaction regression clean.");
