#!/usr/bin/env node
/**
 * Production domain verification for Gradr's subdomain architecture.
 *
 * Checks, for every hostname in the surface map:
 *   1. DNS resolves (and, for Lovable hosting, points at the expected A record)
 *   2. HTTPS answers with a valid certificate (no TLS error)
 *   3. The served HTML is the Gradr bundle (so the host is wired to this project)
 *
 * Usage:  node scripts/check-domains.mjs [--json]
 * Exit code 1 when any hostname fails, so CI can gate on it.
 */
import { promises as dns } from "node:dns";

const LOVABLE_A_RECORD = "185.158.133.1";

const HOSTS = [
  { host: "gradr.me", purpose: "Main site / landing" },
  { host: "www.gradr.me", purpose: "Redirect to gradr.me", expectRedirect: true },
  { host: "app.gradr.me", purpose: "Authenticated app" },
  { host: "marketing.gradr.me", purpose: "Marketing" },
  { host: "docs.gradr.me", purpose: "Documentation" },
  { host: "news.gradr.me", purpose: "News / blog" },
  { host: "partners.gradr.me", purpose: "Partner portal" },
  { host: "affiliates.gradr.me", purpose: "Legacy partner portal alias" },
  { host: "status.gradr.me", purpose: "Service status" },
  { host: "support.gradr.me", purpose: "Support / help center" },
];

async function resolve(host) {
  try {
    return await dns.resolve4(host);
  } catch {
    try {
      const cname = await dns.resolveCname(host);
      return cname;
    } catch {
      return null;
    }
  }
}

async function check({ host, purpose, expectRedirect }) {
  const records = await resolve(host);
  const result = { host, purpose, records, dns: Boolean(records), https: null, ok: false, notes: [] };

  if (!records) {
    result.notes.push("No DNS record — create the A record at the registrar and add the domain in Lovable.");
    return result;
  }
  if (records.every((r) => /^\d+\.\d+\.\d+\.\d+$/.test(r)) && !records.includes(LOVABLE_A_RECORD)) {
    result.notes.push(`A record is ${records.join(", ")} — expected ${LOVABLE_A_RECORD}.`);
  }

  try {
    const response = await fetch(`https://${host}/`, { redirect: "manual" });
    result.https = response.status;
    const location = response.headers.get("location") ?? "";
    if (expectRedirect) {
      result.ok = response.status >= 300 && response.status < 400;
      if (!result.ok) result.notes.push(`Expected a redirect, got ${response.status}.`);
      return result;
    }
    if (response.status >= 300 && response.status < 400 && /gradr\.me/.test(location)) {
      result.notes.push(
        `Redirects to ${location} — hosting treats this as an alias of the primary domain, not its own surface. ` +
          `Serve it independently, or keep using path routing on gradr.me.`,
      );
      return result;
    }
    const body = await response.text();
    const isGradr = /gradr/i.test(body);
    result.ok = response.ok && isGradr;
    if (!response.ok) result.notes.push(`HTTPS returned ${response.status}.`);
    else if (!isGradr) result.notes.push("Served HTML is not the Gradr bundle — domain points elsewhere.");

  } catch (error) {
    result.notes.push(`HTTPS failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return result;
}

const results = [];
for (const entry of HOSTS) results.push(await check(entry));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    console.log(
      `${status.padEnd(4)} ${r.host.padEnd(22)} ${String(r.https ?? "-").padEnd(4)} ${(r.records ?? ["no dns"]).join(",")}`,
    );
    for (const note of r.notes) console.log(`      ${note}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} hostnames healthy.`);
process.exit(failed.length ? 1 : 0);
