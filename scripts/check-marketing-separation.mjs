#!/usr/bin/env node
/**
 * Marketing / product separation check (Playwright).
 *
 * This project serves the public Gradr brand surfaces only. Two regressions
 * would break that separation, so both are asserted here on every public page:
 *
 *  1. Any link that points into the product must be an absolute
 *     https://app.gradr.me/... URL — a relative product link would resolve on
 *     the marketing bundle, where no product route exists.
 *  2. No authenticated route may be reachable locally: /dashboard, /login,
 *     /settings, … must either render the 404 hand-off (preview, where there is
 *     no app deployment) or navigate to app.gradr.me (production).
 *
 *   node scripts/check-marketing-separation.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);
const APP_ORIGIN = "https://app.gradr.me";

/** Public marketing pages whose links are audited. */
const PAGES = [
  "/",
  "/ats-resume-checker",
  "/ai-interview-coach",
  "/ai-cover-letter-generator",
  "/job-application-tracker",
  "/career-advice",
  "/job-search",
  "/privacy",
  "/terms",
];

/** Legacy / product paths that must never render a product page here. */
const PRODUCT_PATHS = [
  "/dashboard",
  "/login",
  "/signup",
  "/register",
  "/settings",
  "/billing",
  "/credits",
  "/resume",
  "/match",
  "/interview",
  "/admin",
  "/admin/webhook-logs",
];

/**
 * Path prefixes that only exist on the product. A same-origin link to one of
 * these is the failure we are guarding against.
 */
const PRODUCT_PREFIXES = [
  "/dashboard",
  "/auth",
  "/login",
  "/signup",
  "/register",
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
  "/welcome",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
];

function findChromium() {
  for (const envPath of [process.env.PLAYWRIGHT_CHROMIUM_PATH, process.env.CHROME_PATH]) {
    if (envPath && existsSync(envPath)) return envPath;
  }
  for (const root of ["/opt/ms-playwright", join(process.env.HOME ?? "", ".cache/ms-playwright")]) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium"))) {
      for (const rel of [
        "chrome-linux/chrome",
        "chrome-linux/headless_shell",
        "chrome-linux64/chrome-headless-shell",
      ]) {
        const candidate = join(root, dir, rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

const failures = [];

/** Every product-shaped link on a page must be absolute and on app.gradr.me. */
async function auditLinks(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  // Some paths hand off client-side; let navigation settle before reading the
  // DOM so the evaluate below cannot race a destroyed execution context.
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1200);
  const hrefs = await page.$$eval("a[href]", (nodes) => nodes.map((n) => n.getAttribute("href")));
  for (const href of hrefs) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    if (href.startsWith("http")) {
      const url = new URL(href);
      if (url.hostname === "app.gradr.me") continue;
      // Off-site links to other hosts are fine; only app paths are audited.
      if (PRODUCT_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
        if (url.hostname.endsWith("gradr.me")) {
          failures.push(`${path}: product link on the wrong host → ${href}`);
        }
      }
      continue;
    }
    const pathname = href.split(/[?#]/)[0].toLowerCase();
    if (PRODUCT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      failures.push(`${path}: relative product link "${href}" must be an absolute ${APP_ORIGIN} URL`);
    }
  }
}

/** A product path must 404 here (preview) or leave for app.gradr.me (prod). */
async function auditProductPath(context, path) {
  const page = await context.newPage();
  await page.route("https://app.gradr.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>app</body></html>" }),
  );
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const url = page.url();
  if (url.startsWith(APP_ORIGIN)) {
    await page.close();
    return;
  }
  const notFound = await page.getByText(/Page not found|404/i).count();
  if (notFound === 0) {
    failures.push(`${path}: still reachable on the marketing surface (no 404 hand-off) — ${url}`);
  }
  await page.close();
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: findChromium() });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();

  for (const path of PAGES) await auditLinks(page, path);
  await page.close();
  for (const path of PRODUCT_PATHS) await auditProductPath(context, path);

  await browser.close();
}

await run();

if (failures.length) {
  console.error("Marketing separation check failed:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log(
  `Marketing separation check passed (${PAGES.length} pages audited, ${PRODUCT_PATHS.length} product paths unreachable)`,
);
