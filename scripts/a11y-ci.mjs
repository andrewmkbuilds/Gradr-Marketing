#!/usr/bin/env node
/**
 * CI accessibility gate for the auth and dashboard routes (axe-core).
 *
 * Unlike `a11y-audit.mjs` (broad, public routes, advisory), this run is narrow
 * and blocking: it walks the signed-in shell plus the auth screens at mobile
 * and desktop widths, in light and dark, and fails on any serious/critical
 * WCAG A/AA violation. Contrast and focus-ring rules are always enforced,
 * whatever impact axe assigns them.
 *
 * Usage:
 *   node scripts/a11y-ci.mjs                 # localhost:8080
 *   node scripts/a11y-ci.mjs https://app.gradr.me
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "./lib/browser.mjs";
import { applySession } from "./lib/session.mjs";

const require = createRequire(import.meta.url);
const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const BLOCKING_IMPACT = new Set(["serious", "critical"]);
/** Always blocking, regardless of the impact axe reports. */
const BLOCKING_RULES = new Set(["color-contrast", "focus-order-semantics", "link-in-text-block"]);

const AUTH_ROUTES = ["/auth", "/forgot-password", "/reset-password"];
const DASHBOARD_ROUTES = ["/", "/resume", "/match", "/pipeline", "/interview", "/growth", "/settings", "/billing", "/credits"];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const THEMES = ["light", "dark"];

const results = [];
let auditedDashboard = false;

const browser = await launchBrowser();
try {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
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
      const routes = signedIn ? [...AUTH_ROUTES, ...DASHBOARD_ROUTES] : AUTH_ROUTES;
      if (signedIn) auditedDashboard = true;

      for (const route of routes) {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await page.addScriptTag({ content: AXE });
        const run = await page.evaluate(async () =>
          window.axe.run(document, {
            resultTypes: ["violations"],
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          }),
        );
        for (const violation of run.violations) {
          results.push({
            route,
            viewport: viewport.name,
            theme,
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.slice(0, 3).map((n) => ({
              target: n.target.join(" "),
              summary: (n.failureSummary ?? "").split("\n").slice(1, 3).join(" ").trim(),
            })),
          });
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const blocking = results.filter((r) => BLOCKING_IMPACT.has(r.impact) || BLOCKING_RULES.has(r.id));

if (!results.length) {
  console.log(
    `✓ axe: no WCAG A/AA violations on auth${auditedDashboard ? " + dashboard" : ""} routes (light + dark, mobile + desktop).`,
  );
} else {
  const grouped = new Map();
  for (const r of results) {
    const key = `${r.id} [${r.impact}]`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  }
  for (const [key, list] of grouped) {
    const isBlocking = BLOCKING_IMPACT.has(list[0].impact) || BLOCKING_RULES.has(list[0].id);
    console.log(`\n${isBlocking ? "✖" : "•"} ${key} — ${list[0].help}`);
    for (const r of list.slice(0, 6)) {
      console.log(`    ${r.route} (${r.viewport}/${r.theme})`);
      for (const n of r.nodes) console.log(`      ${n.target}${n.summary ? ` — ${n.summary}` : ""}`);
    }
    if (list.length > 6) console.log(`    … and ${list.length - 6} more occurrences`);
  }
  console.log(`\n${results.length} violation instance(s); ${blocking.length} blocking.`);
}

if (!auditedDashboard) {
  console.log("⚠ No Supabase session available — dashboard routes were skipped (auth routes still audited).");
}

process.exit(blocking.length ? 1 : 0);
