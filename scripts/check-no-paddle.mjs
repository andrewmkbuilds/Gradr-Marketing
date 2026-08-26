#!/usr/bin/env node
/**
 * Marketing surface must ship no browser-side Paddle code.
 *
 * The billing UI lives in the app project; this project removed
 * `@paddle/paddle-js`, `src/lib/billing/` and `src/lib/paddle.ts`. This gate
 * fails if any of them come back through source, manifests, lockfiles or the
 * built bundle in dist/.
 *
 *   node scripts/check-no-paddle.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const failures = [];

/** Manifests and lockfiles must not declare the browser SDK. */
for (const file of ["package.json", "package-lock.json", "bun.lockb", "bun.lock"]) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, "utf8");
  if (text.includes("@paddle/paddle-js")) failures.push(`${file}: declares @paddle/paddle-js`);
}

/** Deleted client modules must stay deleted. */
for (const path of ["src/lib/billing", "src/lib/paddle.ts", "src/hooks/useSubscription.ts"]) {
  if (existsSync(join(ROOT, path))) failures.push(`${path}: reintroduced (billing belongs to the app project)`);
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "artifacts", "supabase"]);

function walk(dir, onFile) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

/** No source file may import the browser SDK or the deleted modules. */
walk(join(ROOT, "src"), (file) => {
  if (!/\.(ts|tsx|js|jsx|mjs|css)$/.test(file)) return;
  const text = readFileSync(file, "utf8");
  if (/@paddle\/paddle-js|from\s+["']@\/lib\/billing|from\s+["']@\/lib\/paddle["']/.test(text)) {
    failures.push(`${file.slice(ROOT.length + 1)}: imports removed Paddle/billing code`);
  }
});

/** And the built bundle must be free of it too, when a build exists. */
const dist = join(ROOT, "dist");
if (existsSync(dist)) {
  walk(dist, (file) => {
    if (!/\.(js|mjs|css|html|map)$/.test(file)) return;
    if (readFileSync(file, "utf8").includes("@paddle/paddle-js")) {
      failures.push(`${file.slice(ROOT.length + 1)}: build artifact contains @paddle/paddle-js`);
    }
  });
} else {
  console.log("· dist/ not present — skipping build-artifact sweep");
}

if (failures.length) {
  console.error(`✖ ${failures.length} Paddle/billing regression(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("✓ No @paddle/paddle-js or removed billing modules in source, manifests, lockfiles or dist.");
