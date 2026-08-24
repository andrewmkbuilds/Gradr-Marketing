import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PRODUCTION_ORIGIN, isMultiSurfaceHost } from "@/config/domains";
import { legacyAppTarget } from "@/lib/legacyAppPaths";
import { AnimatedPage } from "@/components/AnimatedPage";
import NotFound from "@/pages/NotFound";

/**
 * Forwards a legacy product URL on a marketing host to its real destination on
 * app.gradr.me, preserving the query string.
 *
 * Lovable hosting serves this project as a static SPA and does not process
 * `_redirects`-style rules, so the redirect happens on first paint in the
 * client (a 200 + immediate `location.replace`) rather than as a 301. On shared
 * hosts (local dev and previews) there is no app deployment to hand off to, so
 * these paths intentionally render the 404 instead of bouncing off-site.
 */
export function LegacyAppRedirect() {
  const location = useLocation();
  const target = legacyAppTarget(location.pathname);
  const multiSurface = isMultiSurfaceHost();

  useEffect(() => {
    if (multiSurface || !target) return;
    const [path, targetQuery] = target.split("?");
    const search = location.search.startsWith("?") ? location.search.slice(1) : "";
    const query = [targetQuery, search].filter(Boolean).join("&");
    window.location.replace(`${PRODUCTION_ORIGIN.app}${path}${query ? `?${query}` : ""}`);
  }, [multiSurface, target, location.search]);

  if (multiSurface || !target) {
    return (
      <AnimatedPage>
        <NotFound />
      </AnimatedPage>
    );
  }
  return null;
}
