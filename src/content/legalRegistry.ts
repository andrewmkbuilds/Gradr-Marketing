/**
 * Single source of truth for the *metadata* of every published policy page:
 * its path, label, one-line description and effective date.
 *
 * The policy bodies live in `legalDocs.ts` (versioned in the database),
 * `legalExtra.ts` and `legalPolicies.ts`. This module only re-exports their
 * dates so the legal hub, page headers, JSON-LD and the sitemap can never
 * drift from the document they describe.
 *
 * Adding a policy page: add the body, add a route in App.tsx, add SEO in
 * RouteSeo.tsx, add a sitemap entry, and add a row here. `legalRegistry.test`
 * fails the build if any of those are missing.
 */
import { LEGAL_PAGES, POLICIES_UPDATED, REFUND_POLICY_EFFECTIVE } from "@/content/legal";
import { PRIVACY_V1_EFFECTIVE, TERMS_V1_EFFECTIVE } from "@/content/legalDocs";
import {
  CHILDRENS_PRIVACY_EFFECTIVE,
  COOKIE_POLICY_EFFECTIVE,
  DPA_EFFECTIVE,
} from "@/content/legalExtra";
import { POLICIES_V1_EFFECTIVE } from "@/content/legalPolicies";

export interface LegalPageMeta {
  path: string;
  label: string;
  /** Shown on the legal hub cards. */
  description: string;
  /** ISO date the currently published version took effect. */
  effective: string;
}

const DETAILS: Record<string, { description: string; effective: string }> = {
  "/terms": {
    description: "The agreement between you and us for using Gradr.",
    effective: TERMS_V1_EFFECTIVE,
  },
  "/privacy": {
    description: "What personal data we collect, why, who processes it and your rights.",
    effective: PRIVACY_V1_EFFECTIVE,
  },
  "/cookie-policy": {
    description: "Cookies and local storage we use, and how to change your choices.",
    effective: COOKIE_POLICY_EFFECTIVE,
  },
  "/acceptable-use": {
    description: "What you may and may not do with the product.",
    effective: POLICIES_V1_EFFECTIVE,
  },
  "/ai-disclaimer": {
    description: "Where Gradr uses AI and the limits of its output.",
    effective: POLICIES_V1_EFFECTIVE,
  },
  "/disclaimer": {
    description: "Information status, no outcome guarantee, liability limits.",
    effective: POLICIES_V1_EFFECTIVE,
  },
  "/refund-policy": {
    description: "Cancellation, renewal and refund handling via Paddle.",
    effective: REFUND_POLICY_EFFECTIVE,
  },
  "/affiliate-disclosure": {
    description: "How the referral programme works and what affiliates must disclose.",
    effective: POLICIES_V1_EFFECTIVE,
  },
  "/childrens-privacy": {
    description: "Our under-13 policy and how a guardian can request removal.",
    effective: CHILDRENS_PRIVACY_EFFECTIVE,
  },
  "/dpa": {
    description: "Data processing terms and our sub-processors.",
    effective: DPA_EFFECTIVE,
  },
};

/** Every policy page, in footer/hub display order, with its live metadata. */
export const LEGAL_REGISTRY: LegalPageMeta[] = LEGAL_PAGES.map((page) => ({
  path: page.path,
  label: page.label,
  description: DETAILS[page.path]?.description ?? "",
  effective: DETAILS[page.path]?.effective ?? POLICIES_UPDATED,
}));

export function legalPageMeta(path: string): LegalPageMeta | undefined {
  return LEGAL_REGISTRY.find((page) => page.path === path);
}

/** Effective date for a policy path, falling back to the shared policy date. */
export function legalEffectiveDate(path: string): string {
  return legalPageMeta(path)?.effective ?? POLICIES_UPDATED;
}

/** Newest effective date across all policies — used for the /legal hub. */
export const LEGAL_LAST_UPDATED = LEGAL_REGISTRY.reduce(
  (latest, page) => (page.effective > latest ? page.effective : latest),
  POLICIES_UPDATED,
);
