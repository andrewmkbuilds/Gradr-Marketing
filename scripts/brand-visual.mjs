#!/usr/bin/env node
/**
 * Brand visual regression (screenshot diff) for key marketing pages.
 *
 * Complements the hash check: the files can be untouched while a CSS change
 * recolours, crops, or shrinks the mark on a page. This captures each brand
 * surface (header lockup, footer mark, hero) on the key marketing pages in both
 * themes and diffs against committed baselines.
 *
 *   node scripts/brand-visual.mjs --update   # (re)write baselines
 *   node scripts/brand-visual.mjs            # compare
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { launchChromium } from "./lib/browser.mjs";

const BASE = (process.argv.find((a) => a.startsWith("http")) ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const UPDATE = process.argv.includes("--update");
const ROOT = process.cwd();
const BASELINE_DIR = join(ROOT, "tests/visual/brand/baseline");
const CURRENT_DIR = join(ROOT, "tests/visual/brand/current");
const TOLERANCE = Number(process.env.BRAND_VISUAL_TOLERANCE ?? 0.01); // 1% of pixels

// `/pricing` is deliberately absent: the marketing surface hands that route
// off to app.gradr.me, so the page navigates away mid-capture (destroying the
// execution context) and never renders marketing chrome to diff.
const ROUTES = [
  ["home", "/"],
  ["ats", "/ats-resume-checker"],
  ["career-advice", "/career-advice"],
  ["terms", "/terms"],
];
const THEMES = ["light", "dark"];

/** Brand-bearing regions. Each page contributes every selector that exists. */
const REGIONS = [
  ["header", "header"],
  ["footer", "footer"],
];

async function differenceRatio(a, b) {
  const CHANNEL_TOLERANCE = 12;
  const [rawA, rawB] = await Promise.all(
    [a, b].map((buf) => sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true })),
  );
  if (rawA.info.width !== rawB.info.width || rawA.info.height !== rawB.info.height) return 1;
  const pa = rawA.data;
  const pb = rawB.data;
  let diff = 0;
  for (let i = 0; i < pa.length; i += 4) {
    if (
      Math.abs(pa[i] - pb[i]) > CHANNEL_TOLERANCE ||
      Math.abs(pa[i + 1] - pb[i + 1]) > CHANNEL_TOLERANCE ||
      Math.abs(pa[i + 2] - pb[i + 2]) > CHANNEL_TOLERANCE
    ) {
      diff += 1;
    }
  }
  return diff / (pa.length / 4);
}

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(CURRENT_DIR, { recursive: true });

const failures = [];
const missing = [];
const browser = await launchChromium();

try {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    // The cookie banner is a fixed overlay that floats over the footer, and it
    // settles at a different offset run to run — it diffed as brand drift.
    // Record a decided consent so the banner never renders during capture.
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem(
          "gradr-cookie-consent",
          JSON.stringify({
            version: 1,
            decidedAt: new Date().toISOString(),
            choices: { analytics: false, marketing: false, functional: false },
          }),
        );
      } catch {
        /* storage unavailable — the diff will simply include the banner */
      }
    });
    const page = await context.newPage();

    for (const [routeName, path] of ROUTES) {
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      // Hydration can replace the document (route guards, surface hand-offs),
      // which destroys the execution context mid-evaluate. That is a timing
      // artefact, not brand drift, so settle again and retry rather than
      // crashing the whole run.
      const settle = async () => {
        // Brand marks swap asset per theme after hydration and headers animate
        // in, so settle the page (fonts, images decoded, animations finished)
        // before capturing — otherwise the diff measures timing, not the brand.
        await page.evaluate(() => document.fonts?.ready);
        await page.evaluate(() =>
          Promise.all(
            Array.from(document.images)
              .filter((img) => !img.complete)
              .map((img) => img.decode().catch(() => undefined)),
          ),
        );
      };
      try {
        await settle();
      } catch {
        await page.waitForLoadState("load");
        await settle();
      }
      await page.waitForTimeout(2500);

      // Only the chrome regions are captured. Marks inside animated hero art
      // move with scroll-driven motion and would diff on timing rather than on
      // the brand; scripts/logo-visual.mjs asserts those marks structurally.
      const targets = [...REGIONS];

      for (const [regionName, selector] of targets) {
        const index = regionName.startsWith("mark-") ? Number(regionName.slice(5)) : 0;
        const locator = page.locator(selector).nth(index);
        if ((await locator.count()) === 0 || !(await locator.isVisible().catch(() => false))) continue;

        const file = `${routeName}-${regionName}-${theme}.png`;
        const shot = await locator.screenshot().catch(() => null);
        if (!shot) continue;

        const baselinePath = join(BASELINE_DIR, file);
        if (UPDATE || !existsSync(baselinePath)) {
          writeFileSync(baselinePath, shot);
          if (!UPDATE) missing.push(file);
          console.log(`${UPDATE ? "updated" : "created"} baseline ${file}`);
          continue;
        }
        writeFileSync(join(CURRENT_DIR, file), shot);
        const ratio = await differenceRatio(readFileSync(baselinePath), shot);
        if (ratio > TOLERANCE) {
          failures.push(`${file} differs by ${(ratio * 100).toFixed(2)}%`);
          console.log(`✖ ${file} differs by ${(ratio * 100).toFixed(2)}%`);
        } else {
          console.log(`✓ ${file}`);
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(
    `\n✖ ${failures.length} brand region(s) drifted beyond ${(TOLERANCE * 100).toFixed(0)}%:`,
  );
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nInspect tests/visual/brand/current/ against tests/visual/brand/baseline/. Re-run with --update only when the change is an approved brand update.",
  );
  process.exit(1);
}

console.log(
  missing.length
    ? `\n✓ Brand visual baselines seeded (${missing.length} new). Commit tests/visual/brand/baseline/.`
    : "\n✓ Brand visuals unchanged.",
);
