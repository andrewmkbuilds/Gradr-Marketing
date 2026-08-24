#!/usr/bin/env node
/**
 * Brand asset integrity gate.
 *
 * The Gradr mark has been silently replaced or re-exported more than once. Every
 * brand file is hashed and compared against a committed manifest, so any edit,
 * re-compression, or deletion fails CI instead of shipping.
 *
 *   node scripts/check-brand-assets.mjs            # verify
 *   node scripts/check-brand-assets.mjs --update   # re-record hashes (intended change)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MANIFEST = join(ROOT, "tests/assets/brand-hashes.json");
const UPDATE = process.argv.includes("--update");

/** Files and directories that carry the brand identity. */
const TRACKED = [
  "public/gradr-logo.png",
  "public/gradr-logo.svg",
  "public/gradr-logo-dark.png",
  "public/gradr-logo-dark.svg",
  "public/gradr-logo-mono-black.png",
  "public/gradr-logo-mono-white.png",
  "public/gradr-logo-mono.svg",
  "public/gradr-logo-256.png",
  "public/gradr-logo-dark-256.png",
  "public/gradr-lockup.png",
  "public/gradr-lockup-dark.png",
  "public/gradr-avatar-256.png",
  "public/gradr-symbol-compact.svg",
  "public/gradr-mask-icon.svg",
  "public/favicon.png",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/email-logo-144.png",
  "public/brand",
];

function walk(target) {
  const abs = join(ROOT, target);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isDirectory()) {
    return readdirSync(abs)
      .flatMap((entry) => walk(join(target, entry)))
      .sort();
  }
  return [target];
}

const files = TRACKED.flatMap(walk).sort();
const current = {};
for (const file of files) {
  current[file] = createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex");
}

if (UPDATE || !existsSync(MANIFEST)) {
  mkdirSync(join(ROOT, "tests/assets"), { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    `${UPDATE ? "Updated" : "Created"} ${relative(ROOT, MANIFEST)} with ${files.length} brand asset hash(es).`,
  );
  process.exit(0);
}

const expected = JSON.parse(readFileSync(MANIFEST, "utf8"));
const failures = [];

for (const [file, hash] of Object.entries(expected)) {
  if (!(file in current)) {
    failures.push(`missing brand asset: ${file}`);
    continue;
  }
  if (current[file] !== hash) {
    failures.push(`modified brand asset: ${file}\n      expected ${hash}\n      actual   ${current[file]}`);
  }
}
for (const file of Object.keys(current)) {
  if (!(file in expected)) failures.push(`untracked new brand asset: ${file} (run --update to record it)`);
}

if (failures.length) {
  console.error(`✖ Brand asset integrity check failed (${failures.length} problem(s)):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nBrand files must not change. If the change is intentional and approved, re-run with --update and commit the manifest.",
  );
  process.exit(1);
}

console.log(`✓ ${files.length} brand assets match tests/assets/brand-hashes.json.`);
