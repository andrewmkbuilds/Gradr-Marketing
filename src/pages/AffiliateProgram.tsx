import { useNavigate } from "react-router-dom";
import { DollarSign, Users, TrendingUp, Clock, Sparkles, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { useMyAffiliate, useAffiliateSettings } from "@/hooks/useAffiliate";
import { Button, Card, Text } from "@/design-system/gradr-9b9b95";

export default function AffiliateProgram() {
  const navigate = useNavigate();
  const { data: my, isLoading } = useMyAffiliate();
  const { data: settings } = useAffiliateSettings();

  const rate = settings?.default_commission_rate ?? 20;
  const rateType = settings?.default_commission_type ?? "percentage";
  const cookieDays = settings?.cookie_duration_days ?? 90;

  const renderCta = () => {
    if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    if (my?.profile && my.profile.status === "active") {
      return (
        <Button size="lg" onClick={() => navigate("/affiliate/resources")}>
          Open partner resources <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      );
    }
    if (my?.application?.status === "pending") {
      return (
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-warning/10 text-warning font-medium border border-warning/20">
          <Clock className="h-4 w-4" /> Application under review
        </div>
      );
    }
    if (my?.application?.status === "rejected") {
      return (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
            Previous application was not approved
          </div>
          <Button size="lg" onClick={() => navigate("/affiliate/apply")}>Reapply</Button>
        </div>
      );
    }
    return (
      <Button size="lg" onClick={() => navigate("/affiliate/apply")}>
        Apply to become an affiliate <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles className="h-3 w-3" /> Gradr Partner Program
        </div>
        <Text variant="h2" as="h1">
          Earn {rateType === "percentage" ? `${rate}%` : `$${rate}`} for every paying customer you refer
        </Text>
        <Text variant="lead" className="mx-auto max-w-2xl">
          Share Gradr with your audience and earn recurring commissions on every subscription —
          backed by a {cookieDays}-day cookie window so you get credit for the full buying journey.
        </Text>
        <div className="pt-4">{renderCta()}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: DollarSign, title: `${rate}${rateType === "percentage" ? "%" : "$"} recurring`, desc: "Earn on every recurring payment, not just the first one." },
          { icon: Clock, title: `${cookieDays}-day cookie`, desc: "Industry-leading attribution window — full credit for the journey." },
          { icon: Users, title: "Audience aligned", desc: "Perfect for career creators, coaches, bootcamps, and communities." },
        ].map((b) => (
          <Card key={b.title} variant="raised" padding="lg" className="animate-fade-in">
            <b.icon className="mb-3 h-5 w-5 text-primary" aria-hidden />
            <Text variant="h6" as="h2">{b.title}</Text>
            <Text variant="caption" className="mt-1">{b.desc}</Text>
          </Card>
        ))}
      </div>

      <Card variant="raised" padding="lg" className="animate-fade-in">
        <Text variant="h5" as="h2" className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> How it works
        </Text>
        <ol className="space-y-3 text-sm">
          {[
            "Apply with your audience info and promo plan — most applications reviewed within 48 hours.",
            "Once approved, get a unique referral link (gradr.me/?ref=YOURCODE) with transparent click and conversion tracking.",
            `Share your link — every click is tracked and remembered for ${cookieDays} days.`,
            "Earn commissions when referred users sign up and upgrade, with monthly payouts once you clear the threshold.",
            "Get paid monthly once you cross the minimum payout threshold.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-muted-foreground pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card variant="raised" padding="lg" className="animate-fade-in">
        <Text variant="h5" as="h2" className="mb-3">Terms summary</Text>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "No self-referrals or incentivized fake signups.",
            "No paid search on Gradr branded keywords.",
            "Commissions are reversed on refunds or chargebacks.",
            "Gradr may revoke status for policy violations at any time.",
          ].map((t) => (
            <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {t}</li>
          ))}
        </ul>
        {settings?.affiliate_terms && (
          <p className="text-xs text-muted-foreground mt-4 whitespace-pre-line border-t border-border pt-4">
            {settings.affiliate_terms}
          </p>
        )}
      </Card>
    </div>
  );
}
