/**
 * Catalog of the routes the final-QA pass must cover.
 *
 * One entry per major surface. `states` names the UI states that surface is
 * expected to be able to show — the QA page drives each one through the `?qa=`
 * override so a reviewer can eyeball loading, empty and error without having
 * to fake data in the backend.
 */

export type QaState = "default" | "loading" | "empty" | "error";

export interface QaRoute {
  /** Stable id used for checklist persistence. */
  id: string;
  label: string;
  path: string;
  group: "Public" | "Core" | "Career" | "Account" | "Admin";
  /** Requires an authenticated session to render meaningfully. */
  auth: boolean;
  states: QaState[];
}

const FULL: QaState[] = ["default", "loading", "empty", "error"];
const STATIC: QaState[] = ["default"];

export const QA_ROUTES: QaRoute[] = [
  { id: "landing", label: "Landing", path: "/landing", group: "Public", auth: false, states: STATIC },
  { id: "pricing", label: "Pricing", path: "/pricing", group: "Public", auth: false, states: ["default", "loading", "error"] },
  { id: "auth", label: "Sign in", path: "/auth", group: "Public", auth: false, states: ["default", "loading", "error"] },
  { id: "jobs-index", label: "Job search index", path: "/job-search", group: "Public", auth: false, states: STATIC },
  { id: "ats", label: "ATS resume checker", path: "/ats-resume-checker", group: "Public", auth: false, states: STATIC },
  { id: "cover-letter", label: "AI cover letter generator", path: "/ai-cover-letter-generator", group: "Public", auth: false, states: STATIC },
  { id: "tracker", label: "Job application tracker", path: "/job-application-tracker", group: "Public", auth: false, states: STATIC },
  { id: "advice", label: "Career advice", path: "/career-advice", group: "Public", auth: false, states: STATIC },
  { id: "legal", label: "Privacy policy", path: "/privacy", group: "Public", auth: false, states: STATIC },
  { id: "notfound", label: "404", path: "/this-route-does-not-exist", group: "Public", auth: false, states: STATIC },

  { id: "dashboard", label: "Dashboard", path: "/", group: "Core", auth: true, states: FULL },
  { id: "welcome", label: "Welcome", path: "/welcome", group: "Core", auth: true, states: STATIC },

  { id: "resume", label: "Resume Intelligence", path: "/resume", group: "Career", auth: true, states: FULL },
  { id: "match", label: "Job Matching", path: "/match", group: "Career", auth: true, states: FULL },
  { id: "jobs", label: "Jobs feed", path: "/jobs", group: "Career", auth: true, states: FULL },
  { id: "pipeline", label: "Pipeline", path: "/pipeline", group: "Career", auth: true, states: FULL },
  { id: "apply", label: "Application Engine", path: "/apply", group: "Career", auth: true, states: FULL },
  { id: "interview", label: "AI Mock Interview", path: "/interview", group: "Career", auth: true, states: FULL },
  { id: "growth", label: "Growth Engine", path: "/growth", group: "Career", auth: true, states: FULL },

  { id: "settings", label: "Settings", path: "/settings", group: "Account", auth: true, states: ["default", "loading", "error"] },
  { id: "billing", label: "Billing", path: "/billing", group: "Account", auth: true, states: ["default", "loading", "error"] },

  { id: "admin-home", label: "Admin control room", path: "/admin", group: "Admin", auth: true, states: ["default", "loading", "error"] },
  { id: "admin-revenue", label: "Admin revenue", path: "/admin/revenue", group: "Admin", auth: true, states: ["default", "loading", "error"] },
  { id: "admin-usage", label: "Admin usage", path: "/admin/usage", group: "Admin", auth: true, states: ["default", "loading", "error"] },
  { id: "admin-design", label: "Design system", path: "/admin/design-system", group: "Admin", auth: true, states: STATIC },
];

export const QA_GROUPS = ["Public", "Core", "Career", "Account", "Admin"] as const;

export const STATE_LABEL: Record<QaState, string> = {
  default: "Default",
  loading: "Loading",
  empty: "Empty",
  error: "Error",
};

/** Builds the preview URL for a route/state pair. */
export function qaPreviewUrl(route: QaRoute, state: QaState): string {
  const url = new URL(route.path, window.location.origin);
  if (state !== "default") url.searchParams.set("qa", state);
  url.searchParams.set("qaFrame", "1");
  return url.toString();
}

/** Total number of route × state cells the checklist tracks. */
export function totalChecks(routes: QaRoute[] = QA_ROUTES): number {
  return routes.reduce((sum, route) => sum + route.states.length, 0);
}
