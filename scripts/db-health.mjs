#!/usr/bin/env bun
/**
 * Quick database health check.
 *
 * Verifies that every required table resolves in the PostgREST schema cache,
 * that the main RPCs the app calls exist with the expected signatures, and
 * that the core credits / preferences / affiliate / job-match reads execute.
 *
 * Usage: bun run db:health
 */
import {
  REQUIRED_TABLES,
  REQUIRED_RPCS,
  HEALTH_QUERIES,
  isMissingObject,
} from "../src/config/dbContract.ts";

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("✖ Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const failures = [];
let checks = 0;

async function readBody(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function checkTable(table) {
  checks++;
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  const body = await readBody(res);
  if (isMissingObject(body)) failures.push(`table ${table}: ${body.message}`);
  return { table, status: res.status };
}

async function checkRpc({ name, args }) {
  checks++;
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  const body = await readBody(res);
  if (isMissingObject(body)) failures.push(`rpc ${name}: ${body.message}`);
  return { name, status: res.status };
}

async function checkQuery({ label, path }) {
  checks++;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  const body = await readBody(res);
  if (isMissingObject(body)) failures.push(`query ${label}: ${body.message}`);
  else if (res.status >= 500) failures.push(`query ${label}: HTTP ${res.status}`);
  return { label, status: res.status };
}

const started = Date.now();
console.log(`Database health check → ${new URL(url).host}\n`);

const tables = await Promise.all(REQUIRED_TABLES.map(checkTable));
console.log("Tables");
for (const t of tables) console.log(`  ${t.status === 404 ? "✖" : "✓"} ${t.table} (${t.status})`);

const rpcs = await Promise.all(REQUIRED_RPCS.map(checkRpc));
console.log("\nRPCs");
for (const r of rpcs) console.log(`  ${r.status === 404 ? "✖" : "✓"} ${r.name} (${r.status})`);

const queries = await Promise.all(HEALTH_QUERIES.map(checkQuery));
console.log("\nCore queries");
for (const q of queries) console.log(`  ${q.status >= 500 || q.status === 404 ? "✖" : "✓"} ${q.label} (${q.status})`);

console.log(`\n${checks} checks in ${Date.now() - started}ms`);
if (failures.length) {
  console.error(`\n✖ ${failures.length} failure(s):`);
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log("✓ Database healthy");
