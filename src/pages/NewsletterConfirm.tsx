import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Card, Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "confirmed" | "already" | "invalid";

/** Landing page for the double opt-in link in the newsletter confirmation email. */
export default function NewsletterConfirm() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState("invalid");
      setMessage("This confirmation link is missing its token.");
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("newsletter-subscribe", {
        body: { action: "confirm", token },
      });
      if (cancelled) return;
      if (error || data?.error) {
        setState("invalid");
        setMessage(
          typeof data?.error === "string"
            ? data.error
            : "This confirmation link is invalid or has expired.",
        );
        return;
      }
      setState(data?.alreadyConfirmed ? "already" : "confirmed");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Seo
        title="Confirm your newsletter subscription"
        description="Confirm your subscription to the Gradr newsletter."
        path="/newsletter/confirm"
        noindex
      />
      <Card className="space-y-6 p-10 text-center">
        {state === "loading" ? (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" aria-hidden />
            <Text as="h1" variant="h4">
              Confirming your subscription…
            </Text>
          </>
        ) : state === "invalid" ? (
          <>
            <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
            <Text as="h1" variant="h4">
              We could not confirm this link
            </Text>
            <Text as="p" variant="body" className="text-muted-foreground">
              {message}
            </Text>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden />
            <Text as="h1" variant="h4">
              {state === "already" ? "You're already subscribed" : "You're subscribed"}
            </Text>
            <Text as="p" variant="body" className="text-muted-foreground">
              {state === "already"
                ? "This address is already on the Gradr list. Nothing else to do."
                : "Thanks for confirming. The next issue lands in your inbox — every email has a one-click unsubscribe."}
            </Text>
          </>
        )}
        <Link
          to="/career-advice"
          className={cn(buttonVariants({ variant: "outline" }), "mx-auto w-fit")}
        >
          Read the latest guides
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Card>
    </main>
  );
}
