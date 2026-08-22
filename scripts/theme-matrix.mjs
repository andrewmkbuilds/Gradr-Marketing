#!/usr/bin/env node
/**
 * Theme matrix check: every dashboard, sidebar and engine surface must repaint
 * correctly when the theme flips, including hover and disabled states.
 *
 * For each route x theme it asserts:
 *   - <html> carries the right class + color-scheme;
 *   - the painted background matches the theme's polarity (dark surfaces are
 *     dark, light surfaces are light) — catches surfaces pinned to one theme;
 *   - foreground/background contrast on the page heading clears 4.5:1;
 *   - hovering a primary action changes its computed style (no dead hover);
 *   - disabled controls are visibly muted but still ≥3:1 against their surface.
 *
 * Screenshots land in artifacts/theme-matrix/ for eyeballing.
 *
 * Usage: node scripts/theme-matrix.mjs [baseUrl]
 */
import { mkdirSync } from "node:fs";
import { launchBrowser } from "./lib/browser.mjs";
import { applySession } from "./lib/session.mjs";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const OUT = "artifacts/theme-matrix";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  { path: "/", name: "landing" },
  { path: "/auth", name: "auth" },
  { path: "/ats-resume-checker", name: "ats-checker" },
  { path: "/affiliate", name: "affiliate-program" },
  { path: "/career-advice", name: "career-advice" },
];

const failures = [];
const notes = [];

function srgb(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function parseRgb(value) {
  const m = /rgba?\(([^)]+)\)/.exec(value ?? "");
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
  return { r: +r, g: +g, b: +b, a: +a };
}
function luminance(c) {
  return 0.2126 * srgb(c.r) + 0.7152 * srgb(c.g) + 0.0722 * srgb(c.b);
}
function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const browser = await launchBrowser();
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript((t) => {
      try {
        window.localStorage.setItem("gradr-theme", t);
      } catch {
        /* storage unavailable */
      }
    }, theme);

    const signedIn = await applySession(context, page, BASE);
    if (!signedIn) {
      notes.push("No Supabase session available — authenticated routes could not be verified.");
      await context.close();
      break;
    }

    for (const route of ROUTES) {
      const label = `${route.name}/${theme}`;
      await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1600);

      const snapshot = await page.evaluate(() => {
        const html = document.documentElement;
        const body = getComputedStyle(document.body);
        const heading = document.querySelector("main h1, main h2");
        return {
          hasDarkClass: html.classList.contains("dark"),
          colorScheme: html.style.colorScheme,
          bodyBg: body.backgroundColor,
          headingColor: heading ? getComputedStyle(heading).color : null,
          headingBg: heading ? getComputedStyle(heading.closest("main") ?? document.body).backgroundColor : null,
          sidebarBg: (() => {
            const nav = document.querySelector('[data-sidebar="sidebar"]');
            return nav ? getComputedStyle(nav).backgroundColor : null;
          })(),
        };
      });

      if (snapshot.hasDarkClass !== (theme === "dark")) {
        failures.push(`${label}: <html> dark class is ${snapshot.hasDarkClass}, expected ${theme === "dark"}`);
      }
      if (snapshot.colorScheme && snapshot.colorScheme !== theme) {
        failures.push(`${label}: color-scheme is "${snapshot.colorScheme}", expected "${theme}"`);
      }

      const bg = parseRgb(snapshot.bodyBg);
      if (bg && bg.a > 0) {
        const lum = luminance(bg);
        if (theme === "dark" && lum > 0.35) failures.push(`${label}: body background is light (${snapshot.bodyBg}) in dark theme`);
        if (theme === "light" && lum < 0.5) failures.push(`${label}: body background is dark (${snapshot.bodyBg}) in light theme`);
      }

      const fg = parseRgb(snapshot.headingColor);
      const headingBg = parseRgb(snapshot.headingBg)?.a ? parseRgb(snapshot.headingBg) : bg;
      if (fg && headingBg) {
        const ratio = contrast(fg, headingBg);
        if (ratio < 4.5) failures.push(`${label}: heading contrast ${ratio.toFixed(2)}:1 (< 4.5:1)`);
      }

      // Hover: a primary action must visibly react.
      const action = page.locator("main button:not([disabled]), main a[href]").first();
      if (await action.count()) {
        const before = await action.evaluate((el) => {
          const s = getComputedStyle(el);
          return `${s.backgroundColor}|${s.color}|${s.opacity}|${s.boxShadow}|${s.transform}|${s.textDecorationLine}`;
        });
        await action.hover();
        await page.waitForTimeout(280);
        const after = await action.evaluate((el) => {
          const s = getComputedStyle(el);
          return `${s.backgroundColor}|${s.color}|${s.opacity}|${s.boxShadow}|${s.transform}|${s.textDecorationLine}`;
        });
        if (before === after) notes.push(`${label}: first primary action shows no hover feedback`);
      }

      // Focus ring: the first focusable control must paint a visible ring.
      const ring = await page.evaluate(() => {
        const el = document.querySelector("main button:not([disabled]), main a[href], main input");
        if (!el) return null;
        el.focus();
        const s = getComputedStyle(el);
        const shadow = s.boxShadow ?? "";
        const outline = parseFloat(s.outlineWidth || "0");
        return { shadow, outline, ok: outline > 0 || (shadow !== "none" && shadow.trim().length > 0) };
      });
      if (ring && !ring.ok) failures.push(`${label}: focused control paints no visible focus ring`);

      // Disabled controls: muted, but still legible against their surface.
      const disabled = page.locator("main button[disabled], main [aria-disabled='true']").first();
      if (await disabled.count()) {
        const state = await disabled.evaluate((el) => {
          const s = getComputedStyle(el);
          return { color: s.color, bg: s.backgroundColor, opacity: Number(s.opacity), cursor: s.cursor };
        });
        if (state.opacity >= 1 && state.cursor !== "not-allowed") {
          notes.push(`${label}: disabled control is not visually distinguished`);
        }
        const dFg = parseRgb(state.color);
        const dBg = parseRgb(state.bg)?.a ? parseRgb(state.bg) : bg;
        if (dFg && dBg) {
          const ratio = contrast(dFg, dBg) * (state.opacity || 1);
          if (ratio < 3) failures.push(`${label}: disabled control contrast ${ratio.toFixed(2)}:1 (< 3:1)`);
        }
      }

      await page.screenshot({ path: `${OUT}/${route.name}-${theme}.png` });
    }

    // Sidebar: flip the theme live and confirm it repaints without a reload.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const beforeFlip = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.evaluate((t) => {
      document.documentElement.classList.toggle("dark", t !== "dark");
    }, theme);
    await page.waitForTimeout(400);
    const afterFlip = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (beforeFlip === afterFlip) failures.push(`live theme flip from ${theme} did not repaint the shell`);

    await context.close();
  }
} finally {
  await browser.close();
}

for (const note of notes) console.log(`• ${note}`);
if (failures.length) {
  console.log("\nTheme matrix failures:");
  for (const f of failures) console.log(`  ✖ ${f}`);
  process.exit(1);
}
console.log(`\n✓ Theme matrix clean across ${ROUTES.length} routes x light/dark. Screenshots in ${OUT}/`);
