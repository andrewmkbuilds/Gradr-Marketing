import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Search, Wifi, Sparkles } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { FaqBlock } from "@/components/seo/FaqBlock";
import { Button, Input, Text } from "@/design-system/gradr-9b9b95";
import {
  JOB_LANDINGS,
  JOB_LOCATIONS,
  JOB_ROLES,
  jobLandingPath,
} from "@/content/jobLandings";
import { trackEvent } from "@/lib/analytics";
import {
  buildBreadcrumbLd,
  buildCollectionPageLd,
  buildFaqLd,
  buildItemListLd,
} from "@/lib/structuredData";
import { Reveal } from "@/components/landing/Reveal";
import { motion } from "motion/react";
import { easeOut, viewportOnce } from "@/lib/motion/tokens";

const INDEX_FAQS = [
  {
    question: "How do I search for jobs by role and location?",
    answer:
      "Pick a role, then filter by location or switch on remote-only. Each combination has its own page with the skills that recur in those postings, how to tailor an application for them, and answers to the questions candidates ask most.",
  },
  {
    question: "Does Gradr find the jobs for me?",
    answer:
      "Once you create an account, Gradr pulls live listings that match your profile and scores each one against your resume so you can see where you are competitive before you apply.",
  },
  {
    question: "Is remote work available for every role?",
    answer:
      "No. Remote availability varies by role and by employer, and many remote postings restrict hiring to specific countries or time zones. Always check the location requirements in the posting itself.",
  },
];

export default function JobSearchIndex() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>("all");
  const [remoteOnly, setRemoteOnly] = useState(false);

  useEffect(() => {
    trackEvent("content_page_view", { article: "job-search-index", location: "/job-search" });
  }, []);

  // Debounced search-term tracking so we learn which roles/cities people look
  // for that we do not have a page for yet.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(() => {
      trackEvent("job_filter_search", { source: "job-search-index", location: q.toLowerCase().slice(0, 60) });
    }, 900);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return JOB_LANDINGS.filter((landing) => {
      if (remoteOnly && !landing.location.remote) return false;
      if (role !== "all" && landing.role.id !== role) return false;
      if (!q) return true;
      return [landing.title, landing.role.name, landing.location.name, ...landing.role.skills]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, role, remoteOnly]);

  const jsonLd = [
    buildCollectionPageLd({
      path: "/job-search",
      name: "Job search by role, location, and remote",
      description:
        "Browse job search pages by role, city, and remote preference, with the skills each role asks for and how to tailor your application.",
    }),
    buildItemListLd({
      name: "Job search pages",
      items: JOB_LANDINGS.map((l) => ({ name: l.title, path: jobLandingPath(l.slug) })),
    }),
    buildFaqLd(INDEX_FAQS),
    buildBreadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Job search", path: "/job-search" },
    ]),
  ];

  return (
    <PublicShell source="job-search-index">
      <JsonLd nodes={jsonLd} label="job-search-index" />

      <div className="space-y-10">
        <MarketingHero
          eyebrow="Job search"
          title="Find jobs by role, location, and remote preference"
          description="Start from the role you want. Each page covers the skills that recur in those postings, how to tailor a resume for them, and what to prepare for the interview."
        />

        {/* Premium filter section */}
        <Reveal>
          <section aria-label="Filters" className="card-conic space-y-4 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <span className="icon-premium h-9 w-9 rounded-lg">
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search role, city, or skill"
                aria-label="Search job pages by role, city, or skill"
                className="flex-1"
              />
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by role">
              <Button
                size="sm"
                variant={role === "all" ? "primary" : "outline"}
                aria-pressed={role === "all"}
                onClick={() => setRole("all")}
              >
                All roles
              </Button>
              {JOB_ROLES.map((r) => (
                <Button
                  key={r.id}
                  size="sm"
                  variant={role === r.id ? "primary" : "outline"}
                  aria-pressed={role === r.id}
                  onClick={() => {
                    setRole(r.id);
                    trackEvent("job_filter_change", {
                      source: "job-search-index",
                      location: r.id,
                      filter: "role",
                    });
                  }}
                >
                  {r.name}
                </Button>
              ))}
            </div>

            <Button
              size="sm"
              variant={remoteOnly ? "primary" : "outline"}
              aria-pressed={remoteOnly}
              onClick={() => {
                setRemoteOnly((v) => !v);
                trackEvent("job_filter_change", {
                  source: "job-search-index",
                  location: "remote-toggle",
                  filter: "remote",
                  value: String(!remoteOnly),
                });
              }}
              className="gap-1.5"
            >
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
              Remote only
            </Button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: easeOut }}
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              <span className="font-semibold text-foreground">{results.length}</span> page{results.length === 1 ? "" : "s"} match your filters
            </motion.p>
          </section>
        </Reveal>

        {/* Job cards grid */}
        <section aria-label="Job search pages" className="grid gap-3 sm:grid-cols-2">
          {results.map((landing, i) => (
            <Reveal key={landing.slug} delay={i * 40}>
              <Link
                to={jobLandingPath(landing.slug)}
                onClick={() =>
                  trackEvent("job_landing_click", {
                    source: "job-search-index",
                    destination: jobLandingPath(landing.slug),
                    article: landing.slug,
                  })
                }
                className="border-gradient-hover group block h-full rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {landing.location.remote ? (
                      <Wifi className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    )}
                    {landing.location.name}
                  </p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <Text variant="h6" as="h2">{landing.title}</Text>
                </div>

                {/* Skills preview */}
                {landing.role.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {landing.role.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="badge-premium"
                      >
                        {skill}
                      </span>
                    ))}
                    {landing.role.skills.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{landing.role.skills.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  View page
                </span>
              </Link>
            </Reveal>
          ))}
          {results.length === 0 && (
            <div className="col-span-full">
              <div className="cta-glow rounded-2xl border border-border bg-card p-8 text-center">
                <div className="icon-premium mx-auto mb-4 h-12 w-12 rounded-xl">
                  <Search className="h-6 w-6" aria-hidden="true" />
                </div>
                <Text variant="h5" as="h3">No matches yet</Text>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nothing matches those filters yet. Clear the search to see every role.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setQuery(""); setRole("all"); setRemoteOnly(false); }}
                >
                  Clear all filters
                </Button>
              </div>
            </div>
          )}
        </section>

        <FaqBlock items={INDEX_FAQS} source="job-search-index" />

        <Reveal>
          <section className="cta-glow rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="icon-premium">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <Text variant="h5" as="h2">Not sure how to present your experience?</Text>
                <p className="mt-1 text-sm text-muted-foreground">
                  Read the resume, cover letter, and interview guides before you apply.
                </p>
                <Link
                  to="/career-advice"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  Browse career advice
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </PublicShell>
  );
}
