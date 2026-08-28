import { useEffect } from "react";
import { canonicalPath } from "@/lib/seo/canonical";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { GUIDES_BY_SLUG } from "@/content/guides";
import { JOB_LANDINGS_BY_SLUG } from "@/content/jobLandings";
import { legalJsonLd } from "@/lib/structuredData";
import { POLICIES_UPDATED } from "@/content/legal";
import { CHILDRENS_PRIVACY_EFFECTIVE, COOKIE_POLICY_EFFECTIVE, DPA_EFFECTIVE } from "@/content/legalExtra";
import {
  type Surface,
  canonicalUrlFor,
  currentSurface,
  surfaceBase,
} from "@/config/domains";
import { DOCS_BY_SLUG } from "@/content/docs";
import { NEWS_BY_SLUG } from "@/content/news";

const SITE = "Gradr";
const ORIGIN = "https://gradr.me";
const OG_IMAGE = `${ORIGIN}/og.png`;

const META: Record<string, { title: string; description: string }> = {
  // "/" renders the public Gradr landing page for signed-out visitors (and the
  // dashboard once authenticated), so its metadata must describe the product.
  "/": {
    title: "AI Career Copilot for Resumes, Jobs & Interviews",
    description:
      "Gradr is your AI career copilot for building better resumes, finding the right jobs, tracking applications, and practicing interviews in one powerful workspace.",
  },
  // Product tour page. Must not reuse the homepage title/description or search
  // engines and social platforms treat it as a duplicate of "/".
  "/landing": {
    title: "Product Tour: How Gradr Takes You From Resume to Offer",
    description:
      "See how Gradr works end to end: ATS resume scoring, job matching, application tracking, and AI mock interviews — with a walkthrough of every module.",
  },
  "/manage-subscription": {
    title: "Manage Your Subscription",
    description:
      "View your Gradr plan, update payment details, change between monthly and annual billing, or cancel your subscription at any time.",
  },
  "/auth": {
    title: "Sign in",
    description: "Sign in or create your Gradr account to access your AI career command center.",
  },
  "/forgot-password": {
    title: "Forgot password",
    description: "Reset your Gradr password and get back to your career workflow.",
  },
  "/reset-password": {
    title: "Reset password",
    description: "Choose a new secure password for your Gradr account and get straight back to your job search workflow.",
  },
  "/verify-email": {
    title: "Verify your email",
    description: "Confirm your email address to activate your Gradr account and unlock resume scoring, job matching, and AI mock interviews.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "How Gradr collects, stores, and protects your resume data, interview recordings, and account information — plus your rights and choices.",
  },
  "/terms": {
    title: "Terms & Conditions",
    description: "The terms that govern your use of Gradr, including subscriptions, AI feature usage, acceptable use, and account responsibilities.",
  },
  "/refund-policy": {
    title: "Refund Policy",
    description: "Gradr's refund window, eligibility rules, and how to request a refund for a subscription or credit purchase billed through Paddle.",
  },
  "/cookie-policy": {
    title: "Cookie Policy",
    description: "Every cookie and storage key Gradr sets, grouped by category, plus how to accept, reject, or fine-tune analytics, attribution, and functional cookies.",
  },
  "/childrens-privacy": {
    title: "Children's Privacy Notice",
    description: "Gradr is for people aged 13 and over. How our age screen works, what we do if a child under 13 registers, and how a parent or guardian can have data deleted.",
  },
  "/dpa": {
    title: "Data Processing Addendum",
    description: "Gradr's DPA for universities, bootcamps, and employers — processing roles, sub-processors, security measures, international transfers, and deletion terms.",
  },
  "/legal": {
    title: "Legal Center",
    description: "Every Gradr policy in one place: terms, privacy, cookies, refunds, acceptable use, AI disclosures, the DPA, and our children's privacy notice.",
  },
  "/acceptable-use": {
    title: "Acceptable Use Policy",
    description: "What you may and may not do with Gradr — prohibited content, automated scraping, resume misrepresentation, abuse of AI features, and how we enforce the rules.",
  },
  "/ai-disclaimer": {
    title: "AI Disclaimer",
    description: "How Gradr uses AI for resume scoring, job matching, and mock interviews — what the models can and cannot do, and why every output needs your review.",
  },
  "/disclaimer": {
    title: "General Disclaimer",
    description: "Gradr provides career tooling, not employment, legal, or financial advice. What our scores, matches, and interview feedback do and do not guarantee.",
  },
  "/affiliate-disclosure": {
    title: "Affiliate Disclosure",
    description: "How Gradr's affiliate and referral programs work, when we earn a commission from a link, and how that never changes what we recommend to you.",
  },

  "/resume": {
    title: "Resume Engine",
    description: "Upload your resume for AI scoring, ATS analysis, and rewrite suggestions tailored to your goals.",
  },
  "/jobs": {
    title: "Job Feed",
    description: "Personalized AI-matched job opportunities, refreshed daily and ranked to your profile.",
  },
  "/match": {
    title: "Job Matching",
    description: "Score your resume against any role and get a strategy to close the gap.",
  },
  "/pipeline": {
    title: "Pipeline",
    description: "Drag-and-drop application tracker — manage every job from saved to offer in one view.",
  },
  "/apply": {
    title: "Application Engine",
    description: "Generate tailored cover letters and recruiter outreach in one click.",
  },
  "/interview": {
    title: "Interview Engine",
    description: "Practice realtime AI mock interviews with instant feedback and coaching.",
  },
  "/interview/history": {
    title: "Interview History",
    description: "Review past AI mock interviews, track score trends, and revisit every scorecard and transcript.",
  },
  "/growth": {
    title: "Growth Engine",
    description: "AI skill gap analysis and a personalized roadmap to your next role.",
  },
  "/pricing": {
    title: "Pricing",
    description: "Simple plans for every job seeker — start free, upgrade when you need more AI power.",
  },
  "/billing": {
    title: "Billing",
    description: "Manage your Gradr plan, invoices, credit packs, and payment method in one place.",
  },
  "/settings": {
    title: "Settings",
    description: "Manage your Gradr account, preferences, and digest settings.",
  },
  "/affiliate": {
    title: "Partner Program",
    description: "Earn recurring commission by referring job seekers to Gradr — transparent rates and monthly payouts.",
  },
  "/affiliate/apply": {
    title: "Apply to the Affiliate Program",
    description: "Tell us about your audience and apply to become a Gradr affiliate partner.",
  },
  "/affiliate/resources": {
    title: "Affiliate Resources",
    description: "Commission rules, payout terms, and referral policies for Gradr affiliate partners.",
  },
  "/blog/ai-resume-optimization": {
    title: "AI Resume Builder & ATS Guide",
    description: "How AI resume builders help candidates beat Applicant Tracking Systems — keyword matching, formatting rules, and AI-driven rewrites.",
  },
  "/ats-resume-checker": {
    title: "ATS Resume Checker — Free Resume Scan & Score",
    description: "Free ATS resume checker: score your resume against any job description, spot formatting a parser can't read, and get the exact missing keywords.",
  },
  "/job-application-tracker": {
    title: "Job Application Tracker — Free AI Job Search Pipeline",
    description:
      "Track every job application in one AI pipeline: match scores, tailored resumes and cover letters, automatic follow-up reminders, and response-rate analytics.",
  },
  "/ai-cover-letter-generator": {
    title: "AI Cover Letter Generator — Free & Tailored to Any Job",
    description:
      "Generate a tailored one-page cover letter from your resume and any job description. Grounded in your real experience, editable, and saved with each application.",
  },
  "/ai-interview-coach": {
    title: "AI Interview Coach — Free Voice Mock Interviews",
    description:
      "Practice spoken mock interviews with an AI interview coach that adapts to your target role, asks real follow-ups, and scores your answers with a full transcript.",
  },
  "/career-advice": {
    title: "Career Advice",
    description: "Free guides on resume optimization, cover letters, and interview preparation — practical advice for every stage of your job search.",
  },
  "/job-search": {
    title: "Job Search by Role & Location",
    description: "Browse job search pages by role, city, and remote preference, with the skills each role asks for and how to tailor your application.",
  },
};

