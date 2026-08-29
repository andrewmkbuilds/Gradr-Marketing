#!/usr/bin/env node
/**
 * Bundle size budget gate.
 *
 * Measures the *gzipped* size of the production build (that is what users
 * download) and fails when any budget in scripts/perf-budgets.json is exceeded.
 * Also prints the ten largest chunks so a regression is diagnosable from the CI
 * log without downloading artifacts.
 *
 *   bun run build && node scripts/check-bundle-budget.mjs [distDir]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST = path.resolve(process.argv[2] || "dist");
const budgets = JSON.parse(
  readFileSync(new URL("./perf-budgets.json", import.meta.url), "utf8"),
).bundle;

/** Every file under dist, flattened. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`No build found at ${DIST}. Run \`bun run build\` first.`);
  process.exit(1);
}

const gz = (file) => gzipSync(readFileSync(file)).length;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const measured = files.map((file) => ({
  file: path.relative(DIST, file),
  ext: path.extname(file),
  gzip: gz(file),
}));

const js = measured.filter((m) => m.ext === ".js");
const css = measured.filter((m) => m.ext === ".css");

// The entry is whatever the HTML loads as a module — the bytes on the critical path.
const html = readFileSync(path.join(DIST, "index.html"), "utf8");
const entryNames = [...html.matchAll(/<script[^>]+src="\/?([^"]+\.js)"/g)].map((m) => m[1]);
const entryJs = js
  .filter((m) => entryNames.some((n) => n.endsWith(m.file) || m.file.endsWith(n.replace(/^\//, ""))))
  .reduce((sum, m) => sum + m.gzip, 0);

const totals = {
  entryJs,
  totalJs: js.reduce((s, m) => s + m.gzip, 0),
  totalCss: css.reduce((s, m) => s + m.gzip, 0),
  largestChunk: js.reduce((max, m) => Math.max(max, m.gzip), 0),
  totalAssets: measured.reduce((s, m) => s + m.gzip, 0),
};

console.log("Largest chunks (gzipped):");
for (const m of [...measured].sort((a, b) => b.gzip - a.gzip).slice(0, 10)) {
  console.log(`  ${kb(m.gzip).padStart(10)}  ${m.file}`);
}

const failures = [];
console.log("\nBudgets:");
for (const [key, budget] of Object.entries(budgets)) {
  if (key.startsWith("$")) continue;
  const actual = totals[key] ?? 0;
  const pct = ((actual / budget) * 100).toFixed(0);
  const ok = actual <= budget;
  console.log(`  ${ok ? "✓" : "✖"} ${key}: ${kb(actual)} / ${kb(budget)} (${pct}%)`);
  if (!ok) failures.push(`${key} is ${kb(actual)}, budget ${kb(budget)}`);
}

if (entryJs === 0) {
  failures.push("could not resolve the entry script from index.html — the budget was not measured");
}

if (failures.length) {
  console.error(`\nBundle budget exceeded:\n - ${failures.join("\n - ")}`);
  console.error(
    "\nShrink the payload (lazy-load the route, drop the dependency) rather than raising the budget.",
  );
  process.exit(1);
}
console.log("\nAll bundle budgets are within limits.");
