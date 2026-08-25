import { appHref } from "@/lib/appLinks";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, MailX, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Token-based unsubscribe landing page linked from every Gradr email footer. */
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
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.email) setEmail(data.email);
        if (data?.valid) setState("valid");
        else if (data?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setState("error");
      return;
    }
    if (data?.success === false && data?.reason === "already_unsubscribed") setState("already");
    else setState("done");
  };

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <Seo
        title="Email preferences"
        description="Manage the emails you receive from Gradr."
        path="/unsubscribe"
        noindex
      />
      <Card className="p-10 text-center space-y-6">
        {state === "loading" || state === "submitting" ? (
          <>
            <Icon tone="muted">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Icon>
            <Heading>
              {state === "loading" ? "Checking your link" : "Updating your preferences"}
            </Heading>
          </>
        ) : null}

        {state === "valid" ? (
          <>
            <Icon tone="accent">
              <MailX className="h-8 w-8 text-accent-foreground" />
            </Icon>
            <Heading>Unsubscribe from Gradr emails?</Heading>
            <p className="text-muted-foreground">
              {email ? (
                <>
                  <span className="font-medium text-foreground">{email}</span> will stop receiving job
                  matches, briefings and reminders.
                </>
              ) : (
                "You'll stop receiving job matches, briefings and reminders."
              )}{" "}
              Account and security emails are still sent — they're required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={confirm} variant="secondary">
                Confirm unsubscribe
              </Button>
              <Button asChild>
                <a href={appHref("/settings")}>
                  Fine-tune my preferences <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </>
        ) : null}

        {state === "done" || state === "already" ? (
          <>
            <Icon tone="primary">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </Icon>
            <Heading>
              {state === "done" ? "You've been unsubscribed" : "You're already unsubscribed"}
            </Heading>
            <p className="text-muted-foreground">
              {email ? `${email} ` : "This address "}
              won't receive marketing-style career emails from Gradr. You can turn them back on any
              time in your settings.
            </p>
            <Button asChild>
              <a href={appHref("/settings")}>
                Open email preferences <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </>
        ) : null}

        {state === "invalid" || state === "error" ? (
          <>
            <Icon tone="accent">
              <AlertTriangle className="h-8 w-8 text-accent-foreground" />
            </Icon>
            <Heading>
              {state === "invalid" ? "This link isn't valid" : "Something went wrong"}
            </Heading>
            <p className="text-muted-foreground">
              {state === "invalid"
                ? "The unsubscribe link may have expired or been used already. You can manage every email type from your settings."
                : "We couldn't update your preferences just now. Please try again in a moment."}
            </p>
            <Button asChild>
              <a href={appHref("/settings")}>Manage email preferences</a>
            </Button>
          </>
        ) : null}
      </Card>
    </main>
  );
}

const Icon = ({ children, tone }: { children: React.ReactNode; tone: "primary" | "accent" | "muted" }) => (
  <div
    className={`mx-auto h-16 w-16 rounded-2xl flex items-center justify-center ${
      tone === "primary" ? "bg-primary/10" : tone === "accent" ? "bg-accent/15" : "bg-muted"
    }`}
  >
    {children}
  </div>
);

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h1 className="type-h1 text-foreground">{children}</h1>
);
