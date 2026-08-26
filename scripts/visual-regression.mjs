#!/usr/bin/env node
/**
 * Visual regression suite.
 *
 * Captures every public route at three widths, in both light and dark mode,
 * and diffs each capture against a committed baseline, so design-system drift
 * (old surfaces, stray palettes, broken spacing) is caught before it ships.
 *
 * Baselines live in tests/visual/baseline/. Diffs are written to
 * tests/visual/diff/ for inspection.
 *
 *   node scripts/visual-regression.mjs --update   # (re)write baselines
 *   node scripts/visual-regression.mjs            # compare against baselines
 *   node scripts/visual-regression.mjs --viewports=mobile,desktop --themes=dark
 */
import { chromium } from "playwright";
import sharp from "sharp";
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

const ALL_THEMES = ["light", "dark"];
// `--themes=dark` narrows the run; by default both colour schemes are captured
// so a token change that only lands in one theme still fails the gate.
const themeFilter = (process.argv.find((a) => a.startsWith("--themes=")) ?? "")
  .replace("--themes=", "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const THEMES = themeFilter.length ? ALL_THEMES.filter((t) => themeFilter.includes(t)) : ALL_THEMES;

if (!THEMES.length) {
  console.error(`No themes matched "${themeFilter.join(",")}". Known: light, dark.`);
  process.exit(1);
}

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

/**
 * Perceptual difference ratio: decodes both PNGs and compares pixels with a
 * small per-channel tolerance, so antialiasing noise does not read as drift
 * while real layout or palette changes still fail the gate.
 */
async function differenceRatio(a, b) {
  const CHANNEL_TOLERANCE = 12;
  const [rawA, rawB] = await Promise.all(
    [a, b].map((buf) => sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true })),
  );
  if (
    rawA.info.width !== rawB.info.width ||
    rawA.info.height !== rawB.info.height
  ) {
    return 1;
  }
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
const browser = await launch();
try {
  for (const theme of THEMES) {
  for (const [vpName, width, height] of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: "reduce", // deterministic captures
    });
    // Pin the in-app theme preference too: the app resolves "system" from the
    // colour scheme, but an explicit choice keeps captures free of first-paint
    // flips between the stored value and the media query.
    await context.addInitScript(
      (value) => window.localStorage.setItem("gradr-theme", value),
      theme,
    );
    const page = await context.newPage();
    for (const [name, path] of ROUTES) {
      // Light baselines keep their historical filenames so existing snapshots
      // stay valid; dark captures get their own suffixed set.
      const file = theme === "light" ? `${name}-${vpName}.png` : `${name}-${vpName}-${theme}.png`;
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
      const ratio = await differenceRatio(readFileSync(baselinePath), shot);
      if (ratio > DIFF_TOLERANCE) {
        failures.push({ file, ratio });
        console.log(`✖ ${file} differs by ${(ratio * 100).toFixed(1)}%`);
      } else {
        console.log(`✓ ${file}`);
      }
    }
    await context.close();
  }
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

console.log(
  `\n✓ Visual regression clean (${ROUTES.length} routes × ${VIEWPORTS.length} viewport(s) × ${THEMES.length} theme(s)).`,
);
