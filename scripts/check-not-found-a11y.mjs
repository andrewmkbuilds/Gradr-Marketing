#!/usr/bin/env node
/**
 * 404 accessibility gate (Playwright + axe-core).
 *
 * The 404 is the one page every visitor can reach by accident, including
 * people arriving from a screen reader's link list, so it gets its own gate
 * rather than riding along with the nav audit. Checks:
 *
 *   1. axe-core finds no serious/critical violations (online and offline).
 *   2. Heading order: exactly one h1, no skipped levels.
 *   3. Every link and button has an accessible name (no icon-only dead ends).
 *   4. Every interactive element shows a visible focus indicator when tabbed
 *      to — outline, box-shadow ring or a changed outline colour.
 *   5. The offline state announces itself (live region) and the retry control
 *      is labelled.
 *
 * Usage:
 *   node scripts/check-not-found-a11y.mjs [baseUrl]
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { launchChromium } from "./lib/browser.mjs";

const require = createRequire(import.meta.url);
const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BLOCKING = new Set(["serious", "critical"]);
const MISS_PATH = "/this-page-does-not-exist";

const failures = [];
const notes = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
const page = await context.newPage();

async function runAxe(scope) {
  await page.addScriptTag({ content: AXE_SOURCE });
  const results = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    window.axe.run(document, {
      resultTypes: ["violations"],
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    }),
  );
  for (const violation of results.violations) {
    const targets = violation.nodes.map((n) => n.target.join(" ")).join(", ");
    const line = `${violation.id} (${violation.impact}) — ${violation.nodes.length} node(s): ${violation.help} [${targets}]`;
    if (BLOCKING.has(violation.impact)) fail(scope, line);
    else notes.push(`${scope}: ${line}`);
  }
}

/* ---------------------------------------------------------------- 1. online */
await page.goto(`${BASE}${MISS_PATH}`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-page="not-found"]', { timeout: 15_000 });

await runAxe("online");

/* ------------------------------------------------------- 2. heading order */
const headings = await page.$$eval("h1, h2, h3, h4, h5, h6", (nodes) =>
  nodes
    .filter((node) => (node.textContent ?? "").trim().length > 0)
    .map((node) => ({ level: Number(node.tagName.slice(1)), text: (node.textContent ?? "").trim() })),
);
const h1s = headings.filter((h) => h.level === 1);
if (h1s.length !== 1) fail("headings", `expected exactly one h1, found ${h1s.length}`);
for (let i = 1; i < headings.length; i += 1) {
  const jump = headings[i].level - headings[i - 1].level;
  if (jump > 1) {
    fail(
      "headings",
      `level skipped: h${headings[i - 1].level} "${headings[i - 1].text}" → h${headings[i].level} "${headings[i].text}"`,
    );
  }
}

/* --------------------------------------------------- 3. accessible names */
const unnamed = await page.$$eval("a[href], button", (nodes) =>
  nodes
    .filter((node) => {
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const name = (
        node.getAttribute("aria-label") ??
        node.getAttribute("title") ??
        node.textContent ??
        ""
      ).trim();
      return name.length === 0;
    })
    .map((node) => `${node.tagName.toLowerCase()}[${node.getAttribute("href") ?? "button"}]`),
);
for (const node of unnamed) fail("names", `interactive element without an accessible name: ${node}`);

/* --------------------------------------------------- 4. focus indicators */
const focusReport = await page.$$eval('[data-page="not-found"] a[href], [data-page="not-found"] button', (nodes) =>
  nodes.slice(0, 24).map((node) => {
    const before = window.getComputedStyle(node);
    const baseline = {
      outlineWidth: before.outlineWidth,
      outlineStyle: before.outlineStyle,
      boxShadow: before.boxShadow,
    };
    node.focus();
    const after = window.getComputedStyle(node);
    const changed =
      after.outlineStyle !== baseline.outlineStyle ||
      after.outlineWidth !== baseline.outlineWidth ||
      after.boxShadow !== baseline.boxShadow;
    const label = (node.getAttribute("aria-label") ?? node.textContent ?? "").trim().slice(0, 40);
    node.blur();
    return { label, changed };
  }),
);
for (const item of focusReport) {
  if (!item.changed) fail("focus", `no visible focus indicator on "${item.label || "(unnamed)"}"`);
}

/* ------------------------------------------------------------- 5. offline */
await context.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event("offline")));
await page.waitForSelector('[data-testid="not-found-offline"]', { timeout: 10_000 }).catch(() => {
  fail("offline", "offline notice never rendered after the offline event");
});

const liveRegions = await page.locator('[data-testid="not-found-offline"] [aria-live]').count();
if (liveRegions === 0) fail("offline", "retry result is not announced (no aria-live region)");

const retry = page.getByRole("button", { name: /retry/i });
if ((await retry.count()) === 0) fail("offline", "no accessible retry button while offline");

// Let the offline banner finish its fade-in; axe measures contrast on the
// composited pixels and a mid-animation opacity reads as a false positive.
await page.waitForTimeout(1200);
await runAxe("offline");
await context.setOffline(false);

await browser.close();

for (const note of notes) console.log(`note  ${note}`);
if (failures.length > 0) {
  console.error(`\n404 accessibility gate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`404 accessibility gate passed (${headings.length} headings, ${focusReport.length} focusable checked).`);
