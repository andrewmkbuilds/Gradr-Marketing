import { PublicShell } from "@/components/PublicShell";
import { LEGAL_PAGES } from "@/content/legal";
import { legalEffectiveDate } from "@/content/legalRegistry";
import { Link, useLocation } from "react-router-dom";
import { Reveal } from "@/components/landing/Reveal";

interface LegalPageProps {
  title: string;
  intro: string;
  /** Overrides the shared policy date (versioned documents pass their effective date). */
  lastUpdated?: string;
  children: React.ReactNode;
}

/** Shared layout for the publicly accessible policy pages Paddle reviews. */
export function LegalPage({ title, intro, lastUpdated, children }: LegalPageProps) {
  const { pathname } = useLocation();
  return (
    <PublicShell source={`legal:${pathname}`}>
      <article className="mx-auto max-w-5xl">
        <Reveal>
          <header className="mb-8 space-y-3">
            <p className="section-eyebrow">Legal</p>
            <h1 className="type-section text-balance">{title}</h1>
            <p className="text-body text-muted-foreground">{intro}</p>
            <p className="type-caption text-muted-foreground">Last updated {lastUpdated || legalEffectiveDate(pathname)}</p>
            <nav aria-label="Policies" className="flex flex-wrap gap-2 pt-2 text-sm">
              {LEGAL_PAGES.map((page) => (
                <Link
                  key={page.path}
                  to={page.path}
                  aria-current={pathname === page.path ? "page" : undefined}
                  className={
                    pathname === page.path
                      ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary"
                      : "rounded-full border border-border px-3 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  }
                >
                  {page.label}
                </Link>
              ))}
            </nav>
          </header>
        </Reveal>
        <Reveal delay={60}>
          <div className="space-y-8 text-body-sm leading-relaxed text-muted-foreground [&_h2]:type-h2 [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
            {children}
          </div>
        </Reveal>
      </article>
    </PublicShell>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2>{heading}</h2>
      {children}
    </section>
  );
}
