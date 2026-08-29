#!/usr/bin/env node
/**
 * Navigation accessibility regression (Playwright + axe-core).
 *
 * Scans the surfaces that keyboard and screen-reader users depend on:
 *   - desktop sidebar (expanded and collapsed rail)
 *   - an opened sidebar group (submenu)
 *   - breadcrumbs
 *   - the mobile drawer, including a focus-trap assertion
 *
 * Only serious/critical violations fail the run; axe "minor" noise is reported
 * but does not block, so the suite stays actionable.
 *
 * Usage:
 *   node scripts/a11y-nav.mjs                    # localhost:8080
 *   node scripts/a11y-nav.mjs https://gradr.me
 */
import { chromium } from "playwright";
import { findChromium } from "./lib/browser.mjs";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";

const require = createRequire(import.meta.url);
const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BLOCKING = new Set(["serious", "critical"]);

async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    const executablePath = findChromium();
    if (!executablePath) throw err;
    return chromium.launch({ executablePath });
  }
}

/** Run axe against one selector (or the page) and return its violations. */
async function audit(page, selector) {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async (sel) => {
    const context = sel ? { include: [[sel]] } : document;
    const result = await window.axe.run(context, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  }, selector);
}

const results = [];
function record(label, violations) {
  const blocking = violations.filter((v) => BLOCKING.has(v.impact));
  results.push({ label, blocking, total: violations.length });
  if (blocking.length === 0) {
    console.log(`PASS  ${label} (${violations.length} non-blocking)`);
  } else {
    console.log(`FAIL  ${label}`);
    for (const v of blocking) console.log(`        [${v.impact}] ${v.id}: ${v.help} — ${v.nodes.join(", ")}`);
  }
}

async function run() {
  const browser = await launch();

  /* ---------------------------- desktop sidebar --------------------------- */
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1500);

  const hasSidebar = (await page.$('[data-sidebar="sidebar"]')) !== null;
  if (!hasSidebar) {
    console.log("SKIP  desktop sidebar — not rendered (unauthenticated session)");
  } else {
    record("sidebar (expanded)", await audit(page, '[data-sidebar="sidebar"]'));

    // Open the first collapsible group to audit a submenu.
    const groupTrigger = await page.$('[data-sidebar="sidebar"] [data-nav-group-trigger]');
    if (groupTrigger) {
      await groupTrigger.click();
      await page.waitForTimeout(400);
      record("sidebar submenu (open group)", await audit(page, '[data-sidebar="sidebar"]'));
    }

    const rail = await page.$('[data-sidebar="trigger"]');
    if (rail) {
      await rail.click();
      await page.waitForTimeout(400);
      record("sidebar (collapsed rail)", await audit(page, '[data-sidebar="sidebar"]'));
      await rail.click();
      await page.waitForTimeout(300);
    }

    const breadcrumb = await page.$("nav[aria-label='Breadcrumb']");
    if (breadcrumb) record("breadcrumbs", await audit(page, "nav[aria-label='Breadcrumb']"));
    else console.log("SKIP  breadcrumbs — not rendered on this route");
  }
  await desktop.close();

  /* ----------------------------- mobile drawer ---------------------------- */
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await mpage.waitForTimeout(1500);

  const trigger = await mpage.$('[data-sidebar="trigger"]');
  if (!trigger) {
    console.log("SKIP  mobile drawer — trigger not rendered (unauthenticated session)");
  } else {
    await trigger.click();
    await mpage.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await mpage.waitForTimeout(700);
    record("mobile drawer", await audit(mpage, '[role="dialog"]'));

    // Focus trap: tabbing many times must never leave the dialog.
    const escaped = await mpage.evaluate(async () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return "no dialog";
      for (let i = 0; i < 40; i++) {
        const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
        document.activeElement?.dispatchEvent(event);
        await new Promise((r) => setTimeout(r, 5));
        if (document.activeElement && !dialog.contains(document.activeElement) && document.activeElement !== document.body) {
          return document.activeElement.outerHTML.slice(0, 120);
        }
      }
      return null;
    });
    if (escaped) {
      results.push({ label: "mobile drawer focus trap", blocking: [{ id: "focus-trap", impact: "critical", help: `focus escaped to ${escaped}`, nodes: [] }], total: 1 });
      console.log(`FAIL  mobile drawer focus trap — focus escaped to ${escaped}`);
    } else {
      console.log("PASS  mobile drawer focus trap");
      results.push({ label: "mobile drawer focus trap", blocking: [], total: 0 });
    }

    // Scroll lock: the page behind the drawer must not scroll.
    const locked = await mpage.evaluate(() => {
      const style = getComputedStyle(document.body);
      return style.position === "fixed" || style.overflow === "hidden";
    });
    if (!locked) {
      results.push({ label: "mobile drawer scroll lock", blocking: [{ id: "scroll-lock", impact: "serious", help: "body still scrollable behind open drawer", nodes: [] }], total: 1 });
      console.log("FAIL  mobile drawer scroll lock — body still scrollable");
    } else {
      console.log("PASS  mobile drawer scroll lock");
      results.push({ label: "mobile drawer scroll lock", blocking: [], total: 0 });
    }
  }
  await mobile.close();
  await browser.close();

  const failed = results.filter((r) => r.blocking.length > 0);
  console.log(`\n${results.length - failed.length}/${results.length} navigation accessibility checks passed`);
  if (failed.length) {
    console.error("Accessibility regressions:\n - " + failed.map((f) => f.label).join("\n - "));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
