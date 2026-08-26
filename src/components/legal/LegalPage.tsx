import { PublicShell } from "@/components/PublicShell";
import { LEGAL_PAGES } from "@/content/legal";
import { legalEffectiveDate } from "@/content/legalRegistry";
import { Link, useLocation } from "react-router-dom";

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
        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="text-muted-foreground">{intro}</p>
          <p className="text-xs text-muted-foreground">Last updated {lastUpdated || legalEffectiveDate(pathname)}</p>
          <nav aria-label="Policies" className="flex flex-wrap gap-3 pt-1 text-sm">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.path}
                to={page.path}
                aria-current={pathname === page.path ? "page" : undefined}
                className={
                  pathname === page.path
                    ? "rounded-md bg-primary/10 px-3 py-1 font-medium text-primary"
                    : "rounded-md px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
          {children}
        </div>
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
