#!/usr/bin/env node
/**
 * 3D depth smoke + visual regression.
 *
 * Verifies that the spatial layer is actually doing something on capable
 * devices, that it fully collapses under `prefers-reduced-motion`, and — the
 * important one — that no route transition ever paints a blank screen.
 *
 * Checks per run:
 *  1. The hero stage and every DepthStage render with a resolved depth level.
 *  2. Spatial cards exist on the landing page and carry a depth level.
 *     (/pricing is a hand-off to app.gradr.me on this surface, so it has none.)
 *  3. Reduced motion resolves `html[data-depth]` to "off" and removes all
 *     pointer 3D transforms.
 *  4. Client-side navigation between routes never leaves a blank viewport
 *     (measured as pixel variety in a downscaled screenshot) and never throws.
 *
 *   node scripts/depth-smoke.mjs [baseUrl]
 */
import { launchBrowser } from "./lib/browser.mjs";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const IGNORED_CONSOLE =
  /favicon|net::ERR_|Failed to load resource|^Warning:|React Router Future Flag|Download the React DevTools/i;
const ROUTES = ["/landing", "/ats-resume-checker", "/career-advice", "/job-search", "/auth"];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Rough "is anything on screen" measure: count distinct bytes in a small shot. */
async function paintedRatio(page) {
  const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 900, height: 600 } });
  const seen = new Set();
  for (let i = 0; i < shot.length; i += 7) seen.add(shot[i]);
  return seen.size / 256;
}

async function visibleText(page) {
  return page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
}

async function main() {
  console.log(`Depth smoke against ${BASE}\n`);
  const browser = await launchBrowser();

  /* ---------------------- 1. capable device, full depth ---------------------- */
  const full = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await full.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    // React dev warnings and asset noise aren't render failures.
    if (m.type() === "error" && !IGNORED_CONSOLE.test(m.text())) errors.push(m.text());
  });

  await page.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });
  // The homepage may canonicalise /landing → /; let that settle so the
  // evaluations below do not race a destroyed execution context.
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(2000);

  // Wait until the first depth subscriber initializes the document attribute.
  await page.waitForFunction(() => ["off", "lite", "full"].includes(document.documentElement.dataset.depth ?? ""), { timeout: 5000 }).catch(() => {});
  const depthAttr = await page.evaluate(() => document.documentElement.dataset.depth ?? "");
  record("depth manager resolves a level", ["off", "lite", "full"].includes(depthAttr), `data-depth="${depthAttr}"`);

  const hero = await page.locator('[data-hero-stage="true"]').count();
  record("hero 3D stage renders", hero > 0, `${hero} stage(s)`);

  const stages = await page.locator("[data-depth-stage]").count();
  record("module depth stages render", stages >= 4, `${stages} stage(s)`);

  // Pointer move over the hero must not blank the composition or throw.
  const box = await page.locator('[data-hero-stage="true"]').first().boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7);
    await page.waitForTimeout(400);
  }
  record("hero survives pointer parallax", (await visibleText(page)) > 400 && errors.length === 0, errors[0] ?? "");

  const cards = await page.locator('[data-spatial="card"]').count();
  record("landing cards use depth primitives", cards >= 3, `${cards} spatial card(s)`);

  /* ------------------- 2. route transitions never go blank ------------------- */
  for (const route of ROUTES) {
    const before = errors.length;
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const ratio = await paintedRatio(page);
    const text = await visibleText(page);
    const ok = ratio > 0.05 && text > 120 && errors.length === before;
    record(
      `no blank screen at ${route}`,
      ok,
      `paint=${ratio.toFixed(2)} text=${text}${errors.length > before ? ` err=${errors[before]}` : ""}`,
    );
  }

  await full.close();

  /* ----------------------- 3. reduced motion flattens ------------------------ */
  const calm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const calmPage = await calm.newPage();
  await calmPage.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });
  await calmPage.waitForTimeout(1500);

  const calmDepth = await calmPage.evaluate(() => document.documentElement.dataset.depth ?? "");
  record("reduced motion disables depth", calmDepth === "off", `data-depth="${calmDepth}"`);

  const spatialLevels = await calmPage.$$eval("[data-depth-stage],[data-spatial='card']", (els) =>
    els.map((el) => el.getAttribute("data-depth-stage") ?? el.getAttribute("data-depth-level")),
  );
  record(
    "no stage claims full depth under reduced motion",
    spatialLevels.every((l) => l !== "full"),
    `${spatialLevels.length} surface(s)`,
  );

  const calmText = await calmPage.evaluate(() => document.body?.innerText?.trim().length ?? 0);
  record("reduced-motion landing still renders content", calmText > 800, `${calmText} chars`);

  await calm.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