/** Resolve metadata for dynamic content routes (guides and job landing pages). */
function resolveDynamicMeta(pathname: string): { title: string; description: string } | null {
  const guideSlug = pathname.startsWith("/career-advice/") ? pathname.slice(15) : null;
  if (guideSlug && GUIDES_BY_SLUG[guideSlug]) {
    const guide = GUIDES_BY_SLUG[guideSlug];
    return { title: guide.metaTitle, description: guide.description };
  }
  const jobSlug = pathname.startsWith("/job-search/") ? pathname.slice(12) : null;
  if (jobSlug && JOB_LANDINGS_BY_SLUG[jobSlug]) {
    const landing = JOB_LANDINGS_BY_SLUG[jobSlug];
    return { title: landing.metaTitle, description: landing.description };
  }
  return null;
}

/**
 * Blog posts and guides ship a pre-rendered, per-article social card
 * (scripts/generate-og-images.mjs). Everything else falls back to the
 * generic site image.
 */
const PAGE_OG_IMAGES: Record<string, string> = {
  "/ai-interview-coach": `${ORIGIN}/og/page-ai-interview-coach.png`,
};

function resolveOgImage(pathname: string): string {
  if (PAGE_OG_IMAGES[pathname]) return PAGE_OG_IMAGES[pathname];
  if (pathname.startsWith("/blog/")) {
    const slug = pathname.slice(6);
    if (slug) return `${ORIGIN}/og/blog-${slug}.png`;
  }
  if (pathname.startsWith("/career-advice/")) {
    const slug = pathname.slice(15);
    if (slug && GUIDES_BY_SLUG[slug]) return `${ORIGIN}/og/guide-${slug}.png`;
  }
  return OG_IMAGE;
}

