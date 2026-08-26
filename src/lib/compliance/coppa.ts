/**
 * COPPA (Children's Online Privacy Protection Act) compliance.
 *
 * Gradr is a career platform directed at people aged 13 and over. We do not
 * knowingly collect personal information from children under 13, so the rule
 * we implement is a neutral age screen at the point of account creation:
 *
 * - The visitor enters a date of birth before any account can be created.
 * - Under 13 → the sign-up is refused client-side (no email, name, password or
 *   OAuth request is ever sent) and the attempt is remembered on the device.
 * - A device that has declared an under-13 age also loses all optional
 *   analytics/marketing/functional storage — only strictly necessary storage
 *   remains, which is what `consentFor()` enforces.
 *
 * We deliberately do NOT persist the date of birth of a blocked visitor. The
 * only thing written is a boolean-ish marker plus a timestamp, which is the
 * minimum needed to avoid re-prompting and to keep tracking switched off.
 */

/** Minimum age required to hold a Gradr account. */
export const MINIMUM_AGE = 13;

const AGE_GATE_KEY = "gradr-age-gate";

export type AgeGateRecord = {
  /** True when the visitor declared an age at or above MINIMUM_AGE. */
  eligible: boolean;
  decidedAt: string;
};

/** Whole years between `dob` and today, in the visitor's local calendar. */
export function ageFromDateOfBirth(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export type AgeCheck =
  | { status: "ok"; age: number }
  | { status: "under-age"; age: number }
  | { status: "invalid"; message: string };

/** Validates a `YYYY-MM-DD` value from the date input and applies the age rule. */
export function checkDateOfBirth(value: string, now: Date = new Date()): AgeCheck {
  if (!value) return { status: "invalid", message: "Enter your date of birth." };
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { status: "invalid", message: "Enter a valid date of birth." };
  }
  if (parsed > now) {
    return { status: "invalid", message: "Date of birth cannot be in the future." };
  }
  const age = ageFromDateOfBirth(parsed, now);
  if (age > 120) return { status: "invalid", message: "Enter a valid date of birth." };
  if (age < MINIMUM_AGE) return { status: "under-age", age };
  return { status: "ok", age };
}

export function readAgeGate(): AgeGateRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AGE_GATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgeGateRecord;
    if (typeof parsed?.eligible !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Records the outcome of the age screen. Never stores the date of birth. */
export function recordAgeGate(eligible: boolean): AgeGateRecord {
  const record: AgeGateRecord = { eligible, decidedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(AGE_GATE_KEY, JSON.stringify(record));
  } catch {
    /* private mode — the screen simply asks again */
  }
  window.dispatchEvent(new CustomEvent<AgeGateRecord>("gradr:age-gate", { detail: record }));
  return record;
}

/**
 * True when this device declared an under-13 age. Consent, analytics and
 * attribution all treat this as a hard "no optional data" signal.
 */
export function isKnownChildDevice(): boolean {
  const record = readAgeGate();
  return record ? record.eligible === false : false;
}

/**
 * Removes the device-level age marker so the neutral screen can be answered
 * again. Used when someone mis-typed their birth year: the block is a local
 * convenience, never an identity claim, so clearing it only resets this device
 * and never grants eligibility by itself — the screen must be passed again.
 */
export function clearAgeGate(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AGE_GATE_KEY);
  } catch {
    /* private mode — nothing was stored to begin with */
  }
  window.dispatchEvent(new CustomEvent("gradr:age-gate", { detail: null }));
}

