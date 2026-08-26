import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { setAnalyticsUserContext } from "@/lib/telemetry/events";

/**
 * Keeps sign-in state attached to every analytics event.
 *
 * This is the marketing surface: it never sells or reads a subscription, so no
 * plan/billing state is fetched here — that breakdown belongs to the app
 * surface, which owns checkout.
 */
export function AnalyticsProvider() {
  const { user } = useAuth();

  useEffect(() => {
    setAnalyticsUserContext({
      status: !user ? "anonymous" : user.is_anonymous ? "guest" : "authenticated",
    });
  }, [user]);

  return null;
}