/**
 * Routes that must never enter a search index: authenticated product surfaces,
 * account/credential flows, admin tooling and affiliate back-office. They hold
 * no public content and only dilute how search engines understand Gradr.
 */
const NOINDEX_EXACT = new Set([
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/welcome",
  "/settings",
  "/billing",
  "/resume",
  "/jobs",
  "/match",
  "/pipeline",
  "/apply",
  "/interview",
  "/interview/history",
  "/growth",
  "/affiliate/apply",
  "/affiliate/resources",
]);

const NOINDEX_PREFIXES = ["/admin", "/interview/", "/oauth", "/mcp"];

function isNoIndex(pathname: string): boolean {
  if (NOINDEX_EXACT.has(pathname)) return true;
  return NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Per-surface metadata for the marketing, news, docs and partner subdomains. */
const SURFACE_META: Partial<Record<Surface, Record<string, { title: string; description: string }>>> = {
  marketing: {
    "/": {
      title: "Gradr Product — One Workspace From Resume to Offer",
      description:
        "Explore the Gradr product: ATS resume scoring, live job matching, application strategy, AI mock interviews and career analytics in one workspace.",
    },
    "/features": {
      title: "Features — Resume, Matching, Applications & Interviews",
      description:
        "Every Gradr module in detail: Resume Intelligence, job matching, application strategy, AI Mock Interview, networking and career analytics.",
    },
    "/use-cases": {
      title: "Use Cases — Students, Switchers, Professionals & Cohorts",
      description:
        "How students, career switchers, experienced professionals and career-services teams use Gradr to run a measurable job search.",
    },
    "/pricing": {
      title: "Pricing — Free, Starter, Pro & Advanced Plans",
      description:
        "Compare Gradr plans and monthly or yearly billing. Start free, upgrade when you need more AI resume scans, matches and interview minutes.",
    },
    "/testimonials": {
      title: "Testimonials — What Candidates Say About Gradr",
      description:
        "Real outcomes from candidates who used Gradr to fix their resume, target better roles and rehearse interviews before the real thing.",
    },
    "/demos": {
      title: "Product Demos — See Gradr Work in Three Steps",
      description:
        "Three short walkthroughs of Gradr: score a resume, match a live role, and run a voice mock interview — all on the free plan.",
    },
    "/about": {
      title: "About Gradr — Feedback Loops for the Job Search",
      description:
        "Why Gradr exists, how we treat your data, and the principles behind objective resume scoring and realistic interview practice.",
    },
  },
  news: {
    "/": {
      title: "Gradr News — Product Updates & Job-Market Analysis",
      description:
        "Product announcements, company updates and job-market analysis from the Gradr team, plus practical guides for candidates.",
    },
  },
  docs: {
    "/": {
      title: "Gradr Documentation — Guides, Features & Troubleshooting",
      description:
        "Official Gradr documentation: quickstart, feature guides, AI Mock Interview reference, billing, API access and troubleshooting.",
    },
  },
  partners: {
    "/": {
      title: "Gradr Partner Program — Earn Recurring Commission",
      description:
        "Join the Gradr Partner Program: recurring commission on every referred subscription, a generous attribution window, transparent tracking and manual partner review.",
    },
  },
  status: {
    "/": {
      title: "Gradr Status — Live Service Health & Incidents",
      description:
        "Real-time availability for the Gradr app, authentication, AI Mock Interview, resume tools, job matching, billing and email delivery.",
    },
  },
  support: {
    "/": {
      title: "Gradr Support — Help Center & Contact",
      description:
        "Get help with Gradr: browse answers to common questions about accounts, billing, resumes and interviews, or contact the support team.",
    },
    "/contact": {
      title: "Contact Gradr Support",
      description:
        "Reach the Gradr support team. Send us the details of your issue and we'll get back to you by email.",
    },
  },
};


/** Metadata for a surface path, including dynamic docs and news articles. */
function resolveSurfaceMeta(
  surface: Surface,
  path: string,
): { title: string; description: string } | null {
  const table = SURFACE_META[surface];
  if (table?.[path]) return table[path];

  if (surface === "docs") {
    const doc = DOCS_BY_SLUG[path.replace(/^\//, "")];
    if (doc) return { title: doc.metaTitle, description: doc.description };
  }
  if (surface === "news") {
    const article = NEWS_BY_SLUG[path.replace(/^\//, "")];
    if (article) return { title: article.metaTitle, description: article.description };
  }
  return null;
}

/**
 * Robots policy per surface. Marketing, news and docs are fully public; the
 * affiliate portal only exposes its program and application pages to crawlers;
 * the home surface keeps the existing per-path rules.
 */
function isSurfaceNoIndex(surface: Surface, path: string): boolean {
  if (
    surface === "marketing" ||
    surface === "news" ||
    surface === "docs" ||
    surface === "status" ||
    surface === "support"
  ) {
    // Unknown paths render the in-surface 404 — never let those be indexed.
    return resolveSurfaceMeta(surface, path) === null;
  }
  if (surface === "partners") return path !== "/";
  return isNoIndex(path);
}

export function RouteSeo() {
  const { pathname: rawPathname } = useLocation();

  // Each subdomain is its own SEO surface: metadata, canonical host and robots
  // behaviour are resolved from the surface, never hard-coded to gradr.me.
  const surface = currentSurface(rawPathname);
  const base = surfaceBase(surface);
  // On shared hosts (dev/preview) surfaces sit behind a path prefix. Strip it so
  // canonicals always describe the real production URL.
  const pathname =
    base && rawPathname.startsWith(base) ? rawPathname.slice(base.length) || "/" : rawPathname;

  const surfaceMeta = resolveSurfaceMeta(surface, canonicalPath(pathname));
  const meta = surfaceMeta ??
    META[canonicalPath(pathname)] ??
    resolveDynamicMeta(canonicalPath(pathname)) ?? {
      title: "AI Career Copilot for Resumes, Jobs & Interviews",
      description:
        "Gradr is your AI career copilot for building better resumes, finding the right jobs, tracking applications, and practicing interviews in one powerful workspace.",
    };
  // Only the homepage uses the brand-first title; every other route (including
  // /landing) gets its own distinct title so titles and og:title never collide.
  const fullTitle =
    pathname === "/" && surface === "home"
      ? "Gradr | AI Career Copilot for Resumes, Jobs & Interviews"
      : `${meta.title} — ${SITE}`;
  // Canonical always points at the normalised path (lowercase, no trailing
  // slash, aliases resolved) on this surface's own production origin, so
  // docs.gradr.me never canonicalises to gradr.me and vice versa.
  const canonical = canonicalPath(pathname);
  // app.gradr.me is a private product surface: it is fully noindexed, and any
  // public page reachable there points its canonical at the public host.
  const canonicalSurface: Surface = surface === "app" ? "home" : surface;
  const url = canonicalUrlFor(canonicalSurface, canonical);
  const ogImage = resolveOgImage(canonical);
  const noindex = surface === "app" || isSurfaceNoIndex(surface, canonical);


  // index.html ships a full static SEO head so crawlers that never execute
  // JavaScript still read correct Gradr metadata. react-helmet-async only
  // dedupes tags it owns (marked with data-rh), so once the app has mounted
  // those static tags would sit alongside Helmet's per-route ones and give
  // crawlers two conflicting canonicals/descriptions. Drop the static copies.
  useEffect(() => {
    const STATIC_SEO_SELECTOR = [
      'link[rel="canonical"]',
      'meta[name="robots"]',
      'meta[name="description"]',
      'meta[name^="twitter:"]',
      'meta[property^="og:"]',
    ]
      .map((selector) => `${selector}:not([data-rh])`)
      .join(", ");
    document.head.querySelectorAll(STATIC_SEO_SELECTOR).forEach((node) => node.remove());
  }, []);



  const legalUpdated: Record<string, string> = {
    "/terms": POLICIES_UPDATED,
    "/privacy": POLICIES_UPDATED,
    "/refund-policy": POLICIES_UPDATED,
    "/cookie-policy": COOKIE_POLICY_EFFECTIVE,
    "/childrens-privacy": CHILDRENS_PRIVACY_EFFECTIVE,
    "/dpa": DPA_EFFECTIVE,
  };
  const legalLd = legalUpdated[pathname]
    ? legalJsonLd({
        path: pathname,
        name: meta.title,
        description: meta.description,
        lastUpdated: legalUpdated[pathname],
      })
    : null;
  const isArticle =
    pathname.startsWith("/career-advice/") ||
    pathname.startsWith("/blog/") ||
    (surface === "news" && pathname !== "/");
  return (
    <Helmet>
      <html lang="en" />
      <title>{fullTitle}</title>
      <meta name="description" content={meta.description} />
      <meta
        name="robots"
        content={
          noindex
            ? "noindex, nofollow"
            : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        }
      />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={isArticle ? "article" : "website"} />

      <meta property="og:site_name" content={SITE} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={ogImage} />
      {legalLd?.map((node, i) => (
        <script key={`legal-ld-${i}`} type="application/ld+json">
          {JSON.stringify(node)}
        </script>
      ))}
    </Helmet>
  );
}

