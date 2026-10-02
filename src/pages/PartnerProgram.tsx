import { DollarSign, Users, TrendingUp, Clock, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { useAffiliateSettings } from "@/hooks/useAffiliate";
import { Card, Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { PARTNER_PATHS, partnersHref } from "@/lib/partnerLinks";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

/**
 * Public pitch page for the Gradr Partner Program.
 *
 * Marketing owns the pitch only. Applications, approval, referral links,
 * conversions, commissions, payouts, analytics and resources are the partner
 * portal's job (partners.gradr.me) — every action below leaves this origin.
 * Commission terms are read from the backend so the rate is never hard-coded
 * in UI code.
 */
export default function PartnerProgram() {
  const { data: settings } = useAffiliateSettings();

  const rate = settings?.default_commission_rate ?? 20;
  const rateType = settings?.default_commission_type ?? "percentage";
  const cookieDays = settings?.cookie_duration_days ?? 90;
  const rateLabel = rateType === "percentage" ? `${rate}%` : `$${rate}`;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Reveal>
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3 py-1.5 text-caption text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" aria-hidden /> Gradr Partner Program
          </div>
          <Text variant="h1" as="h1" className="text-balance">
            Earn {rateLabel} recurring commission for every customer you refer
          </Text>
          <Text variant="lead" className="mx-auto max-w-2xl">
            Share Gradr with your audience and earn recurring commission on every subscription —
            backed by a {cookieDays}-day attribution window, so you get credit for the full buying
            journey.
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <a href={partnersHref(PARTNER_PATHS.apply)} className={cn(buttonVariants({ size: "lg" }), "btn-glow")}>
              Apply to the Partner Program <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={partnersHref(PARTNER_PATHS.login)}
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Partner sign in
            </a>
          </div>
          <Text variant="caption" className="mx-auto max-w-xl">
            Applications are reviewed manually. Once approved, you manage referral links, conversions,
            commissions and payouts in the partner portal at partners.gradr.me.
          </Text>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: DollarSign,
            title: `${rateLabel} recurring`,
            desc: "Earn on every recurring payment, not just the first one.",
          },
          {
            icon: Clock,
            title: `${cookieDays}-day attribution`,
            desc: "A generous attribution window — full credit for the journey.",
          },
          {
            icon: Users,
            title: "Audience aligned",
            desc: "Built for career creators, coaches, bootcamps and communities.",
          },
        ].map((b, i) => (
          <Reveal key={b.title} delay={i * 60}>
            <Card variant="raised" padding="lg" className="card-glow h-full">
              <b.icon className="mb-3 h-5 w-5 text-primary" aria-hidden />
              <Text variant="h6" as="h2">
                {b.title}
              </Text>
              <Text variant="caption" className="mt-1">
                {b.desc}
              </Text>
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal delay={80}>
        <Card variant="raised" padding="lg" className="card-glow">
          <Text variant="h5" as="h2" className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> How it works
          </Text>
          <ol className="space-y-3 text-body-sm">
            {[
              "Apply with your audience details and promotion plan — every application is reviewed manually.",
              "Once approved, the partner portal issues your referral link and tracks clicks and conversions.",
              `Share your link — referrals are attributed for ${cookieDays} days.`,
              "Referred customers sign up and subscribe on app.gradr.me; commission is calculated from the verified payment.",
              "Track pending, approved, paid and reversed commission — and request payouts — in the partner portal.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </Reveal>

      <Reveal delay={120}>
        <Card variant="raised" padding="lg" className="card-glow">
          <Text variant="h5" as="h2" className="mb-3">
            Terms summary
          </Text>
          <ul className="space-y-2 text-body-sm text-muted-foreground">
            {[
              "No self-referrals or incentivised fake signups.",
              "No paid search on Gradr branded keywords.",
              "Commission is reversed on refunds and chargebacks.",
              "Partner commission is paid in cash and is separate from Gradr Earn credits.",
              "Gradr may suspend partner status for policy violations at any time.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          {settings?.affiliate_terms && (
            <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-caption text-muted-foreground">
              {settings.affiliate_terms}
            </p>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
