import { appSignupHref } from "@/lib/appLinks";
import { useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { SurfaceShell } from "@/components/surface/SurfaceShell";
import { CrossLink, SLink, SurfaceNotFound } from "@/components/surface/SurfaceLink";
import { NEWS, NEWS_BY_SLUG, NEWS_CATEGORIES, type NewsCategory } from "@/content/news";
import { cn } from "@/lib/utils";
import { ArrowRight, Clock } from "lucide-react";

const byNewest = [...NEWS].sort((a, b) => (a.published < b.published ? 1 : -1));

function NewsIndex() {
  const [filter, setFilter] = useState<NewsCategory | "All">("All");
  const items = filter === "All" ? byNewest : byNewest.filter((n) => n.category === filter);
  const [lead, ...rest] = items;

  return (
    <div className="page-shell py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
          Gradr News
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          Product updates, company news and job-market analysis
        </h1>
        <p className="mt-3 text-muted-foreground">
          What we are shipping, what we are learning, and what is actually changing in hiring.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter articles">
        {(["All", ...NEWS_CATEGORIES] as const).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category as NewsCategory | "All")}
            aria-pressed={filter === category}
            className={cn(
              "h-9 rounded-full border px-4 text-sm transition-colors",
              filter === category
                ? "border-brand-secondary bg-brand-secondary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {lead && (
        <SLink
          to={`/${lead.slug}`}
          className="mt-8 block rounded-xl border border-border/60 bg-card p-6 elev-2 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
            {lead.category}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{lead.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lead.excerpt}</p>
          <p className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{lead.published}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {lead.readingMinutes} min read
            </span>
          </p>
        </SLink>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((item) => (
          <SLink
            key={item.slug}
            to={`/${item.slug}`}
            className="flex flex-col rounded-xl border border-border/60 bg-card p-5 elev-1 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
              {item.category}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.excerpt}</p>
            <p className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{item.published}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {item.readingMinutes} min
              </span>
            </p>
          </SLink>
        ))}
      </div>

      {!items.length && (
        <p className="mt-10 text-sm text-muted-foreground">No articles in this category yet.</p>
      )}
    </div>
  );
}

function NewsArticleRoute() {
  const { slug = "" } = useParams();
  const article = NEWS_BY_SLUG[slug];
  if (!article) return <Navigate to="/" replace />;

  const related = byNewest.filter((n) => n.slug !== article.slug).slice(0, 3);

  return (
    <div className="page-shell py-12">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
          {article.category}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          {article.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{article.excerpt}</p>
        <p className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Published {article.published}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {article.readingMinutes} min read
          </span>
        </p>

        <div className="mt-10 space-y-8">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 space-y-1.5">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                      <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-secondary" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-border/60 bg-card p-6 elev-1">
          <h2 className="text-lg font-semibold text-foreground">Try it yourself</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Score your resume, match a live role and run a mock interview — free to start.
          </p>
          <a
            href={appSignupHref()}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </article>

      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-secondary">
          More from Gradr News
        </h2>
        <ul className="mt-4 space-y-3">
          {related.map((item) => (
            <li key={item.slug}>
              <SLink to={`/${item.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                {item.title}
              </SLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** news.gradr.me — public editorial surface. No app or admin routes. */
export default function NewsSurface() {
  return (
    <SurfaceShell
      eyebrow="News"
      nav={[
        { label: "Latest", to: "/" },
        { label: "Product", to: "/ai-mock-interview-voice-upgrade" },
        { label: "Job market", to: "/graduate-hiring-outlook-2026" },
      ]}
    >
      <Routes>
        <Route path="" element={<NewsIndex />} />
        <Route path=":slug" element={<NewsArticleRoute />} />
        <Route path="*" element={<SurfaceNotFound label="Gradr News" />} />
      </Routes>
    </SurfaceShell>
  );
}
