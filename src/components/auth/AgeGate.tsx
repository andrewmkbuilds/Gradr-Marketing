import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Button, FormField, Input } from "@/design-system/gradr-9b9b95";
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
        <h1 className="text-xl font-semibold text-foreground">What's your date of birth?</h1>
        <p className="text-sm text-muted-foreground">
          We ask everyone once, before an account is created. Your date of birth stays in this
          browser — we never send or store it.
        </p>
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

      <p className="text-center text-caption leading-relaxed text-muted-foreground">
        Gradr is for people aged {MINIMUM_AGE} and over. Read our{" "}
        <Link to="/childrens-privacy" className="text-primary underline underline-offset-2">
          Children's Privacy Notice
        </Link>
        .
      </p>
    </form>
  );
}

/** Shown after an under-13 date of birth. No account, no data, no retry loop. */
export function AgeBlockedNotice() {
  return (
    <div className="space-y-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">
          You need to be {MINIMUM_AGE} to use Gradr
        </h1>
        <p className="text-sm text-muted-foreground">
          Gradr is a career platform built for people aged {MINIMUM_AGE} and over, so we can't
          create an account for you right now. Nothing you typed was saved or sent, and we've
          switched off all optional analytics on this device.
        </p>
        <p className="text-sm text-muted-foreground">
          Come back when you're {MINIMUM_AGE} — your future job search will still be here.
        </p>
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-foreground">Parent or guardian?</p>
        <p className="text-sm text-muted-foreground">
          If a child under {MINIMUM_AGE} has already shared information with us, email{" "}
          <a
            href={`mailto:${SELLER_CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-2"
          >
            {SELLER_CONTACT_EMAIL}
          </a>{" "}
          and we'll delete it and confirm when it's done.
        </p>
      </div>
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
