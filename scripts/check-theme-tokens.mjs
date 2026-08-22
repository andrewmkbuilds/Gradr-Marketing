#!/usr/bin/env node
/**
 * Light/dark theme regression check.
 *
 * Two passes:
 *
 *  1. STATIC — scans the source for colour values that bypass the design
 *     system: raw hex / rgb() / hsl() literals, Tailwind palette utilities
 *     (`bg-slate-800`, `text-white`), arbitrary colour utilities, inline
 *     `style` colour props, and `dark:` overrides layered on top of hardcoded
 *     colours (the classic "themed by hand" smell).
 *
 *  2. RUNTIME (`--runtime`, needs the dev server) — renders each public route
 *     in light and in dark, resolves the design-system token palette from the
 *     CSS custom properties in each theme, then walks the rendered tree and
 *     flags any painted colour that is not a token value. A colour that is
 *     byte-identical in both themes *and* absent from both palettes is a
 *     hardcoded colour that will not repaint when the theme flips.
 *
 * Usage:
 *   node scripts/check-theme-tokens.mjs             # static only
 *   node scripts/check-theme-tokens.mjs --runtime   # static + rendered check
 *
 * Exit 0 = clean, 1 = regressions found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const RUNTIME = process.argv.includes("--runtime");
const BASE = (process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:8080").replace(/\/$/, "");

/* ------------------------------------------------------------------ static */

/**
 * Files that legitimately carry raw colour values: the token definitions
 * themselves, generated token maps, and the vendored design-system copy
 * (owned by the library project — never edited here).
 */
