#!/usr/bin/env node
/**
 * Deployment-time SEO audit for the marketing surface.
 *
 * Runs against a served build under the real production hostnames and asserts
 * the three things that silently de-index or cannibalise this site:
 *
 *   1. Canonicals — exactly one, self-referencing, on the surface's own origin,
 *      and agreeing with og:url.
 *   2. Robots — indexable pages carry no noindex; utility pages carry one; and
 *      robots.txt / sitemap.xml agree with both lists.
 *   3. No app metadata leakage — no marketing page may claim an app.gradr.me
 *      URL or reuse a title/description that belongs to an authenticated
 *      product route, and no two marketing pages may share metadata.
 *
 *   node scripts/seo-deploy-audit.mjs [baseUrl]
 */
import { launchChromium } from "./lib/browser.mjs";
import {
  APP_ORIGIN,
  INDEXABLE_PAGES,
  MARKETING_ORIGIN,
  NOINDEX_PAGES,
  resolveBase,
  serveUnderProductionHosts,
} from "./lib/marketingSurface.mjs";

const BASE = resolveBase();

/** Sibling surfaces must canonicalise to their own origin, never to gradr.me. */
const SURFACE_ORIGINS = [
  "https://marketing.gradr.me",
  "https://news.gradr.me",
  "https://docs.gradr.me",
  "https://support.gradr.me",
  "https://status.gradr.me",
];

/**
 * Exact titles that belong to authenticated product routes (before the
 * " — Gradr" suffix). If a public page renders one of these, the SEO layer
 * resolved app metadata for a marketing URL. Matched exactly rather than by
 * substring, because words like "Pipeline" are legitimate marketing copy.
 */
const APP_ONLY_TITLES = [
  "Resume Engine",
  "Job Feed",
  "Job Matching",
  "Pipeline",
  "Application Engine",
  "Interview Engine",
  "Interview History",
  "Growth Engine",
  "Manage Your Subscription",
  "Billing",
  "Sign in",
  "Reset password",
  "Forgot password",
  "Verify your email",
];

const failures = [];
const fail = (msg) => failures.push(msg);

async function readMeta(page) {
  return page.evaluate(() => {
    const attr = (sel, name) => document.querySelector(sel)?.getAttribute(name) ?? null;
    return {
      title: document.title,
      description: attr('meta[name="description"]', "content"),
      canonical: attr('link[rel="canonical"]', "href"),
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      ogUrl: attr('meta[property="og:url"]', "content"),
      ogTitle: attr('meta[property="og:title"]', "content"),
      ogImage: attr('meta[property="og:image"]', "content"),
      robots: attr('meta[name="robots"]', "content"),
    };
  });
}

