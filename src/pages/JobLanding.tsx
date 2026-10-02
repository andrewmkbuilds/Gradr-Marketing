import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Wifi } from "lucide-react";
import { Badge, Text } from "@/design-system/gradr-9b9b95";
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
import { appSignupHref } from "@/lib/appLinks";
import { useReadTracking } from "@/hooks/useReadTracking";
import NotFound from "@/pages/NotFound";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

export default function JobLanding() {
  const { slug = "" } = useParams();
  const landing = JOB_LANDINGS_BY_SLUG[slug];

  useEffect(() => {
    if (landing)
      trackEvent("content_page_view", { article: landing.slug, location: jobLandingPath(landing.slug) });
  }, [landing]);

  useReadTracking(landing?.slug ?? "");

  // Unknown slug is a genuine miss: render the 404 experience instead of a
  // silent redirect that would hide a broken link from users and crawlers.
  if (!landing) return <NotFound />;

  const { role, location } = landing;
  const faqs = jobLandingFaqs(landing);
  const siblings = JOB_LANDINGS.filter(
    (l) => l.role.id === role.id && l.slug !== landing.slug,
  ).slice(0, 4);

  const ctaHref = withUtm(appSignupHref("/match"), {
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
            <a
              href={ctaHref}
              onClick={() =>
                trackEvent("job_landing_cta_click", {
                  article: landing.slug,
                  location: "hero",
                  destination: "/auth",
                })
              }
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "btn-glow")}
            >
              Match my resume to these roles
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          }
        />

        <Reveal>
          <section className="space-y-3">
            <Text variant="h2">
              Skills employers look for in {role.plural}
            </Text>
            <div className="flex flex-wrap gap-2">
              {role.skills.map((skill) => (
                <span key={skill} className="badge-premium">
                  {skill}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground">
              Treat this as a starting checklist, not a requirement list. Read three or four live
              postings for the exact title you want and keep the terms that repeat — those are the ones
              worth mirroring in your resume.
            </p>
          </section>
        </Reveal>

        <Reveal delay={60}>
          <section className="space-y-3">
            <Text variant="h2">
              What the role involves day to day
            </Text>
            <ul className="space-y-2">
              {role.responsibilities.map((item) => (
                <li key={item} className="flex gap-2.5 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal delay={120}>
          <section className="space-y-3">
            <Text variant="h2">
              Searching {location.remote ? "remote roles" : `in ${location.name}`}
            </Text>
            <p className="text-muted-foreground">{location.blurb}</p>
            <p className="text-muted-foreground">
              Gradr pulls live listings that fit your profile, scores each one against your resume, and
              shows the gaps to close before you apply — so you spend your effort on the applications
              where you are genuinely competitive.
            </p>
          </section>
        </Reveal>

        <FaqBlock items={faqs} source={landing.slug} />

        <RelatedGuides slugs={role.guides} source={landing.slug} title="Guides for this role" />

        {siblings.length > 0 && (
          <section className="space-y-3" aria-labelledby="other-locations">
            <Text id="other-locations" variant="h2">
              {role.name} jobs elsewhere
            </Text>
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
                  className="border-gradient-hover rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
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
