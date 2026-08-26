/**
 * Shared inventory + host plumbing for the marketing CI gates.
 *
 * The bundle decides which surface renders from `window.location.hostname`, so
 * every gate that has to reason about production behaviour serves the locally
 * built bundle *under the real hostname*: requests to https://gradr.me (and the
 * sibling subdomains) are proxied to the local origin, and app.gradr.me is
 * stubbed so a hand-off never leaves the sandbox.
 */

export const APP_ORIGIN = "https://app.gradr.me";
export const MARKETING_ORIGIN = "https://gradr.me";
export const APP_STUB_MARKER = "gradr-app-stub";

/** Public, indexable pages on the primary marketing host. */
export const INDEXABLE_PAGES = [
  "/",
  "/landing",
  "/ats-resume-checker",
  "/ai-cover-letter-generator",
  "/ai-interview-coach",
  "/job-application-tracker",
  "/career-advice",
  "/job-search",
  "/blog/ai-resume-optimization",
  "/legal",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/cookie-policy",
  "/childrens-privacy",
  "/dpa",
  "/acceptable-use",
  "/ai-disclaimer",
  "/disclaimer",
  "/affiliate-disclosure",
];

/** Utility pages that must stay out of the index. */
export const NOINDEX_PAGES = ["/unsubscribe", "/newsletter/confirm"];

/** Marketing-facing hostnames served by this bundle. */
export const MARKETING_HOSTS = [
  "https://gradr.me",
  "https://marketing.gradr.me",
  "https://news.gradr.me",
  "https://docs.gradr.me",
  "https://support.gradr.me",
  "https://status.gradr.me",
  "https://affiliates.gradr.me",
];

/** Retired product paths that must never resolve to product content here. */
export const RETIRED_PRODUCT_PATHS = [
  "/login",
  "/signup",
  "/register",
  "/dashboard",
  "/account",
  "/settings",
  "/billing",
  "/credits",
  "/resume",
  "/match",
  "/jobs",
  "/pipeline",
  "/apply",
  "/interview",
  "/growth",
  "/admin",
  "/onboarding",
  "/welcome",
];

/** DOM signatures that only exist inside the authenticated product. */
export const APP_ONLY_SELECTORS = [
  "[data-app-shell]",
  "[data-sidebar]",
  '[data-testid="app-sidebar"]',
  'input[type="password"]',
  "form[data-auth-form]",
];

/**
 * Proxy the given production origins to a locally served build and stub the
 * product origin. Call once per Playwright context, before the first goto().
 */
export async function serveUnderProductionHosts(context, base, origins = [MARKETING_ORIGIN]) {
  for (const origin of origins) {
    await context.route(`${origin}/**`, async (route) => {
      const url = new URL(route.request().url());
      const res = await fetch(`${base}${url.pathname}${url.search}`).catch(() => null);
      if (!res) return route.abort();
      return route.fulfill({
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "text/html" },
        body: Buffer.from(await res.arrayBuffer()),
      });
    });
  }
  await context.route(`${APP_ORIGIN}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><body data-${APP_STUB_MARKER}>app</body>`,
    }),
  );
}

/** Resolve the base URL a gate should proxy from (argv, env, then dev server). */
export function resolveBase(argv = process.argv.slice(2)) {
  const fromArgs = argv.find((a) => a.startsWith("http"));
  return (fromArgs ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
}
