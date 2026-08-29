/**
 * Shared Chromium launcher + page-sampling helpers for the Playwright-based CI gates.
 *
 * CI images and the local sandbox store the browser in different places, so
 * every script resolved its own executable path. This centralises that.
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

export function findChromium() {
  for (const envPath of [process.env.PLAYWRIGHT_CHROMIUM_PATH, process.env.CHROME_PATH]) {
    if (envPath && existsSync(envPath)) return envPath;
  }
  for (const root of ["/opt/ms-playwright", join(process.env.HOME ?? "", ".cache/ms-playwright")]) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium"))) {
      // Playwright renamed the Linux payload directory to `chrome-linux64`
      // in recent builds; keep the older names for pinned CI images.
      for (const rel of [
        "chrome-linux64/chrome",
        "chrome-linux/chrome",
        "chrome-linux/headless_shell",
        "chrome-linux64/chrome-headless-shell",
      ]) {
        const candidate = join(root, dir, rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  // Nix-based dev sandboxes ship a self-contained Chromium instead of the
  // dynamically linked download, which fails on missing system libraries.
  if (existsSync("/nix/store")) {
    for (const dir of readdirSync("/nix/store").filter((d) => d.endsWith("-playwright-chromium"))) {
      const candidate = join("/nix/store", dir, "chrome-linux/chrome");
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export async function launchChromium() {
  try {
    return await chromium.launch();
  } catch {
    const executablePath = findChromium();
    if (!executablePath) throw new Error("No Chromium build available for Playwright.");
    return chromium.launch({ executablePath });
  }
}

/** Backwards-compatible alias used by older audit scripts. */
export const launchBrowser = launchChromium;

/**
 * Sample the DOM while a route boots to catch two visual regressions:
 *  - the pre-hydration splash never dismissing, and
 *  - the crawler-only <noscript> SEO fallback becoming visible to JS users.
 *
 * If the page navigates while we sample (e.g., an external hand-off), we
 * return what we observed so far rather than crashing the gate.
 */
export async function sampleForFlash(page, { samples = 30, intervalMs = 60 } = {}) {
  const seoPhrases = [
    "not a grading, marking or test-score tool",
    "Gradr — Your AI Career Command Center",
    "AI career command center for resume analysis",
  ];
  const seoVisibleFrames = [];
  let splashStuck = false;
  let completed = 0;

  for (let i = 0; i < samples; i++) {
    try {
      const snapshot = await page.evaluate((phrases) => {
        const splash = document.getElementById("app-splash");
        const bodyText = document.body?.innerText ?? "";
        const found = phrases.find((p) => bodyText.includes(p));
        return {
          splashPresent: Boolean(splash && splash.offsetParent !== null),
          phrase: found ?? null,
        };
      }, seoPhrases);

      if (snapshot.phrase) {
        seoVisibleFrames.push({ sample: i, phrase: snapshot.phrase });
      }
      if (snapshot.splashPresent) splashStuck = true;
      completed++;
    } catch {
      // Page navigated away (external hand-off) — stop sampling.
      break;
    }

    if (i < samples - 1) {
      await page.waitForTimeout(intervalMs).catch(() => {});
    }
  }

  return { samples: completed, seoVisibleFrames, splashStuck };
}