function auditShared(label, meta, { origin, path, indexable }) {
  if (!meta.title || /Lovable/i.test(meta.title)) fail(`${label}: missing or template <title>`);
  if (!meta.description) fail(`${label}: missing meta description`);
  else if (indexable && (meta.description.length < 50 || meta.description.length > 200)) {
    fail(`${label}: description is ${meta.description.length} chars (want 50–200)`);
  }

  if (meta.canonicalCount !== 1) fail(`${label}: ${meta.canonicalCount} canonical tags, expected 1`);
  const expected = `${origin}${path === "/" ? "/" : path}`;
  if (!meta.canonical) fail(`${label}: missing canonical`);
  else if (meta.canonical.replace(/\/$/, "") !== expected.replace(/\/$/, "")) {
    fail(`${label}: canonical is "${meta.canonical}", expected "${expected}"`);
  }
  if (meta.ogUrl && meta.canonical && meta.ogUrl.replace(/\/$/, "") !== meta.canonical.replace(/\/$/, "")) {
    fail(`${label}: og:url "${meta.ogUrl}" disagrees with canonical "${meta.canonical}"`);
  }

  for (const [name, value] of Object.entries({
    canonical: meta.canonical,
    "og:url": meta.ogUrl,
    "og:image": meta.ogImage,
  })) {
    if (value && value.startsWith(APP_ORIGIN)) {
      fail(`${label}: ${name} points at the product surface (${value})`);
    }
  }

  const hasNoindex = /noindex/i.test(meta.robots ?? "");
  if (indexable && hasNoindex) fail(`${label}: indexable page carries robots "${meta.robots}"`);
  if (!indexable && !hasNoindex) fail(`${label}: utility page is missing a robots noindex`);

  if (indexable) {
    const bare = meta.title.replace(/\s+[—-]\s+Gradr\s*$/, "").trim();
    if (APP_ONLY_TITLES.includes(bare)) {
      fail(`${label}: inherited app metadata — title is the product route title "${bare}"`);
    }
  }
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await serveUnderProductionHosts(context, BASE, [MARKETING_ORIGIN, ...SURFACE_ORIGINS]);
  const page = await context.newPage();

  const seenTitles = new Map();
  const seenDescriptions = new Map();

  for (const path of [...INDEXABLE_PAGES, ...NOINDEX_PAGES]) {
    const indexable = INDEXABLE_PAGES.includes(path);
    await page.goto(`${MARKETING_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const meta = await readMeta(page);
    auditShared(path, meta, { origin: MARKETING_ORIGIN, path, indexable });

    if (indexable && meta.title) {
      const prev = seenTitles.get(meta.title);
      if (prev) fail(`${path}: duplicate <title> — identical to ${prev}`);
      else seenTitles.set(meta.title, path);
    }
    if (indexable && meta.description) {
      const prev = seenDescriptions.get(meta.description);
      if (prev) fail(`${path}: duplicate meta description — identical to ${prev}`);
      else seenDescriptions.set(meta.description, path);
    }
    if (!failures.some((f) => f.startsWith(`${path}:`))) console.log(`✓ ${path} → ${meta.canonical}`);
  }

  // Sibling surfaces own their canonical host.
  for (const origin of SURFACE_ORIGINS) {
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const meta = await readMeta(page);
    const label = `${origin}/`;
    if (!meta.canonical) fail(`${label}: missing canonical`);
    else if (!meta.canonical.startsWith(origin)) {
      fail(`${label}: canonical "${meta.canonical}" leaves its own surface origin`);
    }
    if (meta.canonical?.startsWith(APP_ORIGIN)) fail(`${label}: canonical points at the product`);
    if (!failures.some((f) => f.startsWith(label))) console.log(`✓ ${label} → ${meta.canonical}`);
  }

  await context.close();
} finally {
  await browser.close();
}

// ---- Static artefacts: robots.txt and sitemap.xml -------------------------

const robots = await fetch(`${BASE}/robots.txt`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
if (!robots) fail("robots.txt: not served");
else {
  if (/^\s*Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt: blanket `Disallow: /` blocks the whole site");
  const disallowed = [...robots.matchAll(/^\s*Disallow:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  for (const path of INDEXABLE_PAGES) {
    const hit = disallowed.find((rule) => rule !== "/" && path.startsWith(rule));
    if (hit) fail(`robots.txt: indexable page ${path} is blocked by "Disallow: ${hit}"`);
  }
  if (!/^Sitemap:\s*https:\/\/gradr\.me\/sitemap\.xml/m.test(robots)) {
    fail("robots.txt: missing the https://gradr.me/sitemap.xml directive");
  }
  console.log("✓ robots.txt");
}

const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
if (!sitemap) fail("sitemap.xml: not served");
else {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  for (const loc of locs) {
    if (loc.startsWith(APP_ORIGIN)) fail(`sitemap.xml: lists a product URL (${loc})`);
  }
  const paths = new Set(
    locs
      .filter((l) => l.startsWith(MARKETING_ORIGIN))
      .map((l) => new URL(l).pathname.replace(/(.)\/$/, "$1")),
  );
  for (const path of INDEXABLE_PAGES) {
    if (path === "/landing") continue; // tour page, canonical but intentionally unlisted
    if (!paths.has(path)) fail(`sitemap.xml: missing indexable page ${path}`);
  }
  for (const path of NOINDEX_PAGES) {
    if (paths.has(path)) fail(`sitemap.xml: lists noindex page ${path}`);
  }
  console.log(`✓ sitemap.xml (${locs.length} URLs)`);
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} SEO problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ Deployment SEO audit clean: canonicals, robots rules and no app metadata leakage.");
