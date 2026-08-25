import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
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

export default function GuideArticle() {
  const { slug = "" } = useParams();
  const guide = GUIDES_BY_SLUG[slug];

  useEffect(() => {
    if (guide) trackEvent("content_page_view", { article: guide.slug, location: guidePath(guide.slug) });
  }, [guide]);

  useReadTracking(guide?.slug ?? "");

  if (!guide) return <Navigate to="/career-advice" replace />;

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

        <nav aria-label="On this page" className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">On this page</p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {guide.sections.map((section, i) => (
              <li key={section.heading}>
                <a href={`#section-${i}`} className="text-muted-foreground hover:text-primary">
                  {section.heading}
                </a>
              </li>
            ))}
            <li>
              <a href="#faq-heading" className="text-muted-foreground hover:text-primary">
                Frequently asked questions
              </a>
            </li>
          </ol>
        </nav>

        <div className="space-y-8">
          {guide.sections.map((section, i) => (
            <section key={section.heading} id={`section-${i}`} className="space-y-3 scroll-mt-20">
              <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="list-disc leading-relaxed text-muted-foreground">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section className="rounded-xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">{guide.cta.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{guide.cta.blurb}</p>
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
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {guide.cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CtaLink>
        </section>

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
