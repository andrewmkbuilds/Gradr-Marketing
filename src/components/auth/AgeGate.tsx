import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Button, FormField, Input, Text } from "@/design-system/gradr-9b9b95";
import { MINIMUM_AGE, checkDateOfBirth, recordAgeGate } from "@/lib/compliance/coppa";
import { SELLER_CONTACT_EMAIL } from "@/content/legal";

/**
 * Neutral COPPA age screen shown before any Gradr account can be created.
 *
 * "Neutral" means it asks for a date of birth without hinting at a passing
 * answer — no "are you over 13?" yes/no. The date is used once, in the
 * browser, and is never sent anywhere or stored: only the pass/fail outcome
 * is recorded on the device.
 */
export function AgeGate({
  onVerified,
  onBlocked,
  onCancel,
}: {
  onVerified: () => void;
  onBlocked: () => void;
  onCancel: () => void;
}) {
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = checkDateOfBirth(dob);
    if (result.status === "invalid") {
      setError(result.message);
      return;
    }
    if (result.status === "under-age") {
      recordAgeGate(false);
      onBlocked();
      return;
    }
    recordAgeGate(true);
    onVerified();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <Text variant="h4" as="h1">
          What's your date of birth?
        </Text>
        <Text variant="body-sm" tone="muted">
          We ask everyone once, before an account is created. Your date of birth stays in this
          browser — we never send or store it.
        </Text>
      </div>

      <FormField label="Date of birth" error={error ?? undefined}>
        {(control) => (
          <Input
            {...control}
            type="date"
            name="bday"
            autoComplete="bday"
            value={dob}
            onChange={(event) => {
              setDob(event.target.value);
              setError(null);
            }}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" className="w-full">
        Continue
      </Button>
      <Button type="button" variant="ghost" size="lg" className="w-full" onClick={onCancel}>
        Back
      </Button>

      <Text variant="caption" className="text-center">
        Gradr is for people aged {MINIMUM_AGE} and over. Read our{" "}
        <Link to="/childrens-privacy" className="text-primary underline underline-offset-2">
          Children's Privacy Notice
        </Link>
        .
      </Text>
    </form>
  );
}

/** Shown after an under-13 date of birth. Existing account sign-in remains available. */
export function AgeBlockedNotice({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <Text variant="h4" as="h1">
          We can't create this account
        </Text>
        <Text variant="body-sm" tone="muted">
          Gradr is a career platform built for people aged {MINIMUM_AGE} and over, so we can't
          create a new account for you right now. Nothing you typed was saved or sent, and we've
          switched off all optional analytics on this device. If you already have an account,
          you can still sign in.
        </Text>
        <Text variant="body-sm" tone="muted">
          Come back when you're {MINIMUM_AGE} — your future job search will still be here.
        </Text>
      </div>
      <div className="space-y-2 rounded-card border border-border bg-surface p-4">
        <Text variant="body-sm">Parent or guardian?</Text>
        <Text variant="body-sm" tone="muted">
          If a child under {MINIMUM_AGE} has already shared information with us, email{" "}
          <a
            href={`mailto:${SELLER_CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-2"
          >
            {SELLER_CONTACT_EMAIL}
          </a>{" "}
          and we'll delete it and confirm when it's done.
        </Text>
      </div>
      <Button type="button" size="lg" className="w-full" onClick={onSignIn}>
        Sign in to an existing account
      </Button>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/childrens-privacy" className="text-primary underline underline-offset-2">
          Children's Privacy Notice
        </Link>
        <Link to="/" className="text-muted-foreground underline underline-offset-2">
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
