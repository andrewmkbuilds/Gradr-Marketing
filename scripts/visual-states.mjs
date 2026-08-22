#!/usr/bin/env node
/**
 * Component-state visual regression.
 *
 * Complements scripts/visual-regression.mjs (full routes) by capturing the
 * design-system gallery and key pages in BOTH themes, plus explicit hover and
 * disabled states of individual controls. Catches token drift that only shows
 * up in a non-default state (hover backgrounds, disabled opacity, focus rings).
 *
 *   node scripts/visual-states.mjs --update   # (re)write baselines
 *   node scripts/visual-states.mjs            # compare against baselines
 *
 * Note: /admin/design-system/* is auth-gated. Without a signed-in admin session
 * those entries capture the auth redirect and the element-level gallery
 * selectors are reported as skipped rather than failing the run.
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const UPDATE = process.argv.includes("--update");
const ROOT = process.cwd();
const BASELINE_DIR = join(ROOT, "tests/visual/states/baseline");
const CURRENT_DIR = join(ROOT, "tests/visual/states/current");
const DIFF_TOLERANCE = Number(process.env.VISUAL_TOLERANCE ?? 0.03);

/** Pages captured whole, in both themes. */
const PAGES = [
  ["gallery", "/admin/design-system/gallery"],
  ["ds-usage", "/admin/design-system/usage"],
  ["auth", "/auth"],
  ["pricing", "/pricing"],
  ["landing", "/landing"],
];

/**
 * Element-level state captures. `selector` is scoped inside the page at `path`.
 * `state` is one of "default" | "hover" | "focus" | "disabled".
 */
const STATES = [
  { name: "auth-submit-default", path: "/auth", selector: "form button[type=submit]", state: "default" },
  { name: "auth-submit-hover", path: "/auth", selector: "form button[type=submit]", state: "hover" },
  { name: "auth-submit-focus", path: "/auth", selector: "form button[type=submit]", state: "focus" },
  { name: "auth-email-focus", path: "/auth", selector: "form input[type=email]", state: "focus" },
  { name: "gallery-buttons", path: "/admin/design-system/gallery", selector: "[data-gallery='buttons']", state: "default" },
  { name: "gallery-buttons-hover", path: "/admin/design-system/gallery", selector: "[data-gallery='buttons']", state: "hover" },
  { name: "gallery-disabled", path: "/admin/design-system/gallery", selector: "[data-gallery='states']", state: "default" },
];

const THEMES = ["light", "dark"];

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
 * Perceptual-ish pixel diff: both images are normalised to the same small
 * greyscale raster, so PNG compression noise and sub-pixel antialiasing don't
 * register while real palette/layout drift does.
 */
async function differenceRatio(a, b) {
  const raster = (buf) =>
    sharp(buf).resize(160, 160, { fit: "fill" }).greyscale().raw().toBuffer();
  const [pa, pb] = await Promise.all([raster(a), raster(b)]);
  if (pa.length !== pb.length) return 1;
  let diff = 0;
  for (let i = 0; i < pa.length; i += 1) if (Math.abs(pa[i] - pb[i]) > 12) diff += 1;
  return diff / pa.length;
}

const failures = [];
const skipped = [];

async function record(file, shot) {
  const baselinePath = join(BASELINE_DIR, file);
  if (UPDATE || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, shot);
    console.log(`${UPDATE ? "updated" : "created"} baseline ${file}`);
    return;
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

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(CURRENT_DIR, { recursive: true });

const browser = await launch();
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    // Force the app's own theme store so the switch itself is exercised.
    await context.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
        // Deterministic captures: settled consent UI and no ambient motion.
        window.localStorage.setItem("gradr-cookie-consent", JSON.stringify({ analytics: false, marketing: false, functional: false, decidedAt: "2026-01-01T00:00:00.000Z" }));
        window.localStorage.setItem("gradr-motion", "reduced");
      },
      ["gradr-theme", theme],
    );
    const page = await context.newPage();
    await page.addStyleTag({
      content: "*,*::before,*::after{animation:none!important;transition:none!important}",
    }).catch(() => {});

    for (const [name, path] of PAGES) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await record(`${name}-${theme}.png`, await page.screenshot());
    }

    for (const { name, path, selector, state } of STATES) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      const el = page.locator(selector).first();
      if ((await el.count()) === 0) {
        skipped.push(`${name}-${theme}`);
        continue;
      }
      if (state === "hover") await el.hover();
      if (state === "focus") await el.focus();
      await page.waitForTimeout(250);
      await record(`${name}-${theme}.png`, await el.screenshot());
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (skipped.length) console.log(`\nskipped (selector absent): ${skipped.join(", ")}`);

if (failures.length) {
  console.error(
    `\n${failures.length} state capture(s) drifted beyond ${(DIFF_TOLERANCE * 100).toFixed(0)}%. ` +
      `Compare tests/visual/states/current/ with tests/visual/states/baseline/, then re-run with --update once intended.`,
  );
  process.exit(1);
}

console.log("\n✓ Component-state visual regression clean.");
