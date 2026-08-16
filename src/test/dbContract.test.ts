import { describe, it, expect, beforeAll } from "vitest";
import {
  REQUIRED_TABLES,
  REQUIRED_RPCS,
  HEALTH_QUERIES,
  isMissingObject,
} from "@/config/dbContract";

/**
 * Integration tests against the live PostgREST schema cache.
 *
 * They assert that required tables/RPCs exist and that the core reads execute.
 * Authorization errors (401/403) are acceptable — these run unauthenticated;
 * only "object not found" and 5xx responses are treated as failures.
 */

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const enabled = Boolean(url && key);

const headers = {
  apikey: key ?? "",
  Authorization: `Bearer ${key ?? ""}`,
  "Content-Type": "application/json",
};

async function json(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

describe.runIf(enabled)("database contract", () => {
  beforeAll(() => {
    expect(url).toBeTruthy();
  });

  it.each(REQUIRED_TABLES.map((t) => [t] as const))(
    "table %s exists",
    async (table) => {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
      const body = await json(res);
      expect(isMissingObject(body), `${table}: ${JSON.stringify(body)}`).toBe(false);
      expect(res.status).toBeLessThan(500);
    },
    20000,
  );

  it.each(REQUIRED_RPCS.map((r) => [r.name, r] as const))(
    "rpc %s resolves",
    async (_name, rpc) => {
      const res = await fetch(`${url}/rest/v1/rpc/${rpc.name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(rpc.args),
      });
      const body = await json(res);
      expect(isMissingObject(body), `${rpc.name}: ${JSON.stringify(body)}`).toBe(false);
    },
    20000,
  );

  it.each(HEALTH_QUERIES.map((q) => [q.label, q.path] as const))(
    "core query %s executes",
    async (_label, path) => {
      const res = await fetch(`${url}/rest/v1/${path}`, { headers });
      const body = await json(res);
      expect(isMissingObject(body), `${path}: ${JSON.stringify(body)}`).toBe(false);
      expect(res.status).toBeLessThan(500);
    },
    20000,
  );
});
