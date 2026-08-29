#!/usr/bin/env node
/**
 * Core Web Vitals regression gate (LCP / CLS / TBT-ish blocking time).
 *
 * Loads each budgeted route in headless Chromium with CPU + network throttling
 * so the numbers are comparable run to run, collects the real
 * PerformanceObserver entries the browser reports, and fails when a route
 * breaks the budget in scripts/perf-budgets.json.
 *
 *   bun run build && bunx vite preview --port 8080 &
 *   node scripts/check-web-vitals.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";
import { launchChromium } from "./lib/browser.mjs";
import { resolveBase } from "./lib/marketingSurface.mjs";

const BASE = resolveBase();
const { vitals } = JSON.parse(
  readFileSync(new URL("./perf-budgets.json", import.meta.url), "utf8"),
);
const ROUTES = vitals.routes;
/** Median of three runs — a single cold run in CI is too noisy to gate on. */
const RUNS = Number(process.env.VITALS_RUNS || 3);

const collector = `
  window.__vitals = { lcp: 0, cls: 0, longTasks: 0 };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__vitals.lcp = Math.max(window.__vitals.lcp, e.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__vitals.longTasks += Math.max(0, e.duration - 50);
  }).observe({ type: 'longtask', buffered: true });
`;

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const browser = await launchChromium();
const results = [];

try {
  for (const route of ROUTES) {
    const samples = { lcp: [], cls: [], tbt: [] };

    for (let run = 0; run < RUNS; run += 1) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        // Consent is pre-seeded: the cookie banner is a layout shift users only
        // ever see once, and it would otherwise dominate CLS on every run.
        storageState: {
          cookies: [],
          origins: [
            {
              origin: BASE,
              localStorage: [{ name: "gradr-cookie-consent", value: "accepted" }],
            },
          ],
        },
      });
      const page = await context.newPage();
      await page.addInitScript(collector);

      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 40,
        downloadThroughput: (10 * 1024 * 1024) / 8,
        uploadThroughput: (3 * 1024 * 1024) / 8,
      });

      await page.goto(`${BASE}${route}`, { waitUntil: "load" });
      // Let lazy content, fonts and any deferred hydration settle into the LCP
      // and CLS the visitor would actually experience.
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      await page.waitForTimeout(3500);
      const measured = await page.evaluate(() => window.__vitals);

      samples.lcp.push(measured.lcp);
      samples.cls.push(measured.cls);
      samples.tbt.push(measured.longTasks);
      await context.close();
    }

    results.push({
      route,
      lcp: median(samples.lcp),
      cls: median(samples.cls),
      tbt: median(samples.tbt),
    });
  }
} finally {
  await browser.close();
}

const failures = [];
console.log(`Core Web Vitals (median of ${RUNS} throttled runs) against ${BASE}\n`);
for (const r of results) {
  const checks = [
    ["LCP", r.lcp, vitals.lcpMs, (v) => `${Math.round(v)} ms`],
    ["CLS", r.cls, vitals.cls, (v) => v.toFixed(3)],
    ["TBT", r.tbt, vitals.tbtMs, (v) => `${Math.round(v)} ms`],
  ];
  const bad = checks.filter(([, value, budget]) => value > budget);
  console.log(`${bad.length ? "✖" : "✓"} ${r.route}`);
  for (const [label, value, budget, fmt] of checks) {
    console.log(`     ${value > budget ? "✖" : "✓"} ${label} ${fmt(value)} (budget ${fmt(budget)})`);
  }
  for (const [label, value, budget, fmt] of bad) {
    failures.push(`${r.route}: ${label} ${fmt(value)} exceeds budget ${fmt(budget)}`);
  }
}

if (failures.length) {
  console.error(`\nPerformance regression:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
console.log("\nAll routes are within the Core Web Vitals budgets.");
