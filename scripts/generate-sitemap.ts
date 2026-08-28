// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { GUIDES, guidePath } from "../src/content/guides";
import { JOB_LANDINGS, jobLandingPath } from "../src/content/jobLandings";
import { DOCS } from "../src/content/docs";
import { NEWS } from "../src/content/news";
import { PRODUCTION_ORIGIN } from "../src/config/domains";
import { LEGAL_LAST_UPDATED, LEGAL_REGISTRY, legalEffectiveDate } from "../src/content/legalRegistry";

const BASE_URL = "https://gradr.me";

interface SitemapEntry {
  path: string;
  /** Only set from a page-specific content timestamp — never build time. */
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Only publicly reachable, indexable marketing/content pages belong here.
// Authenticated product surfaces and credential flows are noindexed in
// RouteSeo and disallowed in robots.txt, so listing them would only send
// crawlers to a sign-in wall.
const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/ats-resume-checker", changefreq: "monthly", priority: "0.9" },
  { path: "/ai-interview-coach", changefreq: "monthly", priority: "0.9" },
  { path: "/ai-cover-letter-generator", changefreq: "monthly", priority: "0.9" },
  { path: "/job-application-tracker", changefreq: "monthly", priority: "0.9" },
  { path: "/blog/ai-resume-optimization", changefreq: "monthly", priority: "0.8" },
  { path: "/career-advice", changefreq: "weekly", priority: "0.9" },
  { path: "/job-search", changefreq: "weekly", priority: "0.9" },
  { path: "/legal", lastmod: LEGAL_LAST_UPDATED, changefreq: "yearly", priority: "0.5" },
  // Policy pages — lastmod comes from each policy's own effective date.
  ...LEGAL_REGISTRY.map((page) => ({
    path: page.path,
    lastmod: legalEffectiveDate(page.path),
    changefreq: "yearly" as const,
    priority: "0.4",
  })),

  // Career advice guides — lastmod comes from each guide's own `updated` date.
  ...GUIDES.map((guide) => ({
    path: guidePath(guide.slug),
    lastmod: guide.updated,
    changefreq: "monthly" as const,
    priority: "0.8",
  })),
  // Role x location job search pages.
  ...JOB_LANDINGS.map((landing) => ({
    path: jobLandingPath(landing.slug),
    changefreq: "weekly" as const,
    priority: "0.7",
  })),
  // Excluded intentionally (auth-gated, credential flows, or internal tools):
  // /auth, /forgot-password, /reset-password, /verify-email, /welcome
  // /resume, /jobs, /match, /pipeline, /apply, /interview, /growth
  // /settings, /billing, /admin/*
  // /pricing is excluded too: on the marketing surface it only redirects to
  // app.gradr.me/pricing, and sitemaps must list indexable URLs, not redirects.
];



function generateSitemap(items: SitemapEntry[], origin: string = BASE_URL) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${origin}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);

/**
 * Per-subdomain sitemaps. Every Gradr surface is its own SEO property, so each
 * gets a sitemap whose <loc> values live on that surface's own origin.
 * app.gradr.me is intentionally absent: it is a private product surface.
 */
const marketingEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/features", changefreq: "monthly", priority: "0.9" },
  { path: "/use-cases", changefreq: "monthly", priority: "0.8" },
  { path: "/testimonials", changefreq: "monthly", priority: "0.6" },
  { path: "/demos", changefreq: "monthly", priority: "0.7" },
  { path: "/about", changefreq: "yearly", priority: "0.5" },
];

const newsEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "0.9" },
  ...NEWS.map((article) => ({
    path: `/${article.slug}`,
    lastmod: article.updated,
    changefreq: "monthly" as const,
    priority: "0.8",
  })),
];

const docsEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "0.9" },
  ...DOCS.map((doc) => ({
    path: `/${doc.slug}`,
    lastmod: doc.updated,
    changefreq: "monthly" as const,
    priority: "0.7",
  })),
];

// Only the public Partner Program pitch page is served here; applications and
// the portal itself live on partners.gradr.me and are not crawled from this site.
const partnerEntries: SitemapEntry[] = [
  { path: "/", changefreq: "monthly", priority: "0.7" },
];

// Status and support are small public surfaces — every page is crawlable.
const statusEntries: SitemapEntry[] = [{ path: "/", changefreq: "hourly", priority: "0.6" }];

const supportEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "0.8" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
];

const surfaceSitemaps: { file: string; origin: string; items: SitemapEntry[] }[] = [
  { file: "sitemap-marketing.xml", origin: PRODUCTION_ORIGIN.marketing, items: marketingEntries },
  { file: "sitemap-news.xml", origin: PRODUCTION_ORIGIN.news, items: newsEntries },
  { file: "sitemap-docs.xml", origin: PRODUCTION_ORIGIN.docs, items: docsEntries },
  { file: "sitemap-partners.xml", origin: PRODUCTION_ORIGIN.partners, items: partnerEntries },
  { file: "sitemap-status.xml", origin: PRODUCTION_ORIGIN.status, items: statusEntries },
  { file: "sitemap-support.xml", origin: PRODUCTION_ORIGIN.support, items: supportEntries },
];

for (const sitemap of surfaceSitemaps) {
  writeFileSync(resolve(`public/${sitemap.file}`), generateSitemap(sitemap.items, sitemap.origin));
  console.log(`${sitemap.file} written (${sitemap.items.length} entries)`);
}

// Sitemap index so one submission covers every Gradr surface.
const index = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...[
    `${BASE_URL}/sitemap.xml`,
    ...surfaceSitemaps.map((s) => `${s.origin}/${s.file}`),
  ].map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`),
  `</sitemapindex>`,
].join("\n");
writeFileSync(resolve("public/sitemap-index.xml"), index);
console.log("sitemap-index.xml written");
