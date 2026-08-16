import { useEffect } from "react";
import { appPricingHref, isCrossOrigin } from "@/lib/appLinks";
import { Loader2 } from "lucide-react";

/**
 * Marketing surfaces do not run checkout. `/pricing` on gradr.me and
 * marketing.gradr.me hands the visitor to the product's pricing route, which
 * is the only place Paddle is initialised.
 *
 * The link is rendered as well as followed so the destination is crawlable and
 * still reachable if the automatic navigation is blocked.
 */
export function AppPricingRedirect() {
  const href = appPricingHref();

  useEffect(() => {
    if (!isCrossOrigin(href)) return;
    window.location.replace(href);
  }, [href]);

  return (
    <div className="page-shell flex flex-col items-center gap-4 py-24 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Taking you to Gradr pricing…{" "}
        <a className="text-brand-secondary underline underline-offset-4" href={href}>
          Continue to plans
        </a>
      </p>
    </div>
  );
}

export default AppPricingRedirect;
