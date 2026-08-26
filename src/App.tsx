import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { MotionPreferenceProvider } from "@/hooks/useMotionPreference";
import { AnimatedPage } from "@/components/AnimatedPage";
import { RouteSeo } from "@/components/RouteSeo";
import { CANONICAL_ALIASES } from "@/lib/seo/canonical";
import { CookieConsent } from "@/components/CookieConsent";
import { CursorEffects } from "@/components/effects/CursorEffects";
import { AuthHandoffFallback } from "@/components/AuthHandoffFallback";

import { OfflineBanner } from "@/components/OfflineBanner";
import { RouteSkeleton } from "@/components/states/PageSkeletons";

import { ScrollToTop } from "@/components/ScrollToTop";
import { AnimatePresence } from "motion/react";
import { captureReferralFromUrl } from "@/lib/affiliateTracking";
import { SentryErrorBoundary, addBreadcrumb } from "@/lib/telemetry/sentry";
import { phPageview } from "@/lib/telemetry/posthog";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { captureAttribution } from "@/lib/telemetry/attribution";
import { trackOnce } from "@/lib/telemetry/events";
import { clearRequestId, pendingRequestId, recordOAuthHop } from "@/lib/oauth/forensics";

import NotFound from "./pages/NotFound";

import Landing from "./pages/Landing";
import {
  type Surface,
  SURFACE_PATH_PREFIX,
  currentSurface,
  isMultiSurfaceHost,
  isWwwHost,
  ROOT_DOMAIN,
  urlFor,
} from "@/config/domains";
import { SurfaceProvider } from "@/components/surface/SurfaceLink";

