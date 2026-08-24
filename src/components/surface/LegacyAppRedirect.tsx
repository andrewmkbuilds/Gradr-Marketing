import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PRODUCTION_ORIGIN, isProduction, surfaceFromHost, currentHost } from "@/config/domains";
import { legacyAppTarget } from "@/lib/legacyAppPaths";
import { track } from "@/lib/telemetry/events";
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
 *
 * Every hit is measured: `legacy_url_hit` records the stale URL that is still
 * in circulation, then either `legacy_url_redirected` (with the destination we
 * sent the visitor to) or `legacy_url_not_found` when the path is not a known
 * product URL. That pair is what tells us which old links to fix upstream.
 */
export function LegacyAppRedirect() {
  const location = useLocation();
  const target = legacyAppTarget(location.pathname);
  // The product now has its own deployment at app.gradr.me, so every production
  // marketing host can hand these URLs over. Dev and preview builds have no app
  // deployment to reach, so they keep rendering the 404.
  const host = currentHost();
  const canHandOff = isProduction(host) && surfaceFromHost(host) !== "app";

  useEffect(() => {
    const from = location.pathname;
    if (!target) {
      track("legacy_url_hit", { from, outcome: "not_found" });
      track("legacy_url_not_found", { from });
      return;
    }

    const [path, targetQuery] = target.split("?");
    const search = location.search.startsWith("?") ? location.search.slice(1) : "";
    const query = [targetQuery, search].filter(Boolean).join("&");
    const destination = `${PRODUCTION_ORIGIN.app}${path}${query ? `?${query}` : ""}`;

    track("legacy_url_hit", { from, outcome: canHandOff ? "redirected" : "not_found" });

    if (!canHandOff) {
      track("legacy_url_not_found", { from, reason: "shared_host" });
      return;
    }

    track("legacy_url_redirected", { from, to: path, destination });
    window.location.replace(destination);
  }, [canHandOff, target, location.pathname, location.search]);

  if (!canHandOff || !target) {
    return (
      <AnimatedPage>
        <NotFound />
      </AnimatedPage>
    );
  }
  return null;
}

