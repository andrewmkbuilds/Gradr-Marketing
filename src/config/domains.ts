/**
 * Centralised subdomain (surface) architecture for Gradr.
 *
 * Gradr ships as a single React bundle that is served from several hostnames.
 * Which part of the product renders is decided by the hostname in production
 * and by a URL path prefix in local development / preview deployments, where
 * only one hostname exists.
 *
 *   Production                     Dev & preview (single host)
 *   ------------------------------ -----------------------------
 *   gradr.me            → home      /            → home + app
 *   www.gradr.me        → redirect  —
 *   app.gradr.me        → app       /            → app (authenticated)
 *   marketing.gradr.me  → marketing /marketing
 *   news.gradr.me       → news      /news
 *   docs.gradr.me       → docs      /docs
 *   partners.gradr.me   → partners  /partners
 *
 * Everything else (auth, Supabase client, design tokens, SEO helpers,
 * analytics) is shared — surfaces are route trees, not separate apps.
 */

export type Surface =
  | "home"
  | "app"
  | "marketing"
  | "news"
  | "docs"
  | "partners"
  | "earn"
  | "status"
  | "support";

export const SURFACES: Surface[] = [
  "home",
  "app",
  "marketing",
  "news",
  "docs",
  "partners",
  "earn",
  "status",
  "support",
];

export const ROOT_DOMAIN = "gradr.me";

/** Canonical production origin for every surface. Used for SEO + cross-links. */
export const PRODUCTION_ORIGIN: Record<Surface, string> = {
  home: `https://${ROOT_DOMAIN}`,
  app: `https://app.${ROOT_DOMAIN}`,
  marketing: `https://marketing.${ROOT_DOMAIN}`,
  news: `https://news.${ROOT_DOMAIN}`,
  docs: `https://docs.${ROOT_DOMAIN}`,
  partners: `https://partners.${ROOT_DOMAIN}`,
  earn: `https://earn.${ROOT_DOMAIN}`,
  status: `https://status.${ROOT_DOMAIN}`,
  support: `https://support.${ROOT_DOMAIN}`,
};

/** Hostname label → surface (production hostname routing). */
const SUBDOMAIN_TO_SURFACE: Record<string, Surface> = {
  app: "app",
  marketing: "marketing",
  news: "news",
  docs: "docs",
  partners: "partners",
  // Legacy hostname — the affiliate portal is now the Partner program.
  affiliates: "partners",
  earn: "earn",
  status: "status",
  support: "support",
};

/**
 * Path prefix used when several surfaces share one hostname
 * (localhost, *.lovable.app previews). `home` and `app` share the root because
 * the root route already renders the landing page for signed-out visitors and
 * the dashboard for members.
 */
export const SURFACE_PATH_PREFIX: Record<Surface, string> = {
  home: "",
  app: "",
  marketing: "/marketing",
  news: "/news",
  docs: "/docs",
  partners: "/partners",
  earn: "/earn",
  status: "/status",
  support: "/support",
};

export type DeployEnv = "development" | "preview" | "production";

function currentHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

/** Production = a real *.gradr.me hostname. Everything else is dev or preview. */
export function deployEnv(host: string = currentHost()): DeployEnv {
  if (!host) return "development";
  if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)) return "production";
  if (host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) return "preview";
  return "development";
}

export function isProduction(host: string = currentHost()): boolean {
  return deployEnv(host) === "production";
}

/**
 * Whether the satellite subdomains (app/marketing/news/docs/partners) are
 * actually *served* by hosting rather than redirected to the primary domain.
 *
 * Hosting serves exactly one primary custom domain per deployment and 302s
 * every other connected domain to it. While that is the case, production has
 * to route surfaces by path on the primary host — otherwise the authenticated
 * app becomes unreachable (gradr.me/dashboard → app.gradr.me/dashboard →
 * gradr.me/, endlessly bounced back by the platform redirect).
 *
 * Set `VITE_APP_SUBDOMAIN_LIVE=true` for the deployment that actually serves
 * app.gradr.me; from then on gradr.me is marketing-only and every product
 * route lives on app.gradr.me.
 */
