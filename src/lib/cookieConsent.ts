/**
 * GDPR-style cookie consent state.
 *
 * Stored in localStorage (not a cookie) so it survives without itself needing
 * consent, and read synchronously so analytics never fires before a choice.
 * Strictly necessary cookies are always on and are not represented as a toggle.
 */
import { isKnownChildDevice } from "@/lib/compliance/coppa";

export const CONSENT_STORAGE_KEY = "gradr-cookie-consent";
export const CONSENT_VERSION = 1;
/** Re-ask after 12 months, matching the retention stated in the Cookie Policy. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type ConsentCategory = "analytics" | "marketing" | "functional";

export type ConsentChoices = Record<ConsentCategory, boolean>;

export type StoredConsent = {
  version: number;
  decidedAt: string;
  choices: ConsentChoices;
};

export const CONSENT_CATEGORIES: {
  id: ConsentCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "analytics",
    label: "Analytics",
    description:
      "Product analytics (PostHog, Sentry, internal navigation events) so we can see which features work and where flows break.",
  },
  {
    id: "marketing",
    label: "Marketing & attribution",
    description:
      "Campaign measurement and the affiliate attribution cookie that credits the partner who referred you.",
  },
  {
    id: "functional",
    label: "Functional",
    description:
      "Non-essential conveniences: dismissed banners, onboarding progress and recently viewed roles.",
  },
];

export const ALL_OFF: ConsentChoices = { analytics: false, marketing: false, functional: false };
export const ALL_ON: ConsentChoices = { analytics: true, marketing: true, functional: true };

/** A Global Privacy Control signal counts as rejecting the optional categories. */
export function hasGlobalPrivacyControl(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function readConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed?.version !== CONSENT_VERSION || !parsed.choices) return null;
    if (Date.now() - Date.parse(parsed.decidedAt) > CONSENT_MAX_AGE_MS) return null;
    return {
      version: parsed.version,
      decidedAt: parsed.decidedAt,
      choices: { ...ALL_OFF, ...parsed.choices },
    };
  } catch {
    return null;
  }
}

export function writeConsent(choices: ConsentChoices): StoredConsent {
  const record: StoredConsent = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    choices,
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* private mode — the banner simply reappears next visit */
  }
  window.dispatchEvent(new CustomEvent<StoredConsent>("gradr:consent", { detail: record }));
  return record;
}

/** Current effective choices — used by analytics/attribution before they fire. */
export function consentFor(category: ConsentCategory): boolean {
  if (hasGlobalPrivacyControl()) return false;
  // COPPA: a device that declared an age under 13 gets strictly necessary only,
  // whatever is stored in the consent record.
  if (isKnownChildDevice()) return false;
  return readConsent()?.choices[category] ?? false;
}
