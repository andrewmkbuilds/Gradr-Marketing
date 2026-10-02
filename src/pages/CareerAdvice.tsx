import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { FaqBlock } from "@/components/seo/FaqBlock";
import { GUIDES, guidePath } from "@/content/guides";
import { Input } from "@/design-system/gradr-9b9b95";
import { trackEvent } from "@/lib/analytics";
import {
  buildBreadcrumbLd,
  buildCollectionPageLd,
  buildFaqLd,
  buildItemListLd,
} from "@/lib/structuredData";
import { Reveal } from "@/components/landing/Reveal";
import { motion } from "motion/react";
import { easeOut } from "@/lib/motion/tokens";

const INDEX_FAQS = [
  {
    question: "What does the Gradr career advice section cover?",
    answer:
      "Practical guides for the three moments that decide most job searches: optimizing your resume so it parses and persuades, writing a cover letter that adds information, and preparing answers for the interview questions that come up in nearly every process.",
  },
  {
    question: "Are these guides useful for career changers?",
    answer:
      "Yes. Each guide calls out how to handle transferable experience, gaps, and switching field, because those situations need a different emphasis rather than a different structure.",
  },
  {
    question: "Do I need a Gradr account to read the guides?",
    answer:
      "No. Every guide is free and public. An account is only needed for the tools that act on your own documents, such as resume scoring, tailored applications, and AI mock interviews.",
  },
];

export default function CareerAdvice() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    trackEvent("content_page_view", { article: "career-advice-index", location: "/career-advice" });
  }, []);

  // Debounced tracking of what readers search the guide index for.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(() => {
      trackEvent("guide_filter_search", {
        source: "career-advice-index",
        location: q.toLowerCase().slice(0, 60),
      });
    }, 900);
    return () => clearTimeout(t);
  }, [query]);


  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDES;
    return GUIDES.filter((g) =>
      [g.title, g.description, g.keyword, g.category].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  const jsonLd = [
    buildCollectionPageLd({
      path: "/career-advice",
      name: "Career advice",
      description:
        "Free, practical career guides on resume optimization, cover letters, and interview preparation.",
    }),
    buildItemListLd({
      name: "Career advice guides",
      items: GUIDES.map((g) => ({ name: g.title, path: guidePath(g.slug) })),
    }),
    buildFaqLd(INDEX_FAQS),
    buildBreadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Career advice", path: "/career-advice" },
    ]),
  ];

  return (
    <PublicShell source="career-advice-index">
      <JsonLd nodes={jsonLd} label="career-advice-index" />

      <div className="space-y-10">
        <MarketingHero
          eyebrow="Career advice"
          title="Guides for resumes, cover letters, and interviews"
          description="Straightforward, evidence-first advice for the three points where most applications are won or lost. No filler, no invented statistics."
        />

        {/* Premium search bar */}
        <Reveal>
          <div className="card-conic relative max-w-md rounded-2xl p-1.5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides"
              aria-label="Search career advice guides"
              className="h-11 border-0 bg-transparent pl-10 focus-visible:ring-0"
            />
          </div>
        </Reveal>

        {/* Guide cards grid */}
        <section aria-label="Guides" className="grid gap-4 sm:grid-cols-2">
          {results.map((guide, i) => (
            <Reveal key={guide.slug} delay={i * 50}>
              <Link
                to={guidePath(guide.slug)}
                onClick={() =>
                  trackEvent("guide_card_click", {
                    source: "career-advice-index",
                    destination: guidePath(guide.slug),
                    article: guide.slug,
                  })
                }
                className="border-gradient-hover group block h-full rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {guide.category} · {guide.readMinutes} min read
                  </p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-foreground">{guide.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read guide
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
                <h2 className="font-display text-lg font-semibold text-foreground">No guides found</h2>
                <p className="mt-2 text-sm text-muted-foreground">No guides match “{query}”.</p>
                <button
                  onClick={() => setQuery("")}
                  className="mt-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </section>

        <FaqBlock items={INDEX_FAQS} source="career-advice-index" />

        {/* Free tools section */}
        <Reveal>
          <section className="cta-glow rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="icon-premium">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold text-foreground">Free tools that do the work</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Guides tell you what to change. These run it on your own documents and applications.
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      to: "/job-application-tracker",
                      label: "Job application tracker",
                      note: "One AI pipeline for every role, follow-up and interview",
                    },
                    {
                      to: "/ats-resume-checker",
                      label: "ATS resume checker",
                      note: "Score your resume against any job description",
                    },
                    {
                      to: "/ai-interview-coach",
                      label: "AI interview coach",
                      note: "Voice mock interviews with scored feedback",
                    },
                  ].map((tool) => (
                    <li key={tool.to}>
                      <Link
                        to={tool.to}
                        onClick={() =>
                          trackEvent("tool_card_click", {
                            source: "career-advice-index",
                            destination: tool.to,
                          })
                        }
                        className="group block h-full rounded-xl border border-border/70 p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
                      >
                        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                          {tool.label}
                          <ArrowRight
                            className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">{tool.note}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Job search CTA */}
        <Reveal>
          <section className="card-conic rounded-2xl p-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Looking for roles instead?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse job search pages by role, location, and remote preference.
            </p>
            <Link
              to="/job-search"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Explore job search pages
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>
        </Reveal>

      </div>
    </PublicShell>
  );
}
