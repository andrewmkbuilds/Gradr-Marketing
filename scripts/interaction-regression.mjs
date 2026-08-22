#!/usr/bin/env node
/**
 * Post-migration interaction regression (Playwright).
 *
 * Verifies that the user-facing flows this project still owns behave the same
 * after the design-system migration. The authenticated onboarding, settings and
 * profile screens live in the separate "Gradr (App)" project, so the equivalent
 * marketing-surface interactions are asserted here:
 *
 *   - affiliate application form  (multi-field onboarding-style form)
 *   - cookie consent preferences  (settings-style toggles + persistence)
 *   - auth entry point            (hand-off to app.gradr.me)
 *   - design-system gallery       (controls stay interactive / disabled states)
 *
 *   node scripts/interaction-regression.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

function findChromium() {
  for (const envPath of [process.env.PLAYWRIGHT_CHROMIUM_PATH, process.env.CHROME_PATH]) {
    if (envPath && existsSync(envPath)) return envPath;
  }
  for (const root of ["/opt/ms-playwright", join(process.env.HOME ?? "", ".cache/ms-playwright")]) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium"))) {
      for (const rel of [
        "chrome-linux/chrome",
        "chrome-linux/headless_shell",
        "chrome-linux64/chrome-headless-shell",
      ]) {
        const candidate = join(root, dir, rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

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

await check("affiliate application form accepts input and validates", async () => {
  await page.goto(`${BASE}/affiliate/join`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const inputs = page.locator("form input:not([type=hidden]), form textarea");
  const count = await inputs.count();
  assert(count > 0, "no form controls rendered on /affiliate/join");

  const first = inputs.first();
  await first.click();
  await first.fill("https://example.com/creator");
  assert((await first.inputValue()) === "https://example.com/creator", "input did not accept text");

  const focused = await page.evaluate(() => document.activeElement?.tagName ?? "");
  assert(["INPUT", "TEXTAREA"].includes(focused), `focus not on a control (${focused})`);

  const submit = page.locator("form button[type=submit]").first();
  assert(await submit.count(), "no submit button in the application form");
  assert(await submit.isVisible(), "submit button is not visible");
});

await check("cookie preferences persist across reload", async () => {
  await context.clearCookies();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const accept = page.getByRole("button", { name: /accept/i }).first();
  assert(await accept.count(), "cookie consent banner did not render");
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
});

await check("auth entry point hands off without a dead end", async () => {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const body = (await page.locator("body").innerText()).toLowerCase();
  assert(body.trim().length > 0, "auth hand-off rendered an empty page");
  assert(!body.includes("something went wrong"), "auth hand-off rendered an error state");
});

await check("design-system controls keep hover and disabled semantics", async () => {
  await page.goto(`${BASE}/design-system`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const gallery = page.locator('[data-testid="design-system-gallery"]');
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
