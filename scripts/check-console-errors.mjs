#!/usr/bin/env node
/**
 * Console / runtime error gate for the marketing surface.
 *
 * Walks every public page (plus a few interactions: theme toggle, nav, the
 * newsletter form) and records console errors, uncaught exceptions, and failed
 * same-origin requests. Findings are normalised into stable fingerprints and
 * compared against tests/console/baseline.json — the build fails on anything
 * new, so an end-to-end run can never quietly introduce a runtime error.
 *
 *   node scripts/check-console-errors.mjs [baseUrl]
 *   node scripts/check-console-errors.mjs --update   # accept current findings
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { launchChromium } from "./lib/browser.mjs";
import {
  INDEXABLE_PAGES,
  MARKETING_ORIGIN,
  NOINDEX_PAGES,
  resolveBase,
  serveUnderProductionHosts,
} from "./lib/marketingSurface.mjs";

const BASE = resolveBase();
const UPDATE = process.argv.includes("--update");
const BASELINE_PATH = join(process.cwd(), "tests/console/baseline.json");

/** Noise that is not the app's fault and cannot be fixed from this codebase. */
const IGNORE_PATTERNS = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /net::ERR_ABORTED/i,
  /ResizeObserver loop/i,
];

/** Collapse volatile parts (URLs, ids, numbers) so fingerprints stay stable. */
function fingerprint(text) {
  return text
    .replace(/https?:\/\/[^\s"')]+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hash>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

const findings = new Map(); // fingerprint -> { kind, sample, pages:Set }

function record(kind, text, page) {
  if (!text) return;
  if (IGNORE_PATTERNS.some((re) => re.test(text))) return;
  const key = `${kind}: ${fingerprint(text)}`;
  const entry = findings.get(key) ?? { kind, sample: text.slice(0, 300), pages: new Set() };
  entry.pages.add(page);
  findings.set(key, entry);
}

const browser = await launchChromium();
let currentPath = "(startup)";
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  await serveUnderProductionHosts(context, BASE);
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") record("console.error", msg.text(), currentPath);
    if (msg.type() === "warning" && /React|Warning:/i.test(msg.text())) {
      record("react.warning", msg.text(), currentPath);
    }
  });
  page.on("pageerror", (err) => record("pageerror", `${err.name}: ${err.message}`, currentPath));
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(MARKETING_ORIGIN)) {
      record("requestfailed", `${req.url()} ${req.failure()?.errorText ?? ""}`, currentPath);
    }
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().startsWith(MARKETING_ORIGIN)) {
      record("http", `${res.status()} ${res.url()}`, currentPath);
    }
  });

  // Keep backend calls deterministic — the gate is about client runtime errors.
  await context.route("**/functions/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );

  for (const path of [...INDEXABLE_PAGES, ...NOINDEX_PAGES, "/this-route-does-not-exist"]) {
    currentPath = path;
    await page.goto(`${MARKETING_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    // Scroll the full page so lazy sections, reveals and observers all run.
    // Some routes redirect on mount, which tears the execution context down
    // mid-scroll — that is not a runtime error, so it must not abort the gate.
    await page
      .evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      })
      .catch((err) => {
        if (!/Execution context was destroyed|Target closed/i.test(String(err))) throw err;
      });
    await page.waitForTimeout(300);

  }

  // Interactions: theme toggle and the newsletter form on the landing page.
  currentPath = "/ (interactions)";
  await page.goto(`${MARKETING_ORIGIN}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme" i]').first();
  if (await themeToggle.count()) {
    await themeToggle.click().catch(() => {});
    await page.waitForTimeout(400);
    await themeToggle.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const email = page.locator('input[type="email"]').first();
  if (await email.count()) {
    await email.fill("ci-console-check@example.com").catch(() => {});
    await page.locator('form button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(800);
  }

  await context.close();
} finally {
  await browser.close();
}

const current = [...findings.entries()]
  .map(([key, value]) => ({ key, kind: value.kind, sample: value.sample, pages: [...value.pages].sort() }))
  .sort((a, b) => a.key.localeCompare(b.key));

if (UPDATE) {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ allowed: current }, null, 2)}\n`);
  console.log(`Baseline written with ${current.length} accepted finding(s) → tests/console/baseline.json`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")).allowed ?? []
  : [];
const allowed = new Set(baseline.map((b) => b.key));
const introduced = current.filter((f) => !allowed.has(f.key));
const resolved = baseline.filter((b) => !current.some((f) => f.key === b.key));

for (const f of current.filter((f) => allowed.has(f.key))) console.log(`· known ${f.key}`);
for (const r of resolved) console.log(`✓ resolved (still baselined): ${r.key}`);

if (introduced.length) {
  console.error(`\n✖ ${introduced.length} new console / runtime error(s) on marketing pages:`);
  for (const f of introduced) {
    console.error(`  - [${f.kind}] ${f.sample}`);
    console.error(`      pages: ${f.pages.join(", ")}`);
  }
  console.error(
    "\nFix the error, or — if it is genuinely acceptable — re-run with --update to move the baseline.",
  );
  process.exit(1);
}

console.log(`\n✓ No new console or runtime errors (${current.length} known finding(s)).`);
