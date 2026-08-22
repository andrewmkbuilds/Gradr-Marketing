import {
  GraduationCap,
  BookOpen,
  Shield,
  Siren,
  Stethoscope,
  HeartHandshake,
  Briefcase,
  Accessibility,
  Building2,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Presentation-only metadata for eligibility categories. The categories
 * themselves, their discounts and whether they're active all live in the
 * database — this map just decides how each one looks.
 */
export const ELIGIBILITY_ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  educator: BookOpen,
  military: Shield,
  first_responder: Siren,
  healthcare: Stethoscope,
  nonprofit: HeartHandshake,
  professional: Briefcase,
  accessibility: Accessibility,
  organization: Building2,
};

export function eligibilityIcon(key: string): LucideIcon {
  return ELIGIBILITY_ICONS[key] ?? BadgeCheck;
}

export type VerificationStatus =
  | "pending"
  | "verified"
  | "failed"
  | "expired"
  | "revoked"
  | "manual_review";

/** Design-system Badge variant per status, for surfaces on the Gradr library. */
export type StatusBadgeVariant = "neutral" | "primary" | "accent" | "danger" | "outline";

export const STATUS_COPY: Record<
  VerificationStatus,
  { label: string; tone: string; badgeVariant: StatusBadgeVariant; hint: string }
> = {
  verified: {
    label: "Verified",
    tone: "text-primary border-primary/40 bg-primary/10",
    badgeVariant: "primary",
    hint: "Your discount is applied automatically at checkout.",
  },
  pending: {
    label: "In progress",
    tone: "text-muted-foreground border-border bg-muted/40",
    badgeVariant: "outline",
    hint: "Finish the verification steps to activate your discount.",
  },
  manual_review: {
    label: "Under review",
    tone: "text-muted-foreground border-border bg-muted/40",
    badgeVariant: "outline",
    hint: "We're reviewing your details. This usually takes 1–2 business days.",
  },
  failed: {
    label: "Not verified",
    tone: "text-destructive border-destructive/40 bg-destructive/10",
    badgeVariant: "danger",
    hint: "We couldn't confirm your eligibility. You can try again anytime.",
  },
  expired: {
    label: "Expired",
    tone: "text-warning border-warning/40 bg-warning/10",
    badgeVariant: "accent",
    hint: "Re-verify to keep your discount active.",
  },
  revoked: {
    label: "Revoked",
    tone: "text-destructive border-destructive/40 bg-destructive/10",
    badgeVariant: "danger",
    hint: "This discount was removed. Contact support if you think that's wrong.",
  },
};

/** Onboarding self-identification → eligibility category we offer to verify. */
export const ONBOARDING_IDENTITIES: {
  value: string;
  label: string;
  eligibilityType: string | null;
}[] = [
  { value: "student", label: "Student", eligibilityType: "student" },
  { value: "educator", label: "Educator or teacher", eligibilityType: "educator" },
  { value: "military", label: "Military, veteran or family", eligibilityType: "military" },
  { value: "first_responder", label: "First responder", eligibilityType: "first_responder" },
  { value: "healthcare", label: "Healthcare worker", eligibilityType: "healthcare" },
  { value: "nonprofit", label: "Nonprofit team member", eligibilityType: "nonprofit" },
  { value: "job_seeker", label: "Job seeker / career switcher", eligibilityType: null },
  { value: "professional", label: "Working professional", eligibilityType: null },
];