export const SATELLITE_SUBDOMAINS_LIVE =
  (import.meta.env?.VITE_APP_SUBDOMAIN_LIVE as string | undefined) === "true";

/**
 * Build-time surface pin — the mechanism for one-project-per-domain hosting.
 *
 * Hosting serves exactly one primary domain per project, so the only way to get
 * `app.gradr.me` served directly is a project whose primary domain *is*
 * `app.gradr.me`. Set `VITE_GRADR_SURFACE=app` in that project and the bundle
 * renders the app surface at `/` on every host it runs on — including its
 * `*.lovable.app` preview URL, so the surface can be verified before DNS moves.
 *
 * Unset (the default, and this project) keeps today's behaviour: hostname
 * routing in production, path prefixes everywhere else.
 */
export function pinnedSurface(): Surface | null {
  const raw = (import.meta.env?.VITE_GRADR_SURFACE as string | undefined)
    ?.trim()
    .toLowerCase();
  if (!raw) return null;
  return (SURFACES as string[]).includes(raw) ? (raw as Surface) : null;
}

/**
 * True when the running bundle can prove subdomains are served independently:
 * if this code is executing on `app.gradr.me` (or any satellite host), hosting
 * did not redirect it away, so subdomain routing is live regardless of config.
 */
export function satelliteSubdomainsLive(host: string = currentHost()): boolean {
  // A pinned build is by definition a dedicated per-domain deployment.
  if (pinnedSurface()) return true;
  if (SATELLITE_SUBDOMAINS_LIVE) return true;
  if (deployEnv(host) !== "production") return false;
  const surface = surfaceFromHost(host);
  return surface !== null && surface !== "home";
}

/**
 * True when one hostname has to serve every surface (dev + preview, and
 * production while the subdomains still redirect to the primary domain).
 * In that mode surfaces live behind path prefixes and cross-surface links stay
 * on the same origin, so previews never bounce to production.
 */
export function isMultiSurfaceHost(host: string = currentHost()): boolean {
  // A pinned build serves exactly one surface at the root, on every host.
  if (pinnedSurface()) return false;
  return deployEnv(host) !== "production" || !satelliteSubdomainsLive(host);
}


/** The `www.` host is a pure redirect target — never a surface of its own. */
export function isWwwHost(host: string = currentHost()): boolean {
  return host === `www.${ROOT_DOMAIN}`;
}

/** Surface implied by a hostname, or null when the host is not a known subdomain. */
export function surfaceFromHost(host: string = currentHost()): Surface | null {
  // The apex is the public site itself.
  if (host === ROOT_DOMAIN) return "home";
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) {
    // Support `app.localhost`, `docs.localhost`, … for local subdomain testing.
    const [label, ...rest] = host.split(".");
    if (rest.length && rest[rest.length - 1] === "localhost") {
      return SUBDOMAIN_TO_SURFACE[label] ?? null;
    }
    return null;
  }
  const label = host.slice(0, -1 * (ROOT_DOMAIN.length + 1));
  if (!label || label === "www") return "home";
  return SUBDOMAIN_TO_SURFACE[label] ?? null;
}

/** Legacy path prefixes kept working after a surface was renamed. */
const LEGACY_PATH_PREFIX: Record<string, Surface> = {
  "/affiliate": "partners",
};

/** Surface implied by a path prefix on a shared host. */
export function surfaceFromPath(pathname: string): Surface | null {
  const path = pathname.toLowerCase();
  for (const [prefix, surface] of Object.entries(LEGACY_PATH_PREFIX)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return surface;
  }

  for (const surface of [
    "marketing",
    "news",
    "docs",
    "partners",
    "earn",
    "status",
    "support",
  ] as Surface[]) {
    const prefix = SURFACE_PATH_PREFIX[surface];
    if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return surface;
  }
  return null;
}

/**
 * The surface being rendered right now.
 *
 * A pinned build always renders its one surface. Otherwise production resolves
 * purely from the hostname, and on shared hosts the path prefix decides,
 * defaulting to the combined home+app surface so previews and local
 * development keep working exactly as before.
 */
export function currentSurface(pathname?: string): Surface {
  const pinned = pinnedSurface();
  if (pinned) return pinned;
  const host = currentHost();
  if (isProduction(host)) return surfaceFromHost(host) ?? "home";
  const path = pathname ?? (typeof window === "undefined" ? "/" : window.location.pathname);
  return surfaceFromPath(path) ?? "app";
}

