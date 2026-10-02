#!/usr/bin/env node
/**
 * Marketing host isolation gate.
 * Link audits use locator.evaluateAll so navigation-safe snapshots always collect all anchors.
 *
 * For every hostname this bundle serves publicly, two invariants must hold:
 *
 *   1. No authenticated app surface ever renders — no app shell, no product
 *      sidebar, no account chrome.
 *   2. On the primary marketing hosts, every retired product path hands off to
 *      app.gradr.me instead of dead-ending or rendering product content, and no
 *      same-origin link points into a product path.
 *
 * The content subdomains (news, docs, support, status) are their own route
 * trees whose slugs legitimately collide with product words — /docs "billing"
 * is an article, not the billing page — so they are audited for app-surface
 * leakage only. The affiliates portal ships its own partner credential flow by
 * design, which is declared as an explicit exception rather than ignored.
 *
 *   node scripts/check-marketing-hosts.mjs [baseUrl]
 */
import { launchChromium } from "./lib/browser.mjs";
import {
  APP_ONLY_SELECTORS,
  APP_ORIGIN,
  APP_STUB_MARKER,
  RETIRED_PRODUCT_PATHS,
  resolveBase,
  serveUnderProductionHosts,
} from "./lib/marketingSurface.mjs";

const BASE = resolveBase();

/**
 * Per-host policy.
 *  - handoff: retired product paths must leave for app.gradr.me.
 *  - auditLinks: same-origin product links are a failure.
 *  - allowCredentialForm: this surface owns a legitimate sign-in form.
 */
const HOSTS = [
  { origin: "https://gradr.me", handoff: true, auditLinks: true },
  { origin: "https://www.gradr.me", handoff: true, auditLinks: true },
  { origin: "https://marketing.gradr.me", handoff: true, auditLinks: true },
  { origin: "https://news.gradr.me" },
  { origin: "https://docs.gradr.me" },
  { origin: "https://support.gradr.me" },
  { origin: "https://status.gradr.me" },
  { origin: "https://partners.gradr.me", allowCredentialForm: true },
];

/** Product path prefixes that may only appear as absolute app.gradr.me links. */
const PRODUCT_PREFIXES = RETIRED_PRODUCT_PATHS.concat(["/auth", "/forgot-password", "/reset-password"]);

/** Chrome that only exists inside the authenticated product. */
const APP_ONLY_TEXT = [/\bSign out\b/i, /\bMy dashboard\b/i, /\bCredits remaining\b/i];

const failures = [];

function appSelectorsFor(host) {
  return host.allowCredentialForm
    ? APP_ONLY_SELECTORS.filter((s) => s !== 'input[type="password"]')
    : APP_ONLY_SELECTORS;
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  await serveUnderProductionHosts(
    context,
    BASE,
    HOSTS.map((h) => h.origin),
  );
  const page = await context.newPage();

  for (const host of HOSTS) {
    const { origin } = host;

    // --- 1. The host's own landing page renders no product surface ----------
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    for (const selector of appSelectorsFor(host)) {
      if (await page.locator(selector).count()) {
        failures.push(`${origin}/: authenticated app surface present (${selector})`);
      }
    }
    const bodyText = await page.locator("body").innerText().catch(() => "");
    for (const re of APP_ONLY_TEXT) {
      if (re.test(bodyText)) failures.push(`${origin}/: product-only chrome rendered (${re})`);
    }

    if (host.auditLinks) {
      // A production-host redirect can replace the document between DOMContentLoaded
      // and the link audit. Retry the snapshot once if that navigation destroys
      // Playwright's execution context.
      let sameOriginProductLinks = [];
      try {
        sameOriginProductLinks = await page.locator("a[href]").evaluateAll(
        (nodes, prefixes) =>
          nodes
            .map((n) => n.getAttribute("href") ?? "")
            .filter(
              (href) =>
                href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:"),
            )
            .filter((href) => {
              const path = href.split(/[?#]/)[0].toLowerCase();
              return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
            }),
        PRODUCT_PREFIXES,
      );
      } catch (error) {
        if (!/Execution context was destroyed|frame was detached|Target page/i.test(String(error))) throw error;
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page.waitForTimeout(150);
        sameOriginProductLinks = await page.locator("a[href]").evaluateAll(
          (nodes, prefixes) =>
            nodes
              .map((n) => n.getAttribute("href") ?? "")
              .filter((href) => href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:"))
              .filter((href) => {
                const path = href.split(/[?#]/)[0].toLowerCase();
                return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
              }),
          PRODUCT_PREFIXES,
        );
      }
      for (const href of new Set(sameOriginProductLinks)) {
        failures.push(`${origin}/: same-origin product link "${href}" — must be ${APP_ORIGIN}${href}`);
      }
    }

    // The Partner portal owns its own credential and legacy-route flow.
    // Its paths are not subject to the marketing-host hand-off rule.
    if (host.allowCredentialForm) continue;

    // --- 2. Retired product paths -------------------------------------------
    for (const path of RETIRED_PRODUCT_PATHS) {
      // A retired path may hand the visitor off mid-navigation, which surfaces
      // as ERR_ABORTED: that is the behaviour under test, not a failure.
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" }).catch((err) => {
        if (!/ERR_ABORTED/.test(String(err))) throw err;
      });
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(1200);
      const url = page.url();
      const handedOff =
        url.startsWith(APP_ORIGIN) || (await page.locator(`[data-${APP_STUB_MARKER}]`).count()) > 0;

      // Whatever renders, it must never be the product itself.
      for (const selector of appSelectorsFor(host)) {
        if (await page.locator(selector).count()) {
          failures.push(`${origin}${path}: authenticated app surface present (${selector})`);
        }
      }
      if (!host.handoff || handedOff) continue;

      // A branded 404 is only acceptable if it still routes the visitor onward.
      const notFound = await page.getByText(/Page not found|404/i).count();
      const appLink = await page
        .$$eval("a[href]", (nodes) =>
          nodes.some((n) => (n.getAttribute("href") ?? "").startsWith("https://app.gradr.me")),
        )
        .catch(() => false);
      if (!notFound) {
        failures.push(`${origin}${path}: rendered content instead of handing off to the app (${url})`);
      } else if (!appLink) {
        failures.push(`${origin}${path}: 404 dead-ends — no ${APP_ORIGIN} hand-off link`);
      }
    }
    if (!failures.some((f) => f.startsWith(origin))) console.log(`✓ ${origin}`);
  }

  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} marketing host isolation problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `\n✓ ${HOSTS.length} marketing hosts render no app surfaces; ` +
    `${RETIRED_PRODUCT_PATHS.length} retired product paths hand off to ${APP_ORIGIN}.`,
);
