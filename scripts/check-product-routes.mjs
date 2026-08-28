#!/usr/bin/env node
/**
 * Static route / reference audit for the marketing bundle.
 *
 * The marketing surface must never define an authenticated product route, nor
 * link to one on its own origin. This gate reads the source (no browser, no
 * build) and fails when either appears:
 *
 *   1. A <Route path="/dashboard" …> style declaration for a product prefix
 *      that renders anything other than a hand-off component.
 *   2. A same-origin link (`to="/settings"`, `href="/billing"`) into a product
 *      prefix. Product links must be absolute https://app.gradr.me/... URLs.
 *
 *   node scripts/check-product-routes.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Authenticated product prefixes that may not live on marketing. */
const PRODUCT_PREFIXES = [
  "/dashboard",
  "/settings",
  "/billing",
  "/interview",
  "/interviews",
  "/resume",
  "/resumes",
  "/jobs",
  "/applications",
  "/profile",
];

/** Route elements that are allowed to answer a product path (hand-offs only). */
const HANDOFF_ELEMENTS = [
  "AppSurfaceHandoff",
  "LegacyAppRedirect",
  "ExternalSurfaceRedirect",
  "AppPricingRedirect",
  "Navigate",
  "PortalHandoff",
];

/** Files whose job is to *describe* product paths (link builders, gates, tests). */
const ALLOWLIST = [
  "src/lib/appLinks.ts",
  "src/lib/partnerLinks.ts",
  "src/lib/legacyAppPaths.ts",
  "src/lib/notFoundSuggestions.ts",
  "src/config/domains.ts",
  "src/components/surface/ProductSessionGuard.tsx",
  "src/lib/auth/oauthCallbackGuard.ts",
];

const isAllowed = (rel) => ALLOWLIST.includes(rel) || rel.includes("/test/") || /\.test\.[tj]sx?$/.test(rel);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "design-system" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const matchesPrefix = (path) =>
  PRODUCT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path === `${p}/*`);

const failures = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (isAllowed(rel)) continue;
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const at = `${rel}:${index + 1}`;

    // 1. Route declarations.
    const route = line.match(/<Route\s+[^>]*path=["'`]([^"'`]+)["'`]/);
    if (route && matchesPrefix(route[1])) {
      const element = /element=\{<\s*([A-Za-z0-9_]+)/.exec(line)?.[1];
      if (!element || !HANDOFF_ELEMENTS.includes(element)) {
        failures.push(`${at} — product route "${route[1]}" declared on the marketing surface`);
      }
    }

    // 2. Same-origin links into the product.
    const link = line.match(/(?:to|href)=["'`](\/[^"'`{}\s]*)["'`]/);
    if (link && matchesPrefix(link[1])) {
      failures.push(
        `${at} — same-origin product link "${link[1]}" (use appHref()/appProductHref() for app.gradr.me)`,
      );
    }
  });
}

if (failures.length) {
  console.error("✖ Marketing surface references authenticated product routes:\n");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}

console.log(`✓ No authenticated product routes or same-origin product links in ${relative(ROOT, SRC)}.`);