/** Base path every in-surface link must be prefixed with on the current host. */
export function surfaceBase(surface: Surface, host: string = currentHost()): string {
  // In production, dedicated surfaces (app, earn) are served at the root of
  // their own hostname, so they never carry a path prefix — a "/earn" prefix
  // would resolve to this very URL and turn a hand-off into a reload loop.
  // On dev/preview hosts there is no separate deployment to hand off to, so the
  // usual path prefixes apply and links stay on the current origin.
  if (
    pinnedSurface() !== surface &&
    (isAlwaysExternalSurface(surface) || (isDedicatedSurface(surface) && isProduction(host)))
  ) {
    return "";
  }
  return isMultiSurfaceHost(host) ? SURFACE_PATH_PREFIX[surface] : "";
}


/**
 * Surfaces that are *never* served by this (public) bundle: the authenticated
 * product and the Earn portal each live on their own hostname. A link to one of
 * them must resolve to that hostname in production, even while the primary
 * domain still answers for everything else — resolving it to the current origin
 * is what let gradr.me pretend to be the product.
 */
export const DEDICATED_SURFACES: Surface[] = ["app", "earn"];

/** True when `surface` has its own hostname and must never resolve locally. */
export function isDedicatedSurface(surface: Surface): boolean {
  return DEDICATED_SURFACES.includes(surface);
}

/**
 * Origin a surface is served from on the current host.
 * Returns the real subdomain only when hosting actually serves it; otherwise
 * (dev, preview, or production-with-redirecting-subdomains) the current origin.
 */
export function surfaceOrigin(surface: Surface, host: string = currentHost()): string {
  // In a pinned build, links to the pinned surface stay on whatever host the
  // bundle is running on, so its preview URL stays self-contained instead of
  // bouncing to production. Other surfaces genuinely live on other origins.
  const pinned = pinnedSurface();
  if (pinned && surface === pinned && typeof window !== "undefined") {
    return window.location.origin;
  }
  // The product and Earn surfaces are never rendered by this bundle in
  // production — they always resolve to their own canonical origin, even while
  // the primary domain still answers for everything else.
  if (isDedicatedSurface(surface) && isProduction(host)) return PRODUCTION_ORIGIN[surface];
  if (!isMultiSurfaceHost(host)) return PRODUCTION_ORIGIN[surface];
  if (typeof window === "undefined") return PRODUCTION_ORIGIN[surface];
  return window.location.origin;
}

/** Absolute origin of the authenticated product. Never the current host. */
export function productOrigin(): string {
  return PRODUCTION_ORIGIN.app;
}

/** Absolute origin of the Earn portal. Never the current host. */
export function earnOrigin(): string {
  return PRODUCTION_ORIGIN.earn;
}

/** True when this bundle is genuinely serving the authenticated product. */
export function isProductHost(host: string = currentHost()): boolean {
  return pinnedSurface() === "app" || (isProduction(host) && surfaceFromHost(host) === "app");
}



/**
 * Absolute URL for a path on another surface.
 * Use this for every cross-surface link so nothing points at a Lovable URL in
 * production and nothing points at production from a preview.
 */
export function urlFor(surface: Surface, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const host = currentHost();
  const base = surfaceBase(surface, host);
  const suffix = normalized === "/" && base ? "" : normalized;
  return `${surfaceOrigin(surface, host)}${base}${suffix}`;
}

/** Canonical *production* URL for a path on a surface (SEO only, host-independent). */
export function canonicalUrlFor(surface: Surface, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // The homepage canonical keeps its trailing slash so it matches the static
  // <link rel="canonical"> and og:url in index.html exactly — crawlers treat
  // "https://gradr.me" and "https://gradr.me/" as the same URL only when we
  // advertise one spelling consistently.
  return `${PRODUCTION_ORIGIN[surface]}${normalized === "/" ? "/" : normalized}`;
}

/** Convenience: absolute URL of the authenticated app, optionally deep-linked. */
export function appUrl(path = "/"): string {
  return urlFor("app", path);
}
