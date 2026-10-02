#!/usr/bin/env node
/**
 * Regression guard: the crawler-only SEO block must never become visible.
 *
 * The fallback copy lives inside <noscript>, so a JS-capable visitor should
 * never see it — not on first paint, not on a soft reload, and not on a hard
 * (cache-bypassing) reload. This runs each of those three loads in both light
 * and dark colour schemes, sampling the DOM ~30 times while the app boots, and
 * fails if the fallback text is ever painted or the splash never dismisses.
 *
 * Usage: node scripts/seo-flash-regression.mjs [baseUrl]
 */
import { launchBrowser, sampleForFlash } from "./lib/browser.mjs";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const ROUTES = ["/", "/pricing", "/auth"];
const SCHEMES = ["light", "dark"];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkLoad(page, name, navigate) {
  try {
    await navigate();
  } catch (error) {
    // Preview-server reloads can briefly detach the document; retry the URL
    // so the gate measures the rendered page instead of a navigation race.
    if (!/detached|Not attached|Protocol error.*Page\.reload|closed|interrupted|ERR_ABORTED|Target page/i.test(String(error))) throw error;
    await page.waitForTimeout(750);
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
  }
  const flash = await sampleForFlash(page);
  const leaked = flash.seoVisibleFrames.length > 0;
  record(
    name,
    !leaked && !flash.splashStuck,
    leaked
      ? `SEO fallback painted on ${flash.seoVisibleFrames.length}/${flash.samples} frames ("${flash.seoVisibleFrames[0].phrase}")`
      : flash.splashStuck
        ? "splash screen never dismissed"
        : `clean across ${flash.samples} frames`,
  );
}

async function main() {
  console.log(`SEO flash regression against ${BASE}\n`);
  const browser = await launchBrowser();

  for (const scheme of SCHEMES) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: scheme,
    });
    for (const route of ROUTES) {
      // Use a fresh page per route. Cross-origin hand-offs and service-worker
      // teardown can leave a reused page in a detached navigation state.
      const page = await context.newPage();
      const url = `${BASE}${route}`;
      await checkLoad(page, `${scheme} ${route} first load`, () =>
        page.goto(url, { waitUntil: "commit", timeout: 30_000 }));
      await checkLoad(page, `${scheme} ${route} reload`, async () => {
        try {
          await page.reload({ waitUntil: "commit", timeout: 30_000 });
        } catch (error) {
          if (!/detached|Not attached|Protocol error.*Page\.reload|closed|interrupted|ERR_ABORTED|Target page/i.test(String(error))) throw error;
          await page.waitForTimeout(750);
          await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
        }
      });
      await checkLoad(page, `${scheme} ${route} hard reload`, async () => {
        // Bypass the HTTP cache and any service-worker cached shell.
        await page.evaluate(async () => {
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
          await Promise.all(regs.map((r) => r.unregister()));
        }).catch(() => {});
        await page.goto(`${url}${url.includes("?") ? "&" : "?"}__hard=${Date.now()}`, {
          waitUntil: "commit",
          timeout: 30_000,
        });
      });

      // After settling, the fallback must still be absent from the rendered text.
      await page.waitForTimeout(600);
      const settled = await page.locator("body").innerText().catch(() => "");
      record(
        `${scheme} ${route} settled DOM has no fallback copy`,
        !settled.includes("not a grading, marking or test-score tool"),
        "post-boot check",
      );
      await page.close().catch(() => {});
    }

    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`\nFailed:\n${failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("SEO flash regression crashed:", err);
  process.exit(1);
});
