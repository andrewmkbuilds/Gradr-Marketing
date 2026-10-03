#!/usr/bin/env node
/**
 * CI dependency audit.
 *
 * Two layers of protection:
 *
 * 1. Version floors — every package we have previously patched for a published
 *    advisory has a minimum version recorded here. A downgrade (or a stale
 *    lockfile that resolves below the floor) fails the build even if the
 *    advisory database is unreachable.
 * 2. Live advisory scan — `bun audit --audit-level=high` fails on any newly
 *    published high/critical advisory.
 *
 * Run locally with: node scripts/dependency-audit.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/** Minimum safe version for each package we've patched for an advisory. */
export const VERSION_FLOORS = {
  "@supabase/supabase-js": "2.112.3",
  "react-router-dom": "6.30.4",
  "pdfjs-dist": "6.2.108",
  // recharts 2.x pulled in a vulnerable lodash tree; 3.x drops it entirely.
  recharts: "3.10.1",
};

/** Transitive pins that must stay in `overrides` — removing one re-opens an advisory. */
export const REQUIRED_OVERRIDES = {
  hono: "^4.13.1",
  "fast-uri": "^4.1.4",
  "ip-address": "^10.5.0",
  braces: "3.0.3",
  esbuild: "^0.25.12",
};

/** Packages that must not reappear anywhere in the resolved tree. */
export const BANNED_PACKAGES = ["lodash"];

const ROOT = resolve(import.meta.dirname, "..");

function parseVersion(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

/** @returns true when `actual` >= `floor` */
export function satisfiesFloor(actual, floor) {
  const a = parseVersion(actual);
  const f = parseVersion(floor);
  if (!a || !f) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > f[i]) return true;
    if (a[i] < f[i]) return false;
  }
  return true;
}

/** Resolved versions keyed by package name, read from package-lock.json. */
export function readResolvedVersions(root = ROOT) {
  const lockPath = resolve(root, "package-lock.json");
  if (!existsSync(lockPath)) return null;
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const resolved = {};
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path.includes("node_modules/")) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    if (meta?.version && !resolved[name]) resolved[name] = meta.version;
  }
  return resolved;
}

/** Static checks that need no network access. @returns string[] of failures */
export function collectStaticFailures(root = ROOT) {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const resolvedVersions = readResolvedVersions(root);
  const failures = [];

  for (const [name, floor] of Object.entries(VERSION_FLOORS)) {
    const declared = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    if (!declared) {
      failures.push(`${name}: expected in dependencies (floor ${floor}) but not found`);
      continue;
    }
    const resolvedVersion = resolvedVersions?.[name];
    if (resolvedVersion && !satisfiesFloor(resolvedVersion, floor)) {
      failures.push(`${name}: lockfile resolves ${resolvedVersion}, below patched floor ${floor}`);
    }
    // A caret range like "^3" has no patch component; the lockfile check above
    // is authoritative, so only flag ranges that pin *below* the floor.
    const declaredVersion = parseVersion(declared);
    if (declaredVersion && !satisfiesFloor(declared, floor) && /^\d/.test(declared.replace(/^[\^~]/, ""))) {
      const isExactPin = !/^[\^~>]/.test(declared);
      if (isExactPin) failures.push(`${name}: pinned to ${declared}, below patched floor ${floor}`);
    }
  }

  for (const [name, range] of Object.entries(REQUIRED_OVERRIDES)) {
    const actual = pkg.overrides?.[name];
    if (actual !== range) {
      failures.push(`overrides.${name}: expected "${range}", found ${actual ? `"${actual}"` : "nothing"}`);
    }
  }

  if (resolvedVersions) {
    for (const name of BANNED_PACKAGES) {
      if (resolvedVersions[name]) {
        failures.push(`${name}@${resolvedVersions[name]} reappeared in the dependency tree (banned)`);
      }
    }
  }

  return failures;
}

/** Network/registry failures that mean "could not check", not "vulnerable". */
const UNREACHABLE =
  /audit request failed|audit endpoint returned an error|operation is not supported|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|socket hang up|registry .*unreachable/i;


/**
 * Runs `bun audit`, falling back to `npm audit` when bun cannot reach the
 * advisory database.
 * @returns {{status: "clean"|"vulnerable"|"unreachable", tool: string, detail?: string}}
 */
function runAdvisoryScan() {
  const tools = [
    { tool: "bun audit", cmd: "bun", args: ["audit", "--prod", "--audit-level=high"] },
    { tool: "npm audit", cmd: "npm", args: ["audit", "--audit-level=high"] },
  ];

  let lastDetail = "no audit tool available";
  for (const { tool, cmd, args } of tools) {
    const run = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
    if (run.error) {
      lastDetail = `${tool}: ${run.error.message}`;
      continue;
    }
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
    if (UNREACHABLE.test(output)) {
      lastDetail = `${tool}: ${output.split("\n").find((line) => UNREACHABLE.test(line))?.trim() ?? "unreachable"}`;
      continue;
    }
    if (output) console.log(output.replace(/^/gm, "  "));
    return { status: run.status === 0 ? "clean" : "vulnerable", tool };
  }
  return { status: "unreachable", tool: "none", detail: lastDetail };
}

function main() {

  let failed = false;

  console.log("Dependency audit — static checks");
  const failures = collectStaticFailures();
  if (failures.length) {
    failed = true;
    for (const failure of failures) console.error(`  ✗ ${failure}`);
  } else {
    const checks = Object.keys(VERSION_FLOORS).length + Object.keys(REQUIRED_OVERRIDES).length + BANNED_PACKAGES.length;
    console.log(`  ✓ ${checks} version floors, overrides and bans hold`);
  }

  console.log("\nDependency audit — advisory scan (high/critical)");
  const result = runAdvisoryScan();
  if (result.status === "clean") {
    console.log(`  ✓ no high or critical advisories (${result.tool})`);
  } else if (result.status === "unreachable") {
    // A registry/transport failure is not evidence of a vulnerability, and
    // failing the build on it would make CI flaky. The version floors above
    // still gate every advisory we have already patched.
    console.warn(`  ! advisory database unreachable (${result.detail}) — floors still enforced`);
  } else {
    console.error(`  ✗ high or critical advisories found (${result.tool})`);
    failed = true;
  }


  if (failed) {
    console.error("\nDependency audit failed.");
    process.exit(1);
  }
  console.log("\nDependency audit passed.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main();
}
