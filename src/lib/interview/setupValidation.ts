import type { SessionContext, PersonaId, DifficultyId } from "@/lib/interview/personas";

/**
 * Validation for the optional grounding fields on the interview setup form.
 *
 * Every field here is optional — an interview can run with nothing but a
 * persona and a difficulty. What we guard against is input that would silently
 * degrade the session: a one-character "role", a pasted resume in the role
 * box, or a job description so long it is truncated before the model sees it.
 *
 * Errors block the session. Warnings never do — they only tell the candidate
 * what they are giving up.
 */

export const LIMITS = {
  targetRole: { min: 2, max: 80 },
  company: { min: 2, max: 80 },
  /** Mirrors the 2500-char slice in buildSessionDirective, with headroom. */
  jobDescription: { max: 6000, groundingFrom: 80, sentToModel: 2500 },
} as const;

export type SetupField = "targetRole" | "company" | "jobDescription";

export type FieldIssues = Partial<Record<SetupField, string>>;

export interface SetupValidation {
  /** Blocking problems, keyed by field. */
  errors: FieldIssues;
  /** Non-blocking notes about weaker grounding, keyed by field. */
  warnings: FieldIssues;
  valid: boolean;
}

export interface SetupDraft {
  targetRole?: string;
  company?: string;
  jobDescription?: string;
}

/** True when the string carries C0 control characters (excluding tab/newline/CR). */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x08) || (code >= 0x0e && code <= 0x1f)) return true;
  }
  return false;
}

function validateName(
  value: string,
  label: string,
  limits: { min: number; max: number },
): string | undefined {
  if (value.length < limits.min) return `${label} needs at least ${limits.min} characters.`;
  if (value.length > limits.max) {
    return `${label} is ${value.length} characters — keep it under ${limits.max}.`;
  }
  if (hasControlChars(value)) return `${label} contains characters we can't use.`;
  if (value.includes("\n")) return `${label} should be a single line.`;
  if (!/[\p{L}\p{N}]/u.test(value)) return `${label} needs at least one letter or number.`;
  return undefined;
}

/** Validates the optional context fields of the setup form. */
export function validateSetup(draft: SetupDraft): SetupValidation {
  const errors: FieldIssues = {};
  const warnings: FieldIssues = {};

  const role = (draft.targetRole ?? "").trim();
  const company = (draft.company ?? "").trim();
  const jd = (draft.jobDescription ?? "").trim();

  if (role) {
    const issue = validateName(role, "Target role", LIMITS.targetRole);
    if (issue) errors.targetRole = issue;
  } else {
    warnings.targetRole =
      "No target role — questions will stay generic. Add one for role-specific follow-ups.";
  }

  if (company) {
    const issue = validateName(company, "Company", LIMITS.company);
    if (issue) errors.company = issue;
  }

  if (jd) {
    if (jd.length > LIMITS.jobDescription.max) {
      errors.jobDescription = `Job description is ${jd.length.toLocaleString()} characters — paste under ${LIMITS.jobDescription.max.toLocaleString()}.`;
    } else if (jd.length < LIMITS.jobDescription.groundingFrom) {
      warnings.jobDescription =
        "That job description is very short — paste the full posting for grounded questions.";
    } else if (jd.length > LIMITS.jobDescription.sentToModel) {
      warnings.jobDescription = `Only the first ${LIMITS.jobDescription.sentToModel.toLocaleString()} characters are used — lead with the responsibilities and requirements.`;
    }
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

/**
 * Builds the session context from a validated draft. Optional fields are
 * omitted entirely (rather than sent as empty strings) so the directive
 * builder and the edge function see a clean payload.
 */
export function buildSessionContext(args: {
  personaId: PersonaId;
  difficultyId: DifficultyId;
  draft: SetupDraft;
  resumeText?: string;
}): SessionContext {
  const ctx: SessionContext = {
    personaId: args.personaId,
    difficultyId: args.difficultyId,
  };
  const role = (args.draft.targetRole ?? "").trim();
  const company = (args.draft.company ?? "").trim();
  const jd = (args.draft.jobDescription ?? "").trim();

  if (role) ctx.targetRole = role;
  if (company) ctx.company = company;
  if (jd) ctx.jobDescription = jd;
  if (args.resumeText) ctx.resumeText = args.resumeText;
  return ctx;
}
