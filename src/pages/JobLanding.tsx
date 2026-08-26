import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Wifi } from "lucide-react";
import { Badge } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { PublicShell } from "@/components/PublicShell";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { FaqBlock } from "@/components/seo/FaqBlock";
import { RelatedGuides } from "@/components/seo/RelatedGuides";
import {
  JOB_LANDINGS,
  JOB_LANDINGS_BY_SLUG,
  jobLandingFaqs,
  jobLandingPath,
} from "@/content/jobLandings";
import { jobLandingJsonLd } from "@/lib/structuredData";
import { trackEvent, withUtm } from "@/lib/analytics";
import { useReadTracking } from "@/hooks/useReadTracking";

export default function JobLanding() {
  const { slug = "" } = useParams();
  const landing = JOB_LANDINGS_BY_SLUG[slug];

  useEffect(() => {
    if (landing)
      trackEvent("content_page_view", { article: landing.slug, location: jobLandingPath(landing.slug) });
  }, [landing]);

  useReadTracking(landing?.slug ?? "");

  if (!landing) return <Navigate to="/job-search" replace />;

  const { role, location } = landing;
  const faqs = jobLandingFaqs(landing);
  const siblings = JOB_LANDINGS.filter(
    (l) => l.role.id === role.id && l.slug !== landing.slug,
  ).slice(0, 4);

  const ctaHref = withUtm("/auth?mode=signup", {
    source: "job-search",
    medium: "landing",
    campaign: landing.slug,
    content: "primary-cta",
  });

  return (
    <PublicShell source={landing.slug}>
      <JsonLd nodes={jobLandingJsonLd(landing)} label={landing.slug} />

      <div className="space-y-10">
        <nav aria-label="Breadcrumb">
          <Link
            to="/job-search"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Job search
          </Link>
        </nav>

        <MarketingHero
          above={
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-secondary">
              {location.remote ? (
                <Wifi className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MapPin className="h-4 w-4" aria-hidden="true" />
              )}
              {location.name}
            </p>
          }
          title={landing.title}
          description={role.summary}
          actions={
            <Link
              to={ctaHref}
              onClick={() =>
                trackEvent("job_landing_cta_click", {
                  article: landing.slug,
                  location: "hero",
                  destination: "/auth",
                })
              }
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Match my resume to these roles
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        />

        <section className="space-y-3">
          <h2 className="type-h2 text-foreground">
            Skills employers look for in {role.plural}
          </h2>
          <div className="flex flex-wrap gap-2">
            {role.skills.map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground">
            Treat this as a starting checklist, not a requirement list. Read three or four live
            postings for the exact title you want and keep the terms that repeat — those are the ones
            worth mirroring in your resume.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="type-h2 text-foreground">
            What the role involves day to day
          </h2>
          <ul className="space-y-2">
            {role.responsibilities.map((item) => (
              <li key={item} className="flex gap-2.5 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="type-h2 text-foreground">
            Searching {location.remote ? "remote roles" : `in ${location.name}`}
          </h2>
          <p className="text-muted-foreground">{location.blurb}</p>
          <p className="text-muted-foreground">
            Gradr pulls live listings that fit your profile, scores each one against your resume, and
            shows the gaps to close before you apply — so you spend your effort on the applications
            where you are genuinely competitive.
          </p>
        </section>

        <FaqBlock items={faqs} source={landing.slug} />

        <RelatedGuides slugs={role.guides} source={landing.slug} title="Guides for this role" />

        {siblings.length > 0 && (
          <section className="space-y-3" aria-labelledby="other-locations">
            <h2 id="other-locations" className="type-h2 text-foreground">
              {role.name} jobs elsewhere
            </h2>
            <div className="flex flex-wrap gap-2">
              {siblings.map((sib) => (
                <Link
                  key={sib.slug}
                  to={jobLandingPath(sib.slug)}
                  onClick={() =>
                    trackEvent("job_landing_click", {
                      source: landing.slug,
                      destination: jobLandingPath(sib.slug),
                      article: sib.slug,
                    })
                  }
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {sib.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}
