#!/usr/bin/env node
/**
 * Visual regression suite.
 *
 * Captures every public route at three widths and diffs each capture against a
 * committed baseline, so design-system drift (old surfaces, stray palettes,
 * broken spacing) is caught before it ships.
 *
 * Baselines live in tests/visual/baseline/. Diffs are written to
 * tests/visual/diff/ for inspection.
 *
 *   node scripts/visual-regression.mjs --update   # (re)write baselines
 *   node scripts/visual-regression.mjs            # compare against baselines
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const UPDATE = process.argv.includes("--update");
const ROOT = process.cwd();
const BASELINE_DIR = join(ROOT, "tests/visual/baseline");
const CURRENT_DIR = join(ROOT, "tests/visual/current");
const DIFF_TOLERANCE = Number(process.env.VISUAL_TOLERANCE ?? 0.03); // 3% of pixels

const ROUTES = [
  ["landing", "/landing"],
  ["design-system", "/design-system"],
  ["pricing", "/pricing"],
  ["auth", "/auth"],
  ["job-search", "/job-search"],
  ["ats", "/ats-resume-checker"],
  ["career-advice", "/career-advice"],
  ["privacy", "/privacy"],
  ["notfound", "/this-route-does-not-exist"],
];

const ALL_VIEWPORTS = [
  ["mobile", 390, 844],
  ["tablet", 834, 1112],
  ["desktop", 1440, 900],
];

// `--viewports=mobile,tablet` narrows the run to specific breakpoints so CI can
// gate small-screen layout separately from the slower full sweep.
const viewportFilter = (process.argv.find((a) => a.startsWith("--viewports=")) ?? "")
  .replace("--viewports=", "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const VIEWPORTS = viewportFilter.length
  ? ALL_VIEWPORTS.filter(([name]) => viewportFilter.includes(name))
  : ALL_VIEWPORTS;

if (!VIEWPORTS.length) {
  console.error(`No viewports matched "${viewportFilter.join(",")}". Known: mobile, tablet, desktop.`);
  process.exit(1);
}

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

/** Coarse byte-level difference ratio — enough to catch layout/palette drift. */
function differenceRatio(a, b) {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff / a.length;
}

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(CURRENT_DIR, { recursive: true });

const failures = [];
const browser = await launch();
try {
  for (const [vpName, width, height] of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: "light",
      reducedMotion: "reduce", // deterministic captures
    });
    const page = await context.newPage();
    for (const [name, path] of ROUTES) {
      const file = `${name}-${vpName}.png`;
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const shot = await page.screenshot();

      const baselinePath = join(BASELINE_DIR, file);
      if (UPDATE || !existsSync(baselinePath)) {
        writeFileSync(baselinePath, shot);
        console.log(`${UPDATE ? "updated" : "created"} baseline ${file}`);
        continue;
      }
      writeFileSync(join(CURRENT_DIR, file), shot);
      const ratio = differenceRatio(readFileSync(baselinePath), shot);
      if (ratio > DIFF_TOLERANCE) {
        failures.push({ file, ratio });
        console.log(`✖ ${file} differs by ${(ratio * 100).toFixed(1)}%`);
      } else {
        console.log(`✓ ${file}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(
    `\n${failures.length} route(s) drifted beyond ${(DIFF_TOLERANCE * 100).toFixed(0)}%. ` +
      `Inspect tests/visual/current/ against tests/visual/baseline/, then re-run with --update once the change is intended.`,
  );
  process.exit(1);
}

console.log("\n✓ Visual regression clean.");
