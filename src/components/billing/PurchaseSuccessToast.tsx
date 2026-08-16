import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Post-checkout landing behaviour: confirm the payment, then make sure the
 * page the customer is looking at reflects their new limits immediately.
 *
 * Entitlements are written by the payments webhook, which can land a beat
 * after the redirect, so we refetch a couple of times before giving up.
 */
export function PurchaseSuccessToast() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const shown = useRef(false);

  const success = params.get("checkout") === "success" || params.get("purchase") === "success";

  useEffect(() => {
    if (!success || shown.current) return;
    shown.current = true;

    const isPack = params.get("purchase") === "pack";
    toast.success(
      isPack ? "🎉 Payment successful! Your credits have been added." : "🎉 Payment successful! Your plan is now active.",
      { description: "Your new limits are live on this page.", duration: 8000 },
    );

    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
        queryClient.invalidateQueries({ queryKey: ["usage-credits"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
      ]);

    void refresh();
    const timers = [1500, 5000].map((ms) => window.setTimeout(() => void refresh(), ms));

    // Keep the URL clean so a refresh doesn't re-fire the confirmation.
    const next = new URLSearchParams(params);
    next.delete("checkout");
    next.delete("purchase");
    setParams(next, { replace: true });

    return () => timers.forEach(window.clearTimeout);
  }, [success, params, setParams, queryClient]);

  return null;
}

export default PurchaseSuccessToast;
