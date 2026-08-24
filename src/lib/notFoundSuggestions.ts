/**
 * 404 recovery helpers.
 *
 * A miss on the marketing host is almost always one of three things: a typo, a
 * retired marketing URL, or a product URL that now lives on app.gradr.me. This
 * module holds the destination registry plus the matching used to turn the
 * requested path into concrete next steps, so the page component stays
 * presentational and the logic is unit-testable.
 *
 * Privacy: the requested path can contain anything a visitor pasted (tokens,
 * emails in query strings). `sanitizeRequestedPath` is what analytics and the
 * on-screen echo both use — it strips the query/hash, caps the length and
 * masks segments that look like secrets.
 */
import { appHref, appLoginHref, appPricingHref, appSignupHref } from "@/lib/appLinks";

export interface NotFoundDestination {
  /** Marketing route (relative) or absolute app URL resolver key. */
  to: string;
  title: string;
  description: string;
  /** "app" destinations must always be absolute app.gradr.me URLs. */
  surface: "marketing" | "app";
  /** Extra words used only for matching, never rendered. */
  keywords?: string[];
}

/**
 * Popular destinations offered after a miss. Marketing entries are router
 * paths; app entries are resolved through `appLinks` so they are absolute
 * app.gradr.me URLs from every marketing surface.
 */
export const NOT_FOUND_DESTINATIONS: NotFoundDestination[] = [
  {
    to: "/ats-resume-checker",
    title: "ATS resume checker",
    description: "Score your resume against the filters recruiters actually run.",
    surface: "marketing",
    keywords: ["resume", "ats", "score", "checker", "cv", "optimization"],
  },
  {
    to: "/ai-interview-coach",
    title: "AI interview coach",
    description: "Practise live mock interviews and get an instant scorecard.",
    surface: "marketing",
    keywords: ["interview", "mock", "coach", "practice", "questions"],
  },
  {
    to: "/ai-cover-letter-generator",
    title: "Cover letter generator",
    description: "Draft a tailored cover letter for any role in seconds.",
    surface: "marketing",
    keywords: ["cover", "letter", "generator", "apply"],
  },
  {
    to: "/job-application-tracker",
    title: "Application tracker",
    description: "Keep every application, follow-up and interview in one pipeline.",
    surface: "marketing",
    keywords: ["tracker", "pipeline", "applications", "follow", "status"],
  },
  {
    to: "/job-search",
    title: "Job search",
    description: "Real openings matched to your profile, refreshed daily.",
    surface: "marketing",
    keywords: ["jobs", "search", "openings", "roles", "hiring", "match"],
  },
  {
    to: "/career-advice",
    title: "Career advice",
    description: "Guides on resumes, applications and interview prep.",
    surface: "marketing",
    keywords: ["advice", "guides", "blog", "tips", "help", "career"],
  },
  {
    to: "/blog/ai-resume-optimization",
    title: "AI resume optimization guide",
    description: "How to rewrite a resume so an AI screen ranks it higher.",
    surface: "marketing",
    keywords: ["resume", "optimization", "ai", "builder", "rewrite", "keywords"],
  },
];

/** App destinations, resolved lazily so the origin is decided at render time. */
export function appDestinations(): NotFoundDestination[] {
  return [
    {
      to: appLoginHref(),
      title: "Log in to Gradr",
      description: "Your dashboard, resumes and interviews live on app.gradr.me.",
      surface: "app",
      keywords: ["login", "log", "signin", "sign", "auth", "account", "dashboard", "home", "app"],
    },
    {
      to: appSignupHref(),
      title: "Create a free account",
      description: "Start with the free plan — no card required.",
      surface: "app",
      keywords: ["signup", "sign", "register", "create", "join", "start", "free", "trial"],
    },
    {
      to: appPricingHref(),
      title: "Plans & pricing",
      description: "Compare the free, starter and pro plans in the app.",
      surface: "app",
      keywords: ["pricing", "plans", "price", "cost", "upgrade", "billing", "subscription"],
    },
    {
      to: appHref("/support"),
      title: "Support & help centre",
      description: "Search answers or message the Gradr team.",
      surface: "app",
      keywords: ["support", "help", "contact", "faq", "issue", "bug"],
    },
  ];
}

const MAX_PATH = 120;
const SECRET_SEGMENT = /^(?=.*\d)[A-Za-z0-9._-]{20,}$|@|%40/;

export interface SanitizedPath {
  /** Safe-to-render, safe-to-log path. */
  path: string;
  /** True when anything was stripped or masked from the requested URL. */
  sanitized: boolean;
}

/**
 * Reduces an arbitrary requested URL to a loggable path: query and hash are
 * dropped, long/secret-looking segments are masked, and the result is capped.
 */
export function sanitizeRequestedPath(raw: string): SanitizedPath {
  const withoutQuery = raw.split(/[?#]/)[0] ?? "";
  let sanitized = withoutQuery !== raw;

  const segments = withoutQuery.split("/").filter(Boolean);
  const masked = segments.map((segment) => {
    const decoded = (() => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })();
    if (SECRET_SEGMENT.test(decoded)) {
      sanitized = true;
      return "…";
    }
    if (decoded !== segment) sanitized = true;
    return decoded.replace(/[^\w.@-]+/g, "-");
  });

  let path = `/${masked.join("/")}`;
  if (path.length > MAX_PATH) {
    path = `${path.slice(0, MAX_PATH)}…`;
    sanitized = true;
  }
  return { path, sanitized };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

/** Classic Levenshtein distance, used for single-token typo tolerance. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

export interface RouteSuggestion extends NotFoundDestination {
  score: number;
}

/**
 * Ranks destinations against the requested path.
 *
 * Scoring, highest first: an exact token match on the destination slug, then a
 * keyword hit, then a near-miss (edit distance ≤ 2) so `/ats-resume-checkr` and
 * `/intervew-coach` still resolve to the right page.
 */
export function suggestRoutes(
  requestedPath: string,
  destinations: NotFoundDestination[] = NOT_FOUND_DESTINATIONS,
  limit = 3,
): RouteSuggestion[] {
  const tokens = tokenize(requestedPath);
  if (tokens.length === 0) return [];

  const ranked = destinations.map((destination) => {
    const slugTokens = tokenize(destination.to.replace(/^https?:\/\/[^/]+/, ""));
    const titleTokens = tokenize(destination.title);
    const keywords = destination.keywords ?? [];
    let score = 0;

    for (const token of tokens) {
      if (slugTokens.includes(token)) score += 4;
      else if (titleTokens.includes(token)) score += 3;
      else if (keywords.includes(token)) score += 2;
      else if (
        [...slugTokens, ...keywords].some(
          (candidate) => token.length > 3 && distance(token, candidate) <= 2,
        )
      ) {
        score += 1;
      }
    }
    return { ...destination, score };
  });

  return ranked
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
