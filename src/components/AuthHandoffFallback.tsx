import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardDescription, CardTitle } from "@/design-system/gradr-9b9b95";
import {
  HANDOFF_FAILED_EVENT,
  handoffToApp,
  type HandoffFailureDetail,
} from "@/lib/authHandoff";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Recovery UI for a sign-in hand-off that never left this page.
 *
 * Without it, a visitor whose browser cannot reach `app.gradr.me` sees their
 * click do nothing at all. This surfaces what happened and offers a retry —
 * one that reuses the original destination so the deep link survives, and that
 * stays disabled while the device is offline (retrying then can only fail).
 */
export function AuthHandoffFallback() {
  const [failure, setFailure] = useState<HandoffFailureDetail | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    const onFailure = (event: Event) => {
      setFailure((event as CustomEvent<HandoffFailureDetail>).detail);
    };
    window.addEventListener(HANDOFF_FAILED_EVENT, onFailure);
    return () => window.removeEventListener(HANDOFF_FAILED_EVENT, onFailure);
  }, []);

  const retry = useCallback(() => {
    if (!failure || !online) return;
    setFailure(null);
    // Same href, so the original `?next=` deep link is preserved verbatim, and
    // an incremented attempt so the retry is distinguishable in analytics.
    handoffToApp(failure.href, {
      ...failure.context,
      attempt: (failure.context.attempt ?? 1) + 1,
    });
  }, [failure, online]);

  if (!failure) return null;

  // Live connectivity wins over the reason captured at failure time: the device
  // may have dropped or recovered while this card was on screen.
  const offline = !online || failure.reason === "offline";

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="auth-handoff-title"
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md sm:inset-x-auto sm:right-6"
    >
      <Card variant="float" padding="md" className="space-y-3">
        <CardTitle id="auth-handoff-title">
          {offline ? "You're offline" : "We couldn't open sign-in"}
        </CardTitle>
        <CardDescription>
          {offline
            ? "Sign-in needs a connection. Reconnect and Retry will light up again — we'll take you to the same place you asked for."
            : "app.gradr.me didn't respond. This is usually temporary — try again in a moment."}
        </CardDescription>
        <div className="flex gap-2">
          <Button
            onClick={retry}
            disabled={offline}
            aria-describedby={offline ? "auth-handoff-retry-hint" : undefined}
          >
            Retry
          </Button>
          <Button variant="ghost" onClick={() => setFailure(null)}>
            Dismiss
          </Button>
        </div>
        {offline ? (
          <CardDescription id="auth-handoff-retry-hint" aria-live="polite">
            Waiting for your connection to come back.
          </CardDescription>
        ) : null}
      </Card>
    </div>
  );
}

