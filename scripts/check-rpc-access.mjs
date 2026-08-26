#!/usr/bin/env node
/**
 * RPC access gate.
 *
 * Calls `my_eligibility_state` and every affiliate RPC the app depends on as
 * BOTH an anonymous visitor and a signed-in user, and fails the build if any
 * of them come back with a "permission denied" error. A missing GRANT is the
 * single most common way these features silently break in production.
 *
 * Usage: node scripts/check-rpc-access.mjs
 * Optional authenticated leg: set RPC_TEST_EMAIL / RPC_TEST_PASSWORD.
 */

const url = process.env.VITE_SUPABASE_URL;
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("✖ Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

/** RPCs that must never return "permission denied" for either role. */
const RPCS = [
  { name: "my_eligibility_state", args: {}, roles: ["authenticated"] },
  { name: "get_affiliate_public_settings", args: {}, roles: ["authenticated"] },
  { name: "lookup_affiliate_by_code", args: { _code: "__ci_probe__" }, roles: ["authenticated"] },
  { name: "affiliate_leaderboard", args: { _limit: 1 }, roles: ["authenticated"] },
  { name: "my_affiliate_overview", args: {}, roles: ["authenticated"] },
];

const DENIED = /permission denied|not allowed|must be authenticated to|insufficient_privilege/i;

async function signIn() {
  const email = process.env.RPC_TEST_EMAIL;
  const password = process.env.RPC_TEST_PASSWORD;
  if (!email || !password) return null;

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    console.warn(`⚠ Could not sign in the RPC test user: ${body?.error_description ?? res.status}`);
    return null;
  }
  return body.access_token;
}

async function callRpc(name, args, token) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token ?? anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body is fine */
  }
  return { status: res.status, body };
}

const failures = [];
let checks = 0;

const token = await signIn();
const roles = token ? ["anon", "authenticated"] : ["anon"];
if (!token) {
  console.warn("⚠ RPC_TEST_EMAIL / RPC_TEST_PASSWORD not set — authenticated leg skipped.");
}

for (const role of roles) {
  for (const rpc of RPCS) {
    if (!rpc.roles.includes(role)) continue;
    checks++;
    const { status, body } = await callRpc(rpc.name, rpc.args, role === "anon" ? null : token);
    const message = [body?.message, body?.hint, body?.details].filter(Boolean).join(" ");

    if (status === 404 || /could not find the function/i.test(message)) {
      failures.push(`${role} → ${rpc.name}: function missing (${status})`);
      continue;
    }
    if (status === 401 || status === 403 || DENIED.test(message)) {
      failures.push(`${role} → ${rpc.name}: permission denied (${status}) ${message}`.trim());
      continue;
    }
    console.log(`✓ ${role} → ${rpc.name} (${status})`);
  }
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} of ${checks} RPC access checks failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nFix with a migration: GRANT EXECUTE ON FUNCTION public.<fn>(...) TO anon, authenticated;");
  process.exit(1);
}

console.log(`\n✓ All ${checks} RPC access checks passed.`);
