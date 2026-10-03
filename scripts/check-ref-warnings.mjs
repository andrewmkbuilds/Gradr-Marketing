#!/usr/bin/env node
/**
 * React ref-warning gate.
 *
 * "Warning: Function components cannot be given refs" is the one console
 * warning class we knowingly carry (the dev-only lovable-tagger plugin attaches
 * a callback ref to every JSX element). This gate walks the marketing surface,
 * collects only those warnings, and fails when a fingerprint appears that is
 * not already accepted in tests/console/baseline.json — so a genuine ref bug in
 * app code can never hide inside the known noise.
 *
 *   node scripts/check-ref-warnings.mjs [baseUrl]
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { launchChromium } from "./lib/browser.mjs";
import {
  INDEXABLE_PAGES,
  MARKETING_ORIGIN,
  NOINDEX_PAGES,
  resolveBase,
  serveUnderProductionHosts,
} from "./lib/marketingSurface.mjs";

const BASE = resolveBase();
const BASELINE_PATH = join(process.cwd(), "tests/console/baseline.json");
const REF_WARNING = /cannot be given refs|Function components cannot be given refs/i;

/** Same normalisation as scripts/check-console-errors.mjs so keys line up. */
function fingerprint(text) {
  return text
    .replace(/https?:\/\/[^\s"')]+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hash>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

const baseline = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")).allowed ?? [])
  : [];
const allowed = new Set(baseline.filter((b) => REF_WARNING.test(b.sample ?? b.key)).map((b) => b.key));

const found = new Map(); // key -> { sample, pages:Set }
let currentPath = "(startup)";

function record(kind, text) {
  if (!text || !REF_WARNING.test(text)) return;
  const key = `${kind}: ${fingerprint(text)}`;
  const entry = found.get(key) ?? { sample: text.slice(0, 300), pages: new Set() };
  entry.pages.add(currentPath);
  found.set(key, entry);
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  await serveUnderProductionHosts(context, BASE);
  await context.route("**/functions/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") record("console.error", msg.text());
    if (msg.type() === "warning") record("react.warning", msg.text());
  });
  page.on("pageerror", (err) => record("pageerror", `${err.name}: ${err.message}`));

  for (const path of [...INDEXABLE_PAGES, ...NOINDEX_PAGES]) {
    currentPath = path;
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(700);
    await page
      .evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 50));
        }
        window.scrollTo(0, 0);
      })
      .catch((err) => {
        if (!/Execution context was destroyed|Target closed/i.test(String(err))) throw err;
      });
  }

  await context.close();
} finally {
  await browser.close();
}

const introduced = [...found.entries()].filter(([key]) => !allowed.has(key));

console.log(
  `Ref warnings: ${found.size} fingerprint(s) observed, ${allowed.size} accepted in baseline.json.`,
);

if (introduced.length) {
  console.error(`\n✖ ${introduced.length} new React ref warning(s) beyond the baseline:`);
  for (const [key, value] of introduced) {
    console.error(`  - ${key}`);
    console.error(`      ${value.sample}`);
    console.error(`      pages: ${[...value.pages].sort().join(", ")}`);
  }
  console.error(
    "\nForward the ref (React.forwardRef) on the offending component, or — if the warning is\n" +
      "genuinely external noise — re-baseline with: node scripts/check-console-errors.mjs --update",
  );
  process.exit(1);
}

console.log("✓ No new React ref warnings.");
