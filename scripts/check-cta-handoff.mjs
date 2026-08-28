#!/usr/bin/env node
/**
 * Landing CTA hand-off check (Playwright).
 *
 * Every "Log in" / "Get started" / feature CTA on the landing page must leave
 * this marketing bundle for https://app.gradr.me/auth. A CTA that navigates
 * in-router lands on the NotFound hand-off route instead, which is the exact
 * regression this guards against — on preview *and* production, since the
 * marketing surface has no /auth route on either.
 *
 *   node scripts/check-cta-handoff.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const APP_AUTH = "https://app.gradr.me/auth";

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

/** CTAs to click, by accessible name, with the expected `next` deep link. */
const CTAS = [
  { name: "Log in", next: null },
  { name: "Get started", next: null },
  { name: "Get started free", next: null },
  { name: "Optimize my resume", next: "/resume" },
  { name: "Find my matches", next: "/match" },
  { name: "Run a mock interview", next: "/interview" },
  { name: "Rewrite my resume", next: "/resume" },
];

const failures = [];

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: findChromium() });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });

  for (const cta of CTAS) {
    const page = await context.newPage();
    // The app origin is not served from this sandbox: stub it so the click can
    // complete and we can assert the URL the browser actually asked for.
    await page.route("https://app.gradr.me/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>app</body></html>" }),
    );
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    // Auth CTAs are anchors (so they can be opened in a new tab); feature CTAs
    // are still buttons. Accept either role.
    const link = page.getByRole("link", { name: cta.name, exact: true }).first();
    const button = (await link.count()) > 0
      ? link
      : page.getByRole("button", { name: cta.name, exact: true }).first();
    if ((await button.count()) === 0) {
      failures.push(`CTA not found: ${cta.name}`);
      await page.close();
      continue;
    }
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.waitForURL(/app\.gradr\.me/, { timeout: 8000 }).catch(() => {});
    const url = page.url();
    if (!url.startsWith(APP_AUTH)) {
      failures.push(`"${cta.name}" went to ${url} instead of ${APP_AUTH}`);
    } else if (cta.next && !url.includes(`next=${encodeURIComponent(cta.next)}`)) {
      failures.push(`"${cta.name}" lost its deep link (${cta.next}): ${url}`);
    }
    const notFound = await page.getByText("Page not found").count();
    if (notFound > 0) failures.push(`"${cta.name}" rendered the NotFound hand-off`);
    await page.close();
  }

  await browser.close();
}

await run();

if (failures.length) {
  console.error("CTA hand-off check failed:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`CTA hand-off check passed (${CTAS.length} CTAs → ${APP_AUTH})`);
