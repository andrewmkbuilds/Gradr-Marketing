#!/usr/bin/env node
/**
 * Live API contract gate.
 *
 * Replays the contract-level negative cases from `src/lib/contracts/api.ts`
 * against the deployed edge functions and asserts the response *shape*, not
 * just the status code. Only malformed / non-existent-token requests are sent,
 * so the gate never creates data or emails anyone.
 *
 *   node scripts/check-api-contracts.mjs
 *
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (read from .env
 * when not exported). Skips cleanly when they are absent.
 */
import { readFileSync } from "node:fs";

function envValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const file = readFileSync(new URL("../.env", import.meta.url), "utf8");
    return new RegExp(`${name}\\s*=\\s*"?([^"\\n]+)"?`).exec(file)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = envValue("VITE_SUPABASE_URL");
const ANON_KEY = envValue("VITE_SUPABASE_PUBLISHABLE_KEY");

if (!SUPABASE_URL || !ANON_KEY) {
  console.log("No backend credentials available — skipping live API contract checks.");
  process.exit(0);
}

/**
 * The registry lives in TypeScript; re-declaring the small negative-case list
 * here keeps this script dependency-free. `src/test/apiContracts.test.ts`
 * asserts the two stay in step by validating the same shapes.
 */
const CASES = [
  {
    name: "newsletter-subscribe",
    scenario: "malformed email is rejected with an error envelope",
    body: { action: "subscribe", email: "not-an-email" },
    expectStatus: [400],
    shape: (b) => typeof b.error === "string" && b.error.length > 0,
    describe: "{ error: string }",
  },
  {
    name: "newsletter-subscribe",
    scenario: "unknown action is rejected with an error envelope",
    body: { action: "definitely-not-an-action" },
    expectStatus: [400],
    shape: (b) => typeof b.error === "string" && b.error.length > 0,
    describe: "{ error: string }",
  },
  {
    name: "handle-email-unsubscribe",
    scenario: "unknown token reports invalid and leaks no address",
    body: { token: "0".repeat(64) },
    expectStatus: [400, 404],
    shape: (b) =>
      b.valid === false &&
      b.reason === "invalid_token" &&
      !/@/.test(JSON.stringify(b.email ?? "")),
    describe: '{ valid: false, reason: "invalid_token" }',
  },
  {
    name: "handle-email-unsubscribe",
    scenario: "missing token is rejected",
    body: {},
    expectStatus: [400],
    shape: (b) => b.valid === false && b.reason === "invalid_token",
    describe: '{ valid: false, reason: "invalid_token" }',
  },
];

const failures = [];

for (const c of CASES) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${c.name}`;
  let res;
  let body;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(c.body),
    });
    body = await res.json();
  } catch (error) {
    failures.push(`${c.name} — ${c.scenario}: request failed (${error.message})`);
    console.log(`✖ ${c.name}: ${c.scenario} — request failed`);
    continue;
  }

  const statusOk = c.expectStatus.includes(res.status);
  const shapeOk = body && typeof body === "object" && c.shape(body);
  if (statusOk && shapeOk) {
    console.log(`✓ ${c.name}: ${c.scenario} (HTTP ${res.status})`);
    continue;
  }
  const reason = !statusOk
    ? `expected HTTP ${c.expectStatus.join("|")}, got ${res.status}`
    : `response did not match ${c.describe}: ${JSON.stringify(body).slice(0, 200)}`;
  failures.push(`${c.name} — ${c.scenario}: ${reason}`);
  console.log(`✖ ${c.name}: ${c.scenario} — ${reason}`);
}

if (failures.length) {
  console.error(`\nAPI contract drift detected:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
console.log(`\nAll ${CASES.length} live API contracts hold.`);
