import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SpatialLoader } from "@/components/three-d";
import { Button, Card, Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "ready" | "submitting" | "done" | "already" | "invalid" | "error";

/**
 * Landing page for the unsubscribe link in Gradr marketing emails.
 *
 * The link carries an opaque token. Loading the page only validates it; the
 * actual opt-out needs an explicit confirmation, so inbox link scanners can't
 * unsubscribe a reader by prefetching the URL.
 */
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (cancelled) return;
      if (error) {
        setState("error");
        return;
      }
      if (data?.valid) {
        setEmail(typeof data.email === "string" ? data.email : null);
        // The validation call never opts anyone out — confirmation is explicit.
        setState("ready");
        return;
      }
      setEmail(typeof data?.email === "string" ? data.email : null);
      setState(data?.reason === "already_unsubscribed" ? "already" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token, confirm: true },
    });
    if (error || !data?.success) {
      setState(data?.reason === "already_unsubscribed" ? "already" : "error");
      return;
    }
    setState("done");
  };

  return (
    <main className="section-y-sm mx-auto max-w-xl px-4">
      <Seo
        title="Unsubscribe from Gradr emails"
        description="Remove your address from the Gradr newsletter."
        path="/unsubscribe"
        noindex
      />
      <Card padding="lg" variant="raised" className="space-y-6 text-center">
        {state === "loading" ? (
          <>
            <SpatialLoader size={40} className="mx-auto" />
            <Text as="h1" variant="h4">
              Checking your link…
            </Text>
          </>
        ) : null}

        {state === "ready" || state === "submitting" ? (
          <>
            <Text as="h1" variant="h4">
              Unsubscribe from Gradr emails?
            </Text>
            <Text variant="body" tone="muted">
              {email
                ? `${email} will stop receiving the Gradr newsletter. Account and billing emails are unaffected.`
                : "You'll stop receiving the Gradr newsletter. Account and billing emails are unaffected."}
            </Text>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={confirm} disabled={state === "submitting"}>
                {state === "submitting" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Unsubscribing…
                  </>
                ) : (
                  "Confirm unsubscribe"
                )}
              </Button>
              <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
                Keep my subscription
              </Link>
            </div>
          </>
        ) : null}

        {state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
            <Text as="h1" variant="h4">
              You've been unsubscribed
            </Text>
            <Text variant="body" tone="muted">
              You won't get any more Gradr newsletter emails. You can resubscribe any time from the
              homepage.
            </Text>
            <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to Gradr
              <ArrowRight aria-hidden />
            </Link>
          </>
        ) : null}

        {state === "already" ? (
          <>
            <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
            <Text as="h1" variant="h4">
              You're already unsubscribed
            </Text>
            <Text variant="body" tone="muted">
              This address is already off the Gradr newsletter — nothing else to do.
            </Text>
            <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to Gradr
            </Link>
          </>
        ) : null}

        {state === "invalid" ? (
          <>
            <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
            <Text as="h1" variant="h4">
              This unsubscribe link isn't valid
            </Text>
            <Text variant="body" tone="muted">
              It may have already been used or been broken by your email client. Contact{" "}
              <a className="underline" href="mailto:support@gradr.me">
                support@gradr.me
              </a>{" "}
              and we'll remove you.
            </Text>
            <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to Gradr
            </Link>
          </>
        ) : null}

        {state === "error" ? (
          <>
            <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
            <Text as="h1" variant="h4">
              Something went wrong
            </Text>
            <Text variant="body" tone="muted">
              We couldn't reach the unsubscribe service. Please try again in a moment, or email{" "}
              <a className="underline" href="mailto:support@gradr.me">
                support@gradr.me
              </a>
              .
            </Text>
          </>
        ) : null}
      </Card>
    </main>
  );
}
