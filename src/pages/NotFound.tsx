import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Home, LifeBuoy, Search } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle, Text } from "@/design-system/gradr-9b9b95";
import { PublicShell } from "@/components/PublicShell";
import { Seo } from "@/components/Seo";
import { appHref, appLoginHref } from "@/lib/appLinks";

/** Public marketing destinations we can confidently recommend after a miss. */
const SUGGESTIONS = [
  {
    to: "/ats-resume-checker",
    title: "ATS resume checker",
    description: "Score your resume against the filters recruiters actually run.",
  },
  {
    to: "/ai-interview-coach",
    title: "AI interview coach",
    description: "Practise live mock interviews and get an instant scorecard.",
  },
  {
    to: "/job-search",
    title: "Job search",
    description: "Real openings matched to your profile, refreshed daily.",
  },
  {
    to: "/career-advice",
    title: "Career advice",
    description: "Guides on resumes, applications and interview prep.",
  },
];

/**
 * Branded 404. Suggests the closest public page by simple token overlap so a
 * mistyped or retired URL still lands somewhere useful.
 */
const NotFound = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    console.warn("404: no route for", pathname);
  }, [pathname]);

  const closest = useMemo(() => {
    const tokens = pathname.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.length === 0) return null;
    let best: { to: string; title: string; score: number } | null = null;
    for (const item of SUGGESTIONS) {
      const target = `${item.to} ${item.title}`.toLowerCase();
      const score = tokens.filter((t) => t.length > 2 && target.includes(t)).length;
      if (score > 0 && (!best || score > best.score)) {
        best = { to: item.to, title: item.title, score };
      }
    }
    return best;
  }, [pathname]);

  return (
    <PublicShell source="not-found">
      <Seo
        title="Page not found"
        description="This Gradr page doesn't exist. Jump back to the homepage or explore our resume, interview and job search tools."
        path="/404"
        noindex
      />

      <section className="page-shell py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline">Error 404</Badge>
          <Text as="h1" variant="h1" className="mt-6">
            We couldn&apos;t find that page
          </Text>
          <Text variant="lead" className="mx-auto mt-4 max-w-xl text-muted-foreground">
            The link may be broken, or the page moved when we split the Gradr product onto its own
            app subdomain.
          </Text>

          <Text variant="body-sm" className="mt-6 text-muted-foreground">
            Requested path
          </Text>
          <Text variant="code" className="mt-1 block break-all text-foreground">
            {pathname}
          </Text>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to="/">
                <Home aria-hidden="true" />
                Back to homepage
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <a href={appLoginHref()}>
                Open the app
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href={appHref("/support")}>
                <LifeBuoy aria-hidden="true" />
                Get help
              </a>
            </Button>
          </div>

          {closest ? (
            <Text variant="body-sm" className="mt-6 text-muted-foreground">
              <Search aria-hidden="true" className="mr-2 inline size-4" />
              Did you mean{" "}
              <Link to={closest.to} className="text-primary underline underline-offset-4">
                {closest.title}
              </Link>
              ?
            </Text>
          ) : null}
        </div>

        <div className="mt-16">
          <Text variant="overline" className="flex items-center justify-center gap-2 text-muted-foreground">
            <Compass aria-hidden="true" className="size-4" />
            Popular pages
          </Text>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SUGGESTIONS.map((item) => (
              <Card key={item.to} asChild interactive>
                <Link to={item.to}>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
};

export default NotFound;
