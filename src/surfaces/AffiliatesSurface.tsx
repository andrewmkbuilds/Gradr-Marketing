import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SurfaceShell } from "@/components/surface/SurfaceShell";
import { SLink, useSurfacePath } from "@/components/surface/SurfaceLink";
import { SurfaceHome, SurfaceNotFound, SurfaceRedirect } from "@/components/surface/SurfaceLink";
import { RouteSkeleton } from "@/components/states/PageSkeletons";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";

const AffiliateProgram = lazy(() => import("@/pages/AffiliateProgram"));
const AffiliateApply = lazy(() => import("@/pages/AffiliateApply"));
const AffiliateResources = lazy(() => import("@/pages/AffiliateResources"));
const Auth = lazy(() => import("@/pages/Auth"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

/**
 * Affiliate-portal auth gate.
 *
 * Supabase sessions are origin-scoped, so affiliates.gradr.me holds its own
 * session against the same backend. Signed-out partners are sent to the
 * portal's own sign-in page rather than to the product app.
 */
function RequirePartner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const path = useSurfacePath();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <BrandLogo size={48} className="animate-pulse" />
        <span className="sr-only">Loading the affiliate portal</span>
      </div>
    );
  }

  if (!user || user.is_anonymous === true) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${path("/login")}?next=${next}`} replace />;
  }

  return <>{children}</>;
}

/**
 * affiliates.gradr.me — the affiliate portal only.
 *
 * Deliberately mounts no product, admin or account routes: the only
 * authenticated surface here is the partner dashboard and its resources.
 */
export default function AffiliatesSurface() {
  return (
    <SurfaceShell
      eyebrow="Affiliates"
      nav={[
        { label: "Program", to: "/" },
        { label: "Apply", to: "/join" },
        { label: "Resources", to: "/resources" },
      ]}
    >
      <Suspense fallback={<RouteSkeleton pathname="/affiliate" />}>
        <Routes>
          <Route path="" element={<AffiliateProgram />} />
          <Route path="join" element={<AffiliateApply />} />
          <Route path="apply" element={<SurfaceRedirect to="/join" />} />
          {/* The partner dashboard was retired; /dashboard now lands on the
              resources page for approved partners. */}
          <Route path="dashboard" element={<SurfaceRedirect to="/resources" />} />
          <Route
            path="resources"
            element={
              <RequirePartner>
                <AffiliateResources />
              </RequirePartner>
            }
          />
          <Route path="login" element={<Auth />} />
          <Route path="auth" element={<SurfaceRedirect to="/login" />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          {/* Legacy in-app paths (gradr.me/affiliate/...) resolved in-portal. */}
          <Route path="affiliate" element={<SurfaceHome />} />
          <Route path="affiliate/*" element={<LegacyAffiliateRedirect />} />
          <Route path="*" element={<AffiliateNotFound />} />
        </Routes>
      </Suspense>
    </SurfaceShell>
  );
}

function LegacyAffiliateRedirect() {
  const { pathname } = useLocation();
  const path = useSurfacePath();
  const rest = pathname.split("/affiliate/")[1] ?? "";
  return <Navigate to={path(`/${rest}`)} replace />;
}

function AffiliateNotFound() {
  return (
    <div className="page-shell section-y text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page does not exist in the affiliate portal.
      </p>
      <SLink
        to="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Back to the program
      </SLink>
    </div>
  );
}
