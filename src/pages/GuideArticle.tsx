import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { appProductHref, isProductPath } from "@/lib/appLinks";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { FaqBlock } from "@/components/seo/FaqBlock";
import { RelatedGuides } from "@/components/seo/RelatedGuides";
import { GUIDES_BY_SLUG, guidePath } from "@/content/guides";
import { guideJsonLd } from "@/lib/structuredData";
import { trackEvent, withUtm } from "@/lib/analytics";
import { useReadTracking } from "@/hooks/useReadTracking";
import NotFound from "@/pages/NotFound";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";
import { TiltCard, DimensionalText, Glass3D } from "@/components/three-d";

export default function GuideArticle() {
  const { slug = "" } = useParams();
  const guide = GUIDES_BY_SLUG[slug];

  useEffect(() => {
    if (guide) trackEvent("content_page_view", { article: guide.slug, location: guidePath(guide.slug) });
  }, [guide]);

  useReadTracking(guide?.slug ?? "");

  // Unknown slug is a genuine miss: render the 404 experience instead of a
  // silent redirect that would hide a broken link from users and crawlers.
  if (!guide) return <NotFound />;

  const ctaHref = withUtm(guide.cta.href, {
    source: "career-advice",
    medium: "guide",
    campaign: guide.slug,
    content: "primary-cta",
  });

  return (
    <PublicShell source={guide.slug}>
      <JsonLd nodes={guideJsonLd(guide)} label={guide.slug} />

      <article className="space-y-10">
        <nav aria-label="Breadcrumb">
          <Link
            to="/career-advice"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Career advice
          </Link>
        </nav>

        <MarketingHero
          eyebrow={guide.category}
          title={guide.title}
          description={guide.intro}
          actions={
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {guide.readMinutes} min read
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Updated{" "}
                {new Date(guide.updated).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          }
        />

        <Reveal>
          <Glass3D shadow="sm" className="rounded-2xl p-4">
            <nav aria-label="On this page">
            <p className="type-overline text-muted-foreground">On this page</p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {guide.sections.map((section, i) => (
                <li key={section.heading}>
                  <a href={`#section-${i}`} className="text-muted-foreground transition-colors hover:text-primary">
                    {section.heading}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq-heading" className="text-muted-foreground transition-colors hover:text-primary">
                  Frequently asked questions
                </a>
              </li>
            </ol>
            </nav>
          </Glass3D>
        </Reveal>

        <div className="space-y-8">
          {guide.sections.map((section, i) => (
            <Reveal key={section.heading} delay={i * 40}>
              <section id={`section-${i}`} className="space-y-3 scroll-mt-20">
                <DimensionalText as="h2" depth="subtle" className="type-h2">{section.heading}</DimensionalText>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-body leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 pl-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="list-disc text-body leading-relaxed text-muted-foreground">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <TiltCard maxTilt={4} shadow="lg" glass className="rounded-3xl border border-primary/25 p-6 sm:p-8">
            <section className="relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  background:
                    "radial-gradient(40rem 20rem at 50% -20%, hsl(var(--primary) / 0.12), transparent 70%)",
                }}
              />
              <div className="relative">
                <DimensionalText as="h2" depth="subtle" className="type-h2">{guide.cta.label}</DimensionalText>
                <p className="mt-1 text-body-sm text-muted-foreground">{guide.cta.blurb}</p>
                {/* Guide CTAs that point at a product engine must leave this
                    marketing bundle for app.gradr.me, not hit the redirect handler. */}
                <CtaLink
                  href={ctaHref}
                  product={isProductPath(guide.cta.href)}
                  onClick={() =>
                    trackEvent("guide_cta_click", {
                      article: guide.slug,
                      location: "inline-cta",
                      destination: guide.cta.href,
                    })
                  }
                  className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground btn-glow"
                >
                  {guide.cta.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CtaLink>
              </div>
            </section>
          </TiltCard>
        </Reveal>

        <FaqBlock items={guide.faqs} source={guide.slug} />

        <RelatedGuides slugs={guide.related} source={guide.slug} />
      </article>
    </PublicShell>
  );
}

/** Renders a router link for marketing paths and a real anchor for product URLs. */
function CtaLink({
  href,
  product,
  children,
  ...props
}: { href: string; product: boolean } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (product) {
    return (
      <a href={appProductHref(href)} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}
