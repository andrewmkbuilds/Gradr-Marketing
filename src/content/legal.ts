/**
 * Seller identity + policy content shared by the privacy, terms and refund
 * pages. Paddle's readiness check reads these pages, so they must stay
 * publicly accessible (no auth) and must name the seller and Paddle's role.
 *
 * SELLER IDENTITY IS CONFIGURABLE — single source of truth.
 * The values below are TEMPORARY placeholders for the development/testing
 * phase. When the final verified legal business (or individual) name is
 * provided, change it here only: every policy page, billing disclosure and
 * checkout-facing reference reads from these constants. Do not hardcode the
 * seller name anywhere else.
 */
export const SELLER_LEGAL_NAME = "Gradr"; // TEMPORARY — replace at go-live
export const SELLER_CONTACT_EMAIL = "support@gradr.me";
export const SELLER_TRADING_NAME = "Gradr";
export const SELLER_DOMAIN = "gradr.me";
export const SELLER_WEBSITE_URL = "https://gradr.me";
export const REFUND_WINDOW_DAYS = 30;
export const POLICIES_UPDATED = "2026-08-12";
/** Effective date of the currently published Refund Policy. */
export const REFUND_POLICY_EFFECTIVE = "2026-08-12";

export const LEGAL_PAGES = [
  { path: "/terms", label: "Terms" },
  { path: "/privacy", label: "Privacy" },
  { path: "/cookie-policy", label: "Cookies" },
  { path: "/acceptable-use", label: "Acceptable use" },
  { path: "/ai-disclaimer", label: "AI disclaimer" },
  { path: "/disclaimer", label: "Disclaimer" },
  { path: "/refund-policy", label: "Refunds" },
  { path: "/affiliate-disclosure", label: "Affiliate disclosure" },
  { path: "/childrens-privacy", label: "Children's privacy" },
  { path: "/dpa", label: "DPA" },
] as const;

