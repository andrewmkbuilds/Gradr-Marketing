import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isProduction, isProductHost, productOrigin } from "@/config/domains";
import { isProductPath } from "@/lib/appLinks";
import { track } from "@/lib/telemetry/events";
import { redirectToSurface } from "@/lib/routing/surfaceRedirectLog";

/**
 * Last line of defence: this bundle must never behave like the authenticated
 * product, no matter how a session got here.
 *
 * Supabase sessions are origin-scoped, but a session *can* exist on a public
 * host (an OAuth round trip that came back to the wrong origin, a restored
 * session, the affiliate portal). If that happens on a production public host,
 * the visitor is handed to app.gradr.me instead of being served anything
 * product-shaped here. The intended destination is preserved: a product path is
 * carried over verbatim, anything else lands on the product dashboard.
 *
 * Editorial pages stay readable while signed in — only product-shaped paths and
 * the site root hand off, so a signed-in reader can still open the blog, legal
 * pages and docs on the public site.
 */
export function ProductSessionGuard() {
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || user.is_anonymous === true) return;
    // Only production public hosts hand off: the product bundle serves itself,
    // and dev/preview have no app deployment to reach.
    if (!isProduction() || isProductHost()) return;

    const path = `${location.pathname}${location.search}${location.hash}`;
    const productShaped = isProductPath(location.pathname);
    if (!productShaped && location.pathname !== "/") return;

    const destination = `${productOrigin()}${productShaped ? path : "/dashboard"}`;
    track("authenticated_marketing_handoff", {
      from: location.pathname,
      destination,
      reason: productShaped ? "product_path" : "authenticated_root",
    });
    redirectToSurface(destination, {
      reason: productShaped ? "product_path" : "authenticated_root",
      from: location.pathname,
      authenticated: true,
    });
  }, [loading, user, location.pathname, location.search, location.hash]);

  return null;
}

export default ProductSessionGuard;
