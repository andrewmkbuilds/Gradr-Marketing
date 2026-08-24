#!/usr/bin/env node
/**
 * `?next=` deep-link validation check (Playwright).
 *
 * The open-redirect rules must hold in the *shipped* bundle, not just in unit
 * tests, so this asserts them against the real page — preview build and
 * production — through the read-only `window.__gradrResolveNext` probe that
 * `src/lib/authHandoff.ts` exposes.
 *
 *   node scripts/check-next-validation.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

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

/** [input, expected status, expected value, expected sanitization reason]. */
const CASES = [
  ["/interview", "accepted", "/interview", null],
  ["/resume?tab=score", "accepted", "/resume?tab=score", null],
  ["//evil.example", "sanitized", null, "protocol_relative"],
  ["https://evil.example/steal", "sanitized", null, "not_absolute_path"],
  ["/\\evil.example", "sanitized", null, "backslash_escape"],
  ["javascript:alert(1)", "sanitized", null, "not_absolute_path"],
  ["/auth", "sanitized", null, "auth_loop"],
  ["/reset-password", "sanitized", null, "auth_loop"],
  ["/", "sanitized", null, "root_path"],
  ["/" + "a".repeat(600), "sanitized", null, "too_long"],
  ["/resume%2F%E0%A4%A", "sanitized", null, "decode_failed"],
];

const failures = [];

const browser = await chromium.launch({ headless: true, executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof window.__gradrResolveNext === "function", null, {
  timeout: 15000,
});

for (const [input, status, value, reason] of CASES) {
  const got = await page.evaluate((raw) => window.__gradrResolveNext(raw), input);
  if (got.status !== status) failures.push(`${input}: status ${got.status} (want ${status})`);
  if ((got.value ?? null) !== value) failures.push(`${input}: value ${got.value} (want ${value})`);
  if ((got.reason ?? null) !== reason) {
    failures.push(`${input}: reason ${got.reason} (want ${reason})`);
  }
}

// An absent `next` must not be reported as a sanitization.
const none = await page.evaluate(() => window.__gradrResolveNext(undefined));
if (none.status !== "none" || none.reason) failures.push(`missing next: ${JSON.stringify(none)}`);

await browser.close();

if (failures.length) {
  console.error("next validation check failed:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`next validation check passed (${CASES.length + 1} cases) at ${BASE}`);
