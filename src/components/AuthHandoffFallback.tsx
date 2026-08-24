import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardDescription, CardTitle } from "@/design-system/gradr-9b9b95";
import {
  HANDOFF_FAILED_EVENT,
  handoffToApp,
  type HandoffFailureDetail,
} from "@/lib/authHandoff";

/**
 * Recovery UI for a sign-in hand-off that never left this page.
 *
 * Without it, a visitor whose browser cannot reach `app.gradr.me` sees their
 * click do nothing at all. This surfaces what happened and offers a retry.
 */
export function AuthHandoffFallback() {
  const [failure, setFailure] = useState<HandoffFailureDetail | null>(null);

  useEffect(() => {
    const onFailure = (event: Event) => {
      setFailure((event as CustomEvent<HandoffFailureDetail>).detail);
    };
    window.addEventListener(HANDOFF_FAILED_EVENT, onFailure);
    return () => window.removeEventListener(HANDOFF_FAILED_EVENT, onFailure);
  }, []);

  const retry = useCallback(() => {
    if (!failure) return;
    setFailure(null);
    handoffToApp(failure.href, failure.context);
  }, [failure]);

  if (!failure) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="auth-handoff-title"
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md sm:inset-x-auto sm:right-6"
    >
      <Card variant="float" padding="md" className="space-y-3">
        <CardTitle id="auth-handoff-title">We couldn&apos;t open sign-in</CardTitle>
        <CardDescription>
          {failure.reason === "offline"
            ? "You appear to be offline. Reconnect and try again."
            : "app.gradr.me didn't respond. This is usually temporary — try again in a moment."}
        </CardDescription>
        <div className="flex gap-2">
          <Button onClick={retry}>Retry</Button>
          <Button variant="ghost" onClick={() => setFailure(null)}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}
