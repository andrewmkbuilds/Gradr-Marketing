#!/usr/bin/env node
/**
 * Brand logo visual regression.
 *
 * Catches the two ways the Gradr mark has broken before: a stale/incorrect
 * asset sneaking into a surface (header, sidebar, auth, footer), and the dark
 * navy mark rendering invisible against the dark theme.
 *
 * For every route x viewport x theme this script:
 *   1. finds each [data-brand-logo] and its visible <img>,
 *   2. asserts the src is an approved brand asset, the box is square-ish and
 *      big enough, and the natural image actually decoded,
 *   3. asserts contrast: the rendered mark must not blend into its backdrop,
 *   4. writes a screenshot per surface for diffing.
 *
 * Usage:
 *   node scripts/logo-visual.mjs                    # localhost:8080
 *   node scripts/logo-visual.mjs https://gradr.me   # deployed build
 */
import { chromium } from "playwright";
import { findChromium } from "./lib/browser.mjs";
import { mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const OUT_DIR = process.env.LOGO_VISUAL_OUT ?? "artifacts/logo-visual";

const ALLOWED_SRC = ["/gradr-logo.png", "/gradr-logo-dark.png"];
const ROUTES = ["/", "/auth", "/pricing", "/terms"];
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 780 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];
const THEMES = ["light", "dark"];


async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    const executablePath = findChromium();
    if (!executablePath) throw err;
    return chromium.launch({ executablePath });
  }
}

/** Measured in-page: every visible brand mark and how it sits on its backdrop. */
const inspectLogos = () =>
  Array.from(document.querySelectorAll("[data-brand-logo]")).map((wrapper) => {
    const imgs = Array.from(wrapper.querySelectorAll("img")).filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(img).display !== "none";
    });
    const img = imgs[0];
    const rect = wrapper.getBoundingClientRect();

    // Walk up for the nearest painted background so we can compare luminance.
    let backdrop = "rgba(0, 0, 0, 0)";
    let node = wrapper.parentElement;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        backdrop = bg;
        break;
      }
      node = node.parentElement;
    }

    return {
      visibleCount: imgs.length,
      src: img ? new URL(img.currentSrc || img.src, location.origin).pathname : null,
      naturalWidth: img?.naturalWidth ?? 0,
      complete: img?.complete ?? false,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      onScreen: rect.width > 0 && rect.left < window.innerWidth && rect.right > 0,
      opacity: Number(getComputedStyle(wrapper).opacity),
      backdrop,
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    };
  });

const luminance = (rgb) => {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m) return null;
  const [r, g, b] = m.map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await launch();
  const failures = [];
  let checks = 0;

  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) {
        const label = `${theme}/${vp.name}${route}`;
        checks++;
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
        });
        // Force the app's own theme store, not just the OS preference.
        await context.addInitScript(
          (value) => window.localStorage.setItem("gradr-theme", value),
          theme,
        );
        const page = await context.newPage();
        try {
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForSelector("[data-brand-logo] img", { timeout: 20000 });
          await page.waitForTimeout(900);

          const logos = await page.evaluate(inspectLogos);
          const problems = [];

          if (logos.length === 0) problems.push("no brand logo rendered");

          logos.forEach((logo, i) => {
            const at = `logo#${i + 1}`;
            if (logo.visibleCount !== 1) problems.push(`${at}: ${logo.visibleCount} visible variants (expected 1)`);
            if (!logo.src || !ALLOWED_SRC.includes(logo.src)) problems.push(`${at}: unexpected asset ${logo.src}`);
            if (!logo.complete || logo.naturalWidth === 0) problems.push(`${at}: image failed to load`);
            if (logo.width < 16 || logo.height < 16) problems.push(`${at}: too small (${logo.width}x${logo.height})`);
            if (Math.abs(logo.width - logo.height) > 2) problems.push(`${at}: not square (${logo.width}x${logo.height})`);
            if (logo.opacity < 0.9) problems.push(`${at}: faded (opacity ${logo.opacity})`);
            if (!logo.onScreen) problems.push(`${at}: rendered off-screen`);
            if (logo.theme !== theme) problems.push(`${at}: theme did not apply (${logo.theme})`);

            // The dark navy mark must never sit directly on a dark backdrop.
            const bgLum = luminance(logo.backdrop);
            if (bgLum !== null && bgLum < 0.35 && logo.src === "/gradr-logo.png") {
              problems.push(`${at}: dark mark on dark backdrop (${logo.backdrop})`);
            }
          });

          const shot = join(OUT_DIR, `${theme}-${vp.name}-${route === "/" ? "home" : route.slice(1)}.png`);
          const target = (await page.$("[data-brand-logo]")) ?? page;
          await target.screenshot({ path: shot });

          if (problems.length) {
            failures.push(`${label}: ${problems.join("; ")}`);
            console.log(`FAIL  ${label} — ${problems.join("; ")}`);
          } else {
            console.log(`PASS  ${label} (${logos.length} mark(s)) → ${shot}`);
          }
        } catch (err) {
          failures.push(`${label}: ${err.message.split("\n")[0]}`);
          console.log(`FAIL  ${label} — ${err.message.split("\n")[0]}`);
        } finally {
          await context.close();
        }
      }
    }
  }

  await browser.close();
  console.log(`\n${checks - failures.length}/${checks} logo checks passed`);
  if (failures.length) {
    console.error("Logo visual regression failed:\n - " + failures.join("\n - "));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
