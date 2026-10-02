import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
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

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides"
            aria-label="Search career advice guides"
            className="h-11 pl-10"
          />
        </div>

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
                className="card-glow group block h-full rounded-2xl p-5"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {guide.category} · {guide.readMinutes} min read
                </p>
                <h2 className="mt-2 font-display text-lg font-semibold text-foreground">{guide.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                  Read guide
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </Link>
            </Reveal>
          ))}
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground">No guides match “{query}”.</p>
          )}
        </section>

        <FaqBlock items={INDEX_FAQS} source="career-advice-index" />

        <Reveal>
          <section className="card-glow rounded-2xl p-6">
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
                    className="group block h-full rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/50"
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
          </section>
        </Reveal>

        <Reveal>
          <section className="card-glow rounded-2xl p-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Looking for roles instead?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse job search pages by role, location, and remote preference.
            </p>
            <Link
              to="/job-search"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
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
