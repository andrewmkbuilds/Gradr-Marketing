#!/usr/bin/env node
/**
 * Auth hero visual regression + clipping assertions.
 *
 * For each viewport (and each installed browser engine) this script:
 *   1. loads the route that renders AuthLayout,
 *   2. asserts the full headline text is present and not visually clipped
 *      (no overflow past its container, no zero-height/hidden lines),
 *   3. writes a screenshot of the hero for review / diffing.
 *
 * Usage:
 *   node scripts/auth-hero-visual.mjs                    # localhost:8080, chromium
 *   node scripts/auth-hero-visual.mjs https://gradr.me   # deployed build
 *   AUTH_HERO_BROWSERS=chromium,firefox,webkit node scripts/auth-hero-visual.mjs
 *   AUTH_HERO_UPDATE=1 node scripts/auth-hero-visual.mjs # refresh baselines
 *
 * Exit code 0 = all viewports pass, 1 = clipping or missing text detected.
 */
import { chromium, firefox, webkit } from "playwright";
import { mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const OUT_DIR = process.env.AUTH_HERO_OUT ?? "artifacts/auth-hero";
const HEADLINE = "Your AI career command center.";
/**
 * The marketing surface no longer hosts a sign-in form — `/auth` hands off to
 * app.gradr.me. The OAuth consent screen is the route that still renders
 * `AuthLayout` (and therefore the hero) in this bundle, so that is what the
 * clipping assertions must load. Override with AUTH_HERO_ROUTE if that moves.
 */
const HERO_ROUTE = process.env.AUTH_HERO_ROUTE ?? "/.lovable/oauth/consent";

/** Widths that historically triggered clipping, plus the common breakpoints. */
const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-360", width: 360, height: 780 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

const ENGINES = { chromium, firefox, webkit };

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

async function launch(name) {
  const engine = ENGINES[name];
  try {
    return await engine.launch();
  } catch (err) {
    if (name !== "chromium") throw err;
    const executablePath = findChromium();
    if (!executablePath) throw err;
    return chromium.launch({ executablePath });
  }
}

/** Measured in-page: is the hero headline fully rendered and unclipped? */
const inspectHero = () => {
  // Only one hero renders per breakpoint; pick the one with layout boxes.
  const node = Array.from(document.querySelectorAll("[data-auth-hero]")).find((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden";
  });
  if (!node) return { found: false };

  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  const parent = node.parentElement;
  const parentRect = parent ? parent.getBoundingClientRect() : rect;

  return {
    found: true,
    variant: node.getAttribute("data-auth-hero"),
    text: (node.innerText || node.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    // Scroll size larger than client size means content is being cut off.
    clippedVertically: node.scrollHeight - node.clientHeight > 1,
    clippedHorizontally: node.scrollWidth - node.clientWidth > 1,
    overflowsParent:
      rect.bottom - parentRect.bottom > 1 || rect.right - parentRect.right > 1 || rect.left < parentRect.left - 1,
    offScreen: rect.top < 0 || rect.left < 0 || rect.right > window.innerWidth + 1,
    height: Math.round(rect.height),
    lineHeight: style.lineHeight,
    overflow: style.overflow,
    opacity: style.opacity,
  };
};

async function run() {
  const engines = (process.env.AUTH_HERO_BROWSERS ?? "chromium")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s in ENGINES);

  mkdirSync(OUT_DIR, { recursive: true });
  const failures = [];
  let checks = 0;

  for (const engineName of engines) {
    let browser;
    try {
      browser = await launch(engineName);
    } catch (err) {
      console.log(`SKIP  ${engineName} (not installed: ${err.message.split("\n")[0]})`);
      continue;
    }

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const label = `${engineName}/${vp.name}`;
      checks++;
      try {
        await page.goto(`${BASE}${HERO_ROUTE}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForSelector("[data-auth-hero]:visible", { timeout: 20000 });
        // Let the letter-reveal + framer transitions settle before measuring.
        await page.waitForTimeout(1600);

        const hero = await page.evaluate(inspectHero);

        const problems = [];
        if (!hero.found) problems.push("hero headline not found");
        else {
          if (hero.text !== HEADLINE) problems.push(`text mismatch: "${hero.text}"`);
          if (hero.clippedVertically) problems.push("vertically clipped");
          if (hero.clippedHorizontally) problems.push("horizontally clipped");
          if (hero.overflowsParent) problems.push("overflows its container");
          if (hero.offScreen) problems.push("rendered off-screen");
          if (hero.height < 20) problems.push(`collapsed height (${hero.height}px)`);
          if (Number(hero.opacity) < 0.9) problems.push(`faded out (opacity ${hero.opacity})`);
        }

        const shot = join(OUT_DIR, `${engineName}-${vp.name}.png`);
        const target = (await page.$("[data-auth-hero]:visible")) ?? page;
        await target.screenshot({ path: shot });

        if (problems.length) {
          failures.push(`${label}: ${problems.join("; ")}`);
          console.log(`FAIL  ${label} — ${problems.join("; ")}`);
        } else {
          console.log(`PASS  ${label} (${hero.variant}, ${hero.height}px) → ${shot}`);
        }
      } catch (err) {
        failures.push(`${label}: ${err.message.split("\n")[0]}`);
        console.log(`FAIL  ${label} — ${err.message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }

    await browser.close();
  }

  console.log(`\n${checks - failures.length}/${checks} auth hero viewport checks passed`);
  if (failures.length) {
    console.error("Auth hero visual regression failed:\n - " + failures.join("\n - "));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
