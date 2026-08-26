import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button, FormField, Input, Text } from "@/design-system/gradr-9b9b95";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface NewsletterSignupProps {
  /** Where on the site the signup happened, stored with the subscriber. */
  source?: string;
  /** Optional topic label echoed back in the confirmation email. */
  topic?: string;
  className?: string;
}

/**
 * Landing-list opt-in. Double opt-in only: submitting stores a pending record
 * and mails a single-use confirmation link — nothing is subscribed until the
 * reader clicks it.
 */
export function NewsletterSignup({ source = "landing", topic, className }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setStatus("submitting");
    const { data, error: invokeError } = await supabase.functions.invoke("newsletter-subscribe", {
      body: { action: "subscribe", email: value, source, topic },
    });
    if (invokeError || data?.error) {
      setStatus("idle");
      setError(
        typeof data?.error === "string"
          ? data.error
          : "We could not sign you up right now. Please try again shortly.",
      );
      return;
    }
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <div className={className} role="status">
        <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-6">
          <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <Text as="p" variant="h6">
              Check your inbox
            </Text>
            <Text as="p" variant="body-sm" tone="muted">
              We sent a confirmation link to {email}. Click it to finish subscribing — we only add
              confirmed addresses to the list.
            </Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField
          className="flex-1"
          label="Email address"
          help="One or two emails a month. Unsubscribe any time."
          error={error ?? undefined}
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </FormField>
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Mail className="size-4" aria-hidden />
          )}
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      <Text as="p" variant="caption" tone="muted" className="mt-3">
        Subscribing signs you up for Gradr marketing emails only — it does not create an account.
        You can unsubscribe from any email. See our{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Notice
        </Link>
        .
      </Text>

    </form>
  );
}

export default NewsletterSignup;
