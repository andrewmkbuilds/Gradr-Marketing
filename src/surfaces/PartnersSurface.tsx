import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { SurfaceShell } from "@/components/surface/SurfaceShell";
import { RouteSkeleton } from "@/components/states/PageSkeletons";
import { legacyAffiliateDestination, PARTNER_PATHS, partnersHref } from "@/lib/partnerLinks";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { Text } from "@/design-system/gradr-9b9b95";

const PartnerProgram = lazy(() => import("@/pages/PartnerProgram"));

/**
 * Public Partner Program surface.
 *
 * The affiliate portal itself (applications, approval, referral links,
 * conversions, commissions, payouts, analytics, resources, settings) is a
 * separate product at partners.gradr.me. This bundle only serves the public
 * pitch page — every portal path is handed over to the portal instead of being
 * rendered here, so the marketing site never holds partner data or a partner
 * session.
 */
export default function PartnersSurface() {
  return (
    <SurfaceShell
      eyebrow="Partners"
      nav={[
        { label: "Program", to: "/" },
      ]}
    >
      <Suspense fallback={<RouteSkeleton pathname="/partners" />}>
        <Routes>
          <Route path="" element={<PartnerProgram />} />
          {/* Legacy affiliate-portal paths served by this project before the
              Partner portal existed. */}
          <Route path="*" element={<PortalHandoff />} />
        </Routes>
      </Suspense>
    </SurfaceShell>
  );
}

/**
 * Hands a portal-shaped request to partners.gradr.me. Rendered (rather than a
 * bare redirect) so the visitor always sees a working link even if the
 * navigation is blocked or the portal is not reachable.
 */
function PortalHandoff() {
  const { pathname } = useLocation();
  const destination = legacyAffiliateDestination(pathname);

  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);

  return (
    <div className="page-shell section-y text-center">
      <Text variant="h3" as="h1">
        Opening the Gradr Partner Program
      </Text>
      <Text variant="body" className="mx-auto mt-2 max-w-lg">
        Partner applications, referral links, commissions and payouts live in the partner portal.
      </Text>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href={destination} className={buttonVariants({ size: "lg" })}>
          Continue to partners.gradr.me
        </a>
        <a href={partnersHref(PARTNER_PATHS.home)} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Partner home
        </a>
      </div>
    </div>
  );
}
