#!/usr/bin/env node
/**
 * Build-time guard against unknown Tailwind utility classes.
 *
 * A class like `border-border` only works when the matching design token exists
 * in tailwind.config / index.css. When the token is missing Tailwind silently
 * emits nothing, and the UI can end up unstyled (or, with @apply, the build
 * breaks at runtime and the user sees a blank screen).
 *
 * This script compiles the real Tailwind pipeline over the real sources and
 * then verifies that every token-shaped utility referenced in the codebase is
 * actually present in the generated CSS.
 *
 * Usage: node scripts/check-tailwind-classes.mjs
 * Exit 0 = every referenced utility compiles, 1 = unknown utilities found.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import fg from "fast-glob";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

/**
 * Utility prefixes that resolve against design tokens. These are the ones that
 * silently disappear when a token is renamed or missing.
 */
const TOKEN_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "ring-offset",
  "outline",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
  "shadow",
  "divide",
  "accent",
  "caret",
  "decoration",
  "placeholder",
];

const CLASS_ATTR = /(?:class(?:Name)?\s*=\s*|cva\(|cn\(|clsx\(|tw`)/;
const STRING_LITERAL = /["'`]([^"'`\n]{2,400})["'`]/g;

/** Classes we intentionally never emit as CSS (data hooks, JS-only markers). */
const IGNORE = [
  /^(group|peer)(\/|-)/,
  /^(text|bg|border|from|to|via|shadow|ring|fill|stroke)-\[/, // arbitrary values
  /\$\{/, // template interpolation
  /^(dark|light|hover|focus|active|group-hover|peer-focus):/,
];

function collectCandidates() {
  const files = fg.sync(["src/**/*.{ts,tsx,js,jsx}", "index.html"], {
    cwd: ROOT,
    absolute: true,
    // Vendored design-system source is owned by the library project.
    ignore: ["src/design-system/**"],
  });
  const found = new Map(); // class -> Set(files)
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (!CLASS_ATTR.test(src) && !file.endsWith(".html")) continue;
    for (const [, literal] of src.matchAll(STRING_LITERAL)) {
      // Reject prose: real class lists are lowercase and punctuation-free.
      if (!/^[a-z0-9\s:\-/[\].%#()!]+$/.test(literal)) continue;
      for (const raw of literal.split(/\s+/)) {
        const cls = raw.trim();
        if (!cls || IGNORE.some((re) => re.test(cls))) continue;
        const base = cls.replace(/^!/, "").split(":").pop();
        if (!base) continue;
        const negated = base.replace(/^-/, "");
        const prefix = TOKEN_PREFIXES.find((p) => negated.startsWith(`${p}-`));
        if (!prefix) continue;
        const token = negated.slice(prefix.length + 1);
        // Only check single-segment design tokens (border-border, bg-surface-2…)
        if (!/^[a-z0-9][a-z0-9-]*$/.test(token)) continue;
        if (!found.has(negated)) found.set(negated, new Set());
        found.get(negated).add(file.replace(`${ROOT}/`, ""));
      }
    }
  }
  return found;
}

async function compileCss() {
  const entry = join(ROOT, "src/index.css");
  const css = readFileSync(entry, "utf8");
  const dir = mkdtempSync(join(tmpdir(), "tw-check-"));
  const safelistFile = join(dir, "safelist.html");
  writeFileSync(safelistFile, "");
  const result = await postcss([
    tailwindcss({ config: join(ROOT, "tailwind.config.ts") }),
  ]).process(css, { from: entry });
  return result.css;
}

function escapeClass(cls) {
  return cls.replace(/[./[\]%#()]/g, (c) => `\\${c}`);
}

const candidates = collectCandidates();
const css = await compileCss();

/** Every class selector present in the compiled stylesheet. */
const emitted = new Set();
for (const [, sel] of css.matchAll(/\.((?:\\.|[\w-])+)/g)) {
  const clean = sel.replace(/\\(.)/g, "$1");
  emitted.add(clean);
  // `.last\:border-0` also proves `border-0` compiles.
  const base = clean.split(":").pop();
  if (base) emitted.add(base);
}

const unknown = [];
for (const [cls, files] of candidates) {
  if (emitted.has(cls)) continue;
  unknown.push({ cls, files: [...files].slice(0, 3) });
}

if (unknown.length) {
  console.error("Unknown Tailwind utility classes (no CSS is generated for these):\n");
  for (const { cls, files } of unknown.sort((a, b) => a.cls.localeCompare(b.cls))) {
    console.error(`  ${cls}\n      ${files.join("\n      ")}`);
  }
  console.error(
    `\n${unknown.length} unknown ${unknown.length === 1 ? "class" : "classes"}. Add the token to tailwind.config.ts / src/index.css or fix the class name.`,
  );
  process.exit(1);
}

console.log(`Tailwind class check passed — ${candidates.size} token utilities all compile.`);
