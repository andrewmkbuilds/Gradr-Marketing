/**
 * Restores a Supabase session into a Playwright context so the authenticated
 * routes (dashboard, engines, billing) can be audited headlessly.
 *
 * Sources, in order:
 *   1. LOVABLE_BROWSER_SUPABASE_* env vars (injected when a preview session exists)
 *   2. ~/.cache/lovable-auth/session.json (written by `lovable auth-session --json`)
 *
 * Returns true when a session was applied, false when the run must stay signed out.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function fromEnv() {
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!storageKey || !session) return null;
  return { storageKey, session, cookies: process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON ?? null };
}

function fromFile() {
  const path = join(homedir(), ".cache/lovable-auth/session.json");
  if (!existsSync(path)) return null;
  try {
    const minted = JSON.parse(readFileSync(path, "utf8"));
    if (!minted?.storage_key || !minted?.session) return null;
    return {
      storageKey: minted.storage_key,
      session: JSON.stringify(minted.session),
      cookies: minted.cookies ? JSON.stringify(minted.cookies) : null,
    };
  } catch {
    return null;
  }
}

export function loadSession() {
  return fromEnv() ?? fromFile();
}

/**
 * Applies the session to `context`/`page`. `origin` must be the app origin the
 * storage write should land on. No-op (returns false) when no session exists.
 */
export async function applySession(context, page, origin) {
  const creds = loadSession();
  if (!creds) return false;

  if (creds.cookies) {
    try {
      const cookies = JSON.parse(creds.cookies).map((c) => ({ ...c, url: origin }));
      await context.addCookies(cookies);
    } catch {
      /* cookie payload unusable — localStorage path below still applies */
    }
  }

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage disabled */
      }
    },
    [creds.storageKey, creds.session],
  );
  return true;
}