// This project serves the public Gradr brand surfaces only. The authenticated
// product (dashboard, engines, account and admin) lives in the separate
// "Gradr (App)" project on app.gradr.me and is deliberately not mounted here.
const MarketingSurface = lazy(() => import("./surfaces/MarketingSurface"));
import { AppPricingRedirect } from "@/components/surface/AppPricingRedirect";
import { LegacyAppRedirect } from "@/components/surface/LegacyAppRedirect";
const DesignSystemGallery = lazy(() => import("./pages/DesignSystemGallery"));
const Connect = lazy(() => import("./pages/Connect"));
const MarketingEmailOps = lazy(() => import("./pages/MarketingEmailOps"));
const NewsSurface = lazy(() => import("./surfaces/NewsSurface"));
const DocsSurface = lazy(() => import("./surfaces/DocsSurface"));
const AffiliatesSurface = lazy(() => import("./surfaces/AffiliatesSurface"));
const StatusSurface = lazy(() => import("./surfaces/StatusSurface"));
const SupportSurface = lazy(() => import("./surfaces/SupportSurface"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const Dpa = lazy(() => import("./pages/legal/Dpa"));
const ChildrensPrivacy = lazy(() => import("./pages/legal/ChildrensPrivacy"));
const AcceptableUse = lazy(() => import("./pages/legal/AcceptableUse"));
const AiDisclaimer = lazy(() => import("./pages/legal/AiDisclaimer"));
const Disclaimer = lazy(() => import("./pages/legal/Disclaimer"));
const AffiliateDisclosure = lazy(() => import("./pages/legal/AffiliateDisclosure"));
const LegalHub = lazy(() => import("./pages/legal/LegalHub"));
const AiResumeOptimization = lazy(() => import("./pages/blog/AiResumeOptimization"));
const AtsResumeChecker = lazy(() => import("./pages/AtsResumeChecker"));
const AiCoverLetterGenerator = lazy(() => import("./pages/AiCoverLetterGenerator"));
const AiInterviewCoach = lazy(() => import("./pages/AiInterviewCoach"));
const JobApplicationTracker = lazy(() => import("./pages/JobApplicationTracker"));
const CareerAdvice = lazy(() => import("./pages/CareerAdvice"));
const GuideArticle = lazy(() => import("./pages/GuideArticle"));
const JobSearchIndex = lazy(() => import("./pages/JobSearchIndex"));
const JobLanding = lazy(() => import("./pages/JobLanding"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const NewsletterConfirm = lazy(() => import("./pages/NewsletterConfirm"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

/**
 * Route-shaped placeholder shown while a route chunk streams in.
 */
function RouteFallback() {
  const location = useLocation();
  return <RouteSkeleton pathname={location.pathname} />;
}

/** Full-page redirect to another surface, preserving the remaining path. */
function ExternalSurfaceRedirect({ surface, strip }: { surface: Surface; strip: string }) {
  const location = useLocation();
  useEffect(() => {
    const rest = location.pathname.slice(strip.length) || "/";
    window.location.replace(urlFor(surface, `${rest}${location.search}`));
  }, [location.pathname, location.search, strip, surface]);
  return null;
}

/**
 * Anything product-shaped belongs to the app project. In production we hand the
 * visitor over to app.gradr.me; on shared hosts (dev + preview) there is no app
 * bundle to hand off to, so we render the 404 instead of bouncing off-site.
 */
function AppSurfaceHandoff() {
  if (isMultiSurfaceHost()) {
    return <AnimatedPage><NotFound /></AnimatedPage>;
  }
  return <ExternalSurfaceRedirect surface="app" strip="" />;
}

function SurfaceOutlet({ surface }: { surface: Surface }) {
  const Component = {
    marketing: MarketingSurface,
    news: NewsSurface,
    docs: DocsSurface,
    affiliates: AffiliatesSurface,
    status: StatusSurface,
    support: SupportSurface,
  }[surface as "marketing" | "news" | "docs" | "affiliates" | "status" | "support"];
  return (
    <SurfaceProvider surface={surface}>
      <Component />
    </SurfaceProvider>
  );
}

const SATELLITE_SURFACES: Surface[] = [
  "marketing",
  "news",
  "docs",
  "affiliates",
  "status",
  "support",
];

function AppRoutes() {
  const location = useLocation();
  const multiSurface = isMultiSurfaceHost();
  const hostSurface = currentSurface(location.pathname);

  // Production: a dedicated subdomain serves exactly one surface and mounts no
  // product, account or admin routes at all.
  if (!multiSurface && SATELLITE_SURFACES.includes(hostSurface)) {
    return <SurfaceOutlet surface={hostSurface} />;
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Satellite surfaces: mounted under a path prefix on shared hosts
            (local dev + previews), redirected to their real subdomain in
            production so a URL only ever resolves in one place. */}
        {SATELLITE_SURFACES.map((surface) =>
          multiSurface ? (
            <Route
              key={surface}
              path={`${SURFACE_PATH_PREFIX[surface]}/*`}
              element={<SurfaceOutlet surface={surface} />}
            />
          ) : (
            <Route
              key={surface}
              path={`${SURFACE_PATH_PREFIX[surface]}/*`}
              element={
                <ExternalSurfaceRedirect surface={surface} strip={SURFACE_PATH_PREFIX[surface]} />
              }
            />
          ),
        )}

        <Route path="/newsletter/confirm" element={<AnimatedPage><NewsletterConfirm /></AnimatedPage>} />
        <Route path="/unsubscribe" element={<AnimatedPage><Unsubscribe /></AnimatedPage>} />
        <Route path="/landing" element={<AnimatedPage><Landing /></AnimatedPage>} />
        <Route path="/" element={<AnimatedPage><Landing /></AnimatedPage>} />
        {/* Sign-in and account recovery belong to the app project. */}
        <Route path="/auth" element={<AppSurfaceHandoff />} />
        <Route path="/forgot-password" element={<AppSurfaceHandoff />} />
        <Route path="/reset-password" element={<AppSurfaceHandoff />} />
        <Route path="/blog/ai-resume-optimization" element={<AnimatedPage><AiResumeOptimization /></AnimatedPage>} />
        <Route path="/ats-resume-checker" element={<AnimatedPage><AtsResumeChecker /></AnimatedPage>} />
        <Route path="/ai-cover-letter-generator" element={<AnimatedPage><AiCoverLetterGenerator /></AnimatedPage>} />
        <Route path="/ai-interview-coach" element={<AnimatedPage><AiInterviewCoach /></AnimatedPage>} />
        <Route path="/job-application-tracker" element={<AnimatedPage><JobApplicationTracker /></AnimatedPage>} />
        {/* Duplicate URL variants collapse into the canonical path so only one
            version of each landing page can ever be indexed. */}
        {Object.keys(CANONICAL_ALIASES).map((alias) => (
          <Route key={alias} path={alias} element={<Navigate to={CANONICAL_ALIASES[alias]} replace />} />
        ))}
        <Route path="/career-advice" element={<AnimatedPage><CareerAdvice /></AnimatedPage>} />
        <Route path="/career-advice/:slug" element={<AnimatedPage><GuideArticle /></AnimatedPage>} />
        {/* Marketing surfaces never initialise checkout: /pricing hands the
            visitor to the product's pricing route on app.gradr.me. */}
        <Route path="/pricing" element={<AppPricingRedirect />} />
        <Route path="/privacy" element={<AnimatedPage><Privacy /></AnimatedPage>} />
        <Route path="/terms" element={<AnimatedPage><Terms /></AnimatedPage>} />
        <Route path="/refund-policy" element={<AnimatedPage><RefundPolicy /></AnimatedPage>} />
        <Route path="/cookie-policy" element={<AnimatedPage><CookiePolicy /></AnimatedPage>} />
        <Route path="/dpa" element={<AnimatedPage><Dpa /></AnimatedPage>} />
        <Route path="/childrens-privacy" element={<AnimatedPage><ChildrensPrivacy /></AnimatedPage>} />
        <Route path="/acceptable-use" element={<AnimatedPage><AcceptableUse /></AnimatedPage>} />
        <Route path="/ai-disclaimer" element={<AnimatedPage><AiDisclaimer /></AnimatedPage>} />
        <Route path="/disclaimer" element={<AnimatedPage><Disclaimer /></AnimatedPage>} />
        <Route path="/affiliate-disclosure" element={<AnimatedPage><AffiliateDisclosure /></AnimatedPage>} />
        <Route path="/legal" element={<AnimatedPage><LegalHub /></AnimatedPage>} />
        <Route path="/job-search" element={<AnimatedPage><JobSearchIndex /></AnimatedPage>} />
        <Route path="/job-search/:slug" element={<AnimatedPage><JobLanding /></AnimatedPage>} />
        {/* Internal, noindexed component gallery used by the visual suites. */}
        <Route path="/design-system" element={<DesignSystemGallery />} />
        {/* Internal, noindexed marketing email console (admin-gated server-side). */}
        <Route path="/ops/marketing-emails" element={<MarketingEmailOps />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        {/* Legacy product URLs (/login, /signup, /dashboard, …) forward to
            their real home on app.gradr.me; anything else is a genuine 404. */}
        <Route path="*" element={<LegacyAppRedirect />} />

      </Routes>
    </AnimatePresence>
  );
}

/** www.gradr.me is a redirect-only host: bounce to the apex, keeping the path. */
function WwwRedirect() {
  useEffect(() => {
    if (!isWwwHost()) return;
    const { pathname, search, hash } = window.location;
    window.location.replace(`https://${ROOT_DOMAIN}${pathname}${search}${hash}`);
  }, []);
  return null;
}

function ReferralCapture() {
  useEffect(() => { void captureReferralFromUrl(); }, []);
  return null;
}

const HOMEPAGE_PATHS = new Set(["/", "/landing", "/home"]);

function TelemetryRouteTracker() {
  const location = useLocation();
  const { user, loading } = useAuth();

  // First-touch campaign data has to be read before any in-app navigation
  // rewrites the query string.
  useEffect(() => { captureAttribution(); }, []);

  useEffect(() => {
    phPageview(location.pathname);
    addBreadcrumb("navigation", location.pathname);
    if (HOMEPAGE_PATHS.has(location.pathname)) {
      trackOnce("homepage_viewed", { path: location.pathname }, "route");
    }
    if (location.pathname === "/pricing") {
      trackOnce("pricing_viewed", { path: location.pathname }, "route");
    }
  }, [location.pathname]);

  useEffect(() => {
    if (loading || !user || user.is_anonymous === true || !pendingRequestId()) return;
    if (location.pathname === "/auth" || location.pathname === "/~oauth/callback") return;

    const finalUrl = window.location.href;
    void recordOAuthHop({
      stage: "session",
      sourceUrl: document.referrer || undefined,
      destinationUrl: finalUrl,
      finalUrl,
      accountType: "existing",
      note: "authenticated route rendered after OAuth",
      metadata: {
        origin: window.location.origin,
        pathname: location.pathname,
      },
    }).finally(clearRequestId);
  }, [loading, user, location.pathname]);
  return null;
}

const App = () => (
  <SentryErrorBoundary
    fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Something broke on our side</p>
          <p className="text-sm text-muted-foreground">
            The issue has been reported. Refresh the page to continue.
          </p>
        </div>
      </div>
    }
  >
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <MotionPreferenceProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WwwRedirect />
          <ScrollToTop />
          <ReferralCapture />
          <AuthProvider>
            <TelemetryRouteTracker />
            <AnalyticsProvider />
            <RouteSeo />
            <Suspense fallback={<RouteFallback />}>
              <AppRoutes />
            </Suspense>
            <CookieConsent />
            <CursorEffects />
            <OfflineBanner />
            <AuthHandoffFallback />

          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </MotionPreferenceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </SentryErrorBoundary>
);


export default App;