const ALLOWED_PATHS = [
  "src/index.css",
  "src/styles/design-system.css",
  "src/lib/design/yachtClub.ts",
  "src/config/brandAssets.generated.ts",
];
const ALLOWED_PREFIXES = ["src/design-system/"];

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RULES = [
  {
    id: "palette-utility",
    pattern: new RegExp(String.raw`\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow)-(?:${PALETTE})-\d{2,3}\b`, "g"),
    message: "Tailwind palette colours do not follow the theme — use semantic tokens (bg-surface, text-muted-foreground, border-border …).",
  },
  {
    id: "absolute-white-black",
    pattern: /\b(?:bg|text|border|ring|fill|stroke|divide)-(?:white|black)(?:\/\d{1,3})?\b/g,
    message: "white/black are theme-invariant — use background/foreground/surface tokens instead.",
  },
  {
    id: "arbitrary-colour-utility",
    pattern: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration)-\[(?:#|rgba?\(|hsla?\()[^\]]*\]/g,
    message: "Arbitrary colour utility — add a token to the theme instead of inlining the value.",
  },
  {
    id: "colour-literal",
    pattern: /(?<!var\()(?:#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d)/g,
    message: "Raw colour literal — resolve the value from a design token (hsl(var(--token))).",
    files: /\.(tsx?|css)$/,
  },
  {
    id: "inline-style-colour",
    pattern: /style=\{\{[^}]*(?:color|background|borderColor|fill|stroke)\s*:\s*["'`](?![^"'`]*var\(--)[^"'`]+["'`]/g,
    message: "Inline colour style bypasses theming — move it to a token-backed class or use hsl(var(--token)).",
  },
  {
    id: "dark-variant-on-hardcoded-colour",
    pattern: new RegExp(String.raw`dark:(?:bg|text|border|ring|fill|stroke|divide)-(?:white|black|(?:${PALETTE})-\d{2,3}|\[[^\]]+\])`, "g"),
    message: "Hand-rolled dark override — semantic tokens already flip with the theme, so no dark: variant is needed.",
  },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx?|css)$/.test(full)) files.push(full);
  }
  return files;
}

function isAllowed(rel) {
  return ALLOWED_PATHS.includes(rel) || ALLOWED_PREFIXES.some((p) => rel.startsWith(p));
}

export function scanStatic() {
  const violations = [];
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (isAllowed(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (const rule of RULES) {
      if (rule.files && !rule.files.test(rel)) continue;
      lines.forEach((line, i) => {
        // Escape hatch for genuinely theme-independent values (canvas shaders,
        // third-party chart payloads, brand-locked email HTML).
        if (line.includes("theme-token-ok")) return;
        const matches = line.match(rule.pattern);
        if (!matches) return;
        violations.push({ rel, line: i + 1, ruleId: rule.id, message: rule.message, snippet: matches[0] });
      });
    }
  }
  return violations;
}

/* ----------------------------------------------------------------- runtime */

const ROUTES = ["/", "/pricing", "/auth", "/ats-resume-checker", "/affiliate"];

function normalise(colour) {
  const m = /rgba?\(([^)]+)\)/.exec(colour ?? "");
  if (!m) return null;
  const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  const [r, g, b, a = 1] = parts;
  if (a === 0) return null; // fully transparent paints nothing
  return `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
}

async function scanRuntime() {
  const { launchBrowser } = await import("./lib/browser.mjs");
  const browser = await launchBrowser();
  const failures = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
    const page = await context.newPage();

    for (const route of ROUTES) {
      const perTheme = {};
      for (const theme of ["light", "dark"]) {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        await page.evaluate((t) => {
          document.documentElement.classList.toggle("dark", t === "dark");
          document.documentElement.style.colorScheme = t;
          localStorage.setItem("gradr-theme", t);
        }, theme);
        await page.waitForTimeout(400);

        perTheme[theme] = await page.evaluate(() => {
          const root = getComputedStyle(document.documentElement);
          // Every colour token, resolved to a painted rgb() value.
          const probe = document.createElement("span");
          probe.style.display = "none";
          document.body.appendChild(probe);
          const palette = new Set();
          for (const name of Array.from(document.styleSheets)
            .flatMap((sheet) => {
              try {
                return Array.from(sheet.cssRules);
              } catch {
                return [];
              }
            })
            .flatMap((rule) => (rule.style ? Array.from(rule.style) : []))
            .filter((prop) => prop.startsWith("--"))) {
            const raw = root.getPropertyValue(name).trim();
            if (!raw) continue;
            for (const candidate of [raw, `hsl(${raw})`, `rgb(${raw})`]) {
              probe.style.color = "";
              probe.style.color = candidate;
              const resolved = getComputedStyle(probe).color;
              if (resolved && resolved !== "rgba(0, 0, 0, 0)") palette.add(resolved);
            }
          }
          probe.remove();

          const painted = [];
          for (const el of Array.from(document.querySelectorAll("body *")).slice(0, 1500)) {
            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
              painted.push({
                prop,
                value: cs[prop],
                tag: el.tagName.toLowerCase(),
                cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 90),
              });
            }
          }
          return { palette: Array.from(palette), painted };
        });
      }

      const lightPalette = new Set(perTheme.light.palette.map(normalise).filter(Boolean));
      const darkPalette = new Set(perTheme.dark.palette.map(normalise).filter(Boolean));
      const seen = new Set();

      perTheme.light.painted.forEach((entry, index) => {
        const light = normalise(entry.value);
        const dark = normalise(perTheme.dark.painted[index]?.value);
        if (!light || !dark) return;
        if (light !== dark) return; // repaints with the theme — fine
        if (lightPalette.has(light) || darkPalette.has(light)) return; // token that is intentionally theme-stable
        const key = `${entry.cls}|${entry.prop}|${light}`;
        if (seen.has(key)) return;
        seen.add(key);
        failures.push({
          route,
          detail: `<${entry.tag} class="${entry.cls}"> ${entry.prop} = rgb(${light}) in both themes and is not a token value`,
        });
      });
    }
  } finally {
    await browser.close();
  }
  return failures;
}

/* -------------------------------------------------------------------- main */

const isEntry = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isEntry) {
  const staticViolations = scanStatic();
  if (staticViolations.length) {
    console.error(`\n✖ ${staticViolations.length} theme-bypassing colour value(s):\n`);
    const grouped = new Map();
    for (const v of staticViolations) {
      if (!grouped.has(v.ruleId)) grouped.set(v.ruleId, []);
      grouped.get(v.ruleId).push(v);
    }
    for (const [id, list] of grouped) {
      console.error(`  ${id} — ${list[0].message}`);
      for (const v of list.slice(0, 30)) console.error(`    ${v.rel}:${v.line}  ${v.snippet}`);
      if (list.length > 30) console.error(`    … and ${list.length - 30} more`);
      console.error("");
    }
    console.error("Append `theme-token-ok` to a line only when the raw value is genuinely theme-independent.\n");
  } else {
    console.log("✓ static: every colour value resolves through the design tokens.");
  }

  let runtimeFailures = [];
  if (RUNTIME) {
    runtimeFailures = await scanRuntime();
    if (runtimeFailures.length) {
      console.error(`\n✖ ${runtimeFailures.length} rendered element(s) do not repaint between light and dark:\n`);
      for (const f of runtimeFailures.slice(0, 40)) console.error(`  ${f.route}  ${f.detail}`);
      console.error("");
    } else {
      console.log("✓ runtime: every painted colour comes from a theme token.");
    }
  }

  process.exit(staticViolations.length + runtimeFailures.length ? 1 : 0);
}
