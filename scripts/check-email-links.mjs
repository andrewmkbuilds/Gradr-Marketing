#!/usr/bin/env node
/**
 * Email link integrity check.
 *
 * Enforces three rules across every template in
 * supabase/functions/_shared/transactional-email-templates/:
 *
 *  1. No hardcoded absolute URLs — every link goes through the `link()`,
 *     `appLink()` or `marketingLink()` helpers so the domain is centralised.
 *  2. Authenticated product paths (/billing, /settings, /dashboard, …) are only
 *     ever linked with `appLink()`. On gradr.me they are retired routes.
 *  3. Marketing-category templates never link to app.gradr.me or to an
 *     authenticated path at all — they stay on the public site.
 *
 * Auth emails (signup, magic link, recovery, invite, email change,
 * reauthentication) must not exist on this surface: they are owned by the
 * app.gradr.me project. A registered template with an auth name fails the run.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/functions/_shared/transactional-email-templates";
const SITE = "gradr.me";

const AUTH_PATHS = [
  "/dashboard", "/billing", "/credits", "/settings", "/account", "/profile",
  "/admin", "/resume", "/match", "/jobs", "/apply", "/interview", "/pipeline",
  "/onboarding", "/auth", "/login", "/signup", "/subscription", "/upgrade",
  "/checkout",
];

const AUTH_TEMPLATE_NAMES = [
  "signup", "magiclink", "magic-link", "recovery", "invite",
  "email-change", "email_change", "reauthentication", "confirmation",
  "verification-code",
];

const ALLOWED_ABSOLUTE = [
  `https://${SITE}`,
  `https://app.${SITE}`,
  "mailto:",
];

const errors = [];
const files = readdirSync(DIR).filter(
  (f) => f.endsWith(".tsx") && !["components.tsx"].includes(f),
);

const registry = readFileSync(join(DIR, "registry.ts"), "utf8");

for (const name of AUTH_TEMPLATE_NAMES) {
  if (new RegExp(`^\\s*'${name}'\\s*:`, "m").test(registry)) {
    errors.push(
      `registry.ts registers auth template '${name}'. Auth email is owned by the app.gradr.me project.`,
    );
  }
}

for (const file of files) {
  const src = readFileSync(join(DIR, file), "utf8");
  const isMarketing = /category:\s*'marketing'/.test(src);

  // 1. hardcoded absolute URLs
  for (const match of src.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
    const url = match[0];
    if (ALLOWED_ABSOLUTE.some((prefix) => url.startsWith(prefix))) {
      errors.push(`${file}: hardcoded URL ${url} — use link()/appLink()/marketingLink().`);
    } else if (!url.includes("react.email") && !url.includes("gradr")) {
      // third-party asset URLs (CDN images) are fine, but log the domain choice
      if (!/\.(png|jpg|jpeg|svg|webp)/i.test(url)) {
        errors.push(`${file}: external URL ${url} is not allowed in an email body.`);
      }
    }
  }

  // 2 + 3. path helper usage
  for (const match of src.matchAll(/\b(link|appLink|marketingLink)\(\s*'([^']*)'/g)) {
    const [, helper, path] = match;
    const isAuthPath = AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

    if (isAuthPath && helper !== "appLink") {
      errors.push(
        `${file}: ${helper}('${path}') points an authenticated route at the marketing apex. Use appLink().`,
      );
    }
    if (isMarketing && helper === "appLink") {
      errors.push(
        `${file}: marketing template links to app.gradr.me via appLink('${path}'). Marketing emails stay on ${SITE}.`,
      );
    }
    if (isMarketing && isAuthPath) {
      errors.push(`${file}: marketing template links to authenticated route '${path}'.`);
    }
  }
}

if (errors.length) {
  console.error("Email link check failed:\n");
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log(`Email link check passed (${files.length} templates).`);
