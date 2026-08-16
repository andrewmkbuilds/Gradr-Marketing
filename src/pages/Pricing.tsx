import { Check, Sparkles, Rocket, Zap, Crown, Loader2, BadgePercent, ShieldCheck } from "lucide-react";
import { trackSignupCta, trackUpgradeCta } from "@/lib/telemetry/events";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SpatialCard } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBillingActions, useSubscription } from "@/hooks/useSubscription";
import { CREDIT_PACKS, FREE_TIER, TIERS, type Tier } from "@/config/tiers";
import {
  ANNUAL_SAVINGS_MESSAGE,
  annualListPrice,
  annualSavingsPercent,
  formatUsd,
  planAmount,
  planPriceLabel,
  type PlanId,
} from "@/config/pricing";
import { formatMinorAmount, previewPrices, type PreviewedPrice } from "@/lib/paddle";
import type { PlanKey } from "@/lib/billing";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PaymentsConfigBanner } from "@/components/PaymentsConfigBanner";
import { VerificationDialog } from "@/components/VerificationDialog";
import { useDiscountPrograms, useMyEligibility } from "@/hooks/useEligibility";

const TIER_ICONS: Record<string, typeof Sparkles> = {
  Starter: Zap,
  Pro: Rocket,
  Advanced: Crown,
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: currentPlan, billingInterval } = useSubscription();
  const { pending, startSubscription, buyPack } = useBillingActions();
  const [tab, setTab] = useState<"plans" | "packs">("plans");
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const [verifyOpen, setVerifyOpen] = useState(false);

  const { discountPercent } = useMyEligibility();
  const { data: programs } = useDiscountPrograms();
  const topProgram = programs?.[0];

  const [prices, setPrices] = useState<Record<string, PreviewedPrice>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [priceFailure, setPriceFailure] = useState<PriceLookupCode | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Localized prices come straight from Paddle — no client-side math, no
  // re-formatting of the strings Paddle returns.
  useEffect(() => {
    let cancelled = false;
    const ids = [
      ...TIERS.flatMap((t) => [t.priceId.month, t.priceId.year]),
      ...CREDIT_PACKS.map((p) => p.priceId),
    ];
    setPricesLoading(true);
    previewPrices(ids)
      .then((result) => {
        if (cancelled) return;
        setPrices(result);
        setPriceFailure(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setPriceFailure(err instanceof PriceLookupError ? err.code : "unavailable");
      })
      .finally(() => !cancelled && setPricesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /** Catalog is genuinely missing → checkout cannot start, so it is disabled. */
  const checkoutBlocked = priceFailure === "catalog_missing";
  const priceFor = (id: string) => prices[id]?.formattedTotal;

  const handleSelect = (tier: Tier | null) => {
    trackUpgradeCta({
      location: "pricing",
      text: tier ? `Choose ${tier.name}` : "Stay on Free",
      plan: tier?.key ?? "free",
      billingPeriod: interval,
    });
    if (!user) {
      // Signup is the required next step before checkout can start.
      trackSignupCta({
        location: "pricing",
        text: tier ? `Choose ${tier.name}` : "Stay on Free",
        authenticated: false,
        destination: "/auth?next=/pricing",
      });
      navigate("/auth?next=/pricing");
      return;
    }
    if (!tier) {
      toast.success("You're on the Free plan!");
      return;
    }
    void startSubscription(interval, tier.key as PlanKey);
  };

  const handlePack = (key: string) => {
    trackUpgradeCta({ location: "pricing", text: "Buy pack", plan: "credit_pack", feature: key });
    if (!user) {
      navigate("/auth?next=/pricing");
      return;
    }
    void buyPack(key);
  };

  /**
   * List price comes from Paddle verbatim. When the signed-in visitor has a
   * verified eligibility discount we show what they'll actually pay next to
   * the struck-through list price — the real reduction is applied by Paddle at
   * checkout, from a server-resolved discount.
   */
  const PriceLine = ({
    id,
    plan,
    suffix,
  }: {
    id: string;
    plan: PlanId;
    suffix: string;
  }) => {
    // Source of truth for the amount; Paddle only localizes the presentation.
    const fallback = planPriceLabel(plan, interval);
    const price = prices[id];
    if (pricesLoading && !price) return <Skeleton className="h-10 w-32" />;

    const listLabel = price?.formattedTotal ?? fallback;
    const subtotalMinor = price?.subtotalMinor ?? planAmount(plan, interval);

    const discounted = discountPercent > 0 && subtotalMinor > 0
      ? formatMinorAmount(
          Math.round(subtotalMinor * (1 - discountPercent / 100)),
          price?.currencyCode ?? "USD",
        )
      : null;

    const yearlySavings = interval === "annual" ? annualSavingsPercent(plan) : 0;

    return (
      <div>
        {discounted ? (
          <>
            <span className="text-4xl font-bold text-foreground">{discounted}</span>
            <span className="text-sm text-muted-foreground ml-1">/ {suffix}</span>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground line-through">{listLabel}</span>
              <Badge variant="secondary" className="gap-1">
                <BadgePercent className="h-3 w-3" aria-hidden="true" />
                {discountPercent}% off applied
              </Badge>
            </div>
          </>
        ) : (
          <>
            <span className="text-4xl font-bold text-foreground">{listLabel}</span>
            <span className="text-sm text-muted-foreground ml-1">/ {suffix}</span>
          </>
        )}
        {yearlySavings > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground line-through tabular-nums">
              {formatUsd(annualListPrice(plan))}
            </span>
            <Badge className="bg-mahogany text-mahogany-foreground hover:bg-mahogany">
              Save {yearlySavings}%
            </Badge>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto py-8 space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Choose your career edge</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Start free. Upgrade when you're ready to dominate your job search with full AI firepower.
        </p>
        <div className="inline-flex rounded-lg border border-border p-1 bg-card/50">
          {(["plans", "packs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "plans" ? "Subscriptions" : "Pay-per-use packs"}
            </button>
          ))}
        </div>
      </div>

      <PaymentsConfigBanner context="pricing" className="mx-auto max-w-3xl" />

      {/* Eligibility discounts: advertised to everyone, confirmed for the verified. */}
      {(discountPercent > 0 || topProgram) && (
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {discountPercent > 0 ? (
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : (
                <BadgePercent className="h-4 w-4 text-primary" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {discountPercent > 0
                  ? `Your ${discountPercent}% eligibility discount is active`
                  : `Save up to ${Math.round(Number(topProgram?.percentage ?? 0))}% with an eligibility discount`}
              </p>
              <p className="text-xs text-muted-foreground">
                {discountPercent > 0
                  ? "It's applied automatically at checkout and on every renewal."
                  : "Students, educators, military, first responders, healthcare and nonprofit teams qualify."}
              </p>
            </div>
          </div>
          {discountPercent > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings#eligibility")}>
              Manage
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => (user ? setVerifyOpen(true) : navigate("/auth?next=/pricing"))}
            >
              Check if you qualify
            </Button>
          )}
        </div>
      )}

      <VerificationDialog open={verifyOpen} onOpenChange={setVerifyOpen} />

      {/* Two distinct stories: a transient lookup problem still shows the
          standard USD catalog, while a missing provider catalog means checkout
          genuinely cannot start — say so plainly instead of failing silently. */}
      {priceFailure && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto flex max-w-xl flex-col items-center gap-2 rounded-xl border border-border bg-card/60 p-4 text-center"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-primary" />
            {checkoutBlocked ? "Prices unavailable" : "Localized prices unavailable"}
          </div>
          <p className="text-sm text-muted-foreground">
            {checkoutBlocked
              ? "We can't load live prices right now, so checkout is temporarily paused. Plan details below are accurate — please try again shortly."
              : "Showing standard USD pricing. You'll see your exact local total at checkout."}
          </p>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}


      {tab === "plans" ? (
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div
              role="group"
              aria-label="Billing interval"
              className="inline-flex items-center rounded-full border border-border bg-card/60 p-1"
            >
              {(["monthly", "annual"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  aria-pressed={interval === i}
                  className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                    interval === i
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {i === "monthly" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
            <p className="inline-flex items-center gap-2 rounded-full border border-mahogany-border bg-mahogany/10 px-3 py-1 text-xs font-medium text-mahogany">
              <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
              {ANNUAL_SAVINGS_MESSAGE}
            </p>
          </div>


          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <SpatialCard className="group/spatial h-full rounded-xl" tilt={4}>
            <Card className="relative h-full p-6 flex flex-col border-border">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{FREE_TIER.name}</h2>
              </div>
              <div className="mb-4">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-sm text-muted-foreground ml-1">/ forever</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{FREE_TIER.description}</p>
              <ul className="space-y-2.5 mb-6 flex-1">
                {FREE_TIER.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => (currentPlan === "free" ? navigate("/") : handleSelect(null))}
              >
                {currentPlan === "free" ? "Current plan" : "Get started"}
              </Button>
            </Card>
            </SpatialCard>

            {TIERS.map((tier) => {
              const Icon = TIER_ICONS[tier.name] ?? Rocket;
              const priceId = interval === "annual" ? tier.priceId.year : tier.priceId.month;
              const pendingKey = `${tier.key}-${interval}`;
              const current = currentPlan === tier.key && billingInterval === interval;
              return (
                <SpatialCard key={tier.name} className="group/spatial h-full rounded-xl" tilt={4} featured={tier.highlighted}>
                <Card
                  className={`relative h-full p-6 flex flex-col ${
                    tier.highlighted ? "accent-card border-mahogany-border shadow-lg shadow-mahogany/10 xl:scale-[1.02]" : "border-border"
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-mahogany text-mahogany-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-[0_8px_20px_-12px_hsl(var(--mahogany))]">
                      Most popular
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">{tier.name}</h2>
                  </div>

                  <div className="mb-4">
                    <PriceLine id={priceId} plan={tier.key as PlanId} suffix={interval === "annual" ? "year" : "month"} />
                  </div>

                  <p className="text-sm text-muted-foreground mb-6">{tier.description}</p>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => (current ? navigate("/billing") : handleSelect(tier))}
                    variant={tier.highlighted ? "default" : "outline"}
                    className="w-full"
                    disabled={pending === pendingKey}
                  >
                    {current ? (
                      "Current plan"
                    ) : pending === pendingKey ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Opening checkout…
                      </span>
                    ) : (
                      `Subscribe to ${tier.name}`
                    )}
                  </Button>
                </Card>
                </SpatialCard>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <SpatialCard key={pack.priceId} className="group/spatial h-full rounded-xl" tilt={3}>
            <Card className="h-full p-5 flex flex-col">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">{pack.label}</h2>
              <p className="text-xs text-muted-foreground mt-1 mb-4 flex-1">{pack.blurb}</p>
              <div className="mb-4">
                {pricesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <span className="type-h1 text-foreground">
                    {priceFor(pack.priceId) ?? "Price shown at checkout"}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handlePack(pack.priceId)}
                disabled={pending === pack.priceId}
              >
                {pending === pack.priceId ? "Opening checkout…" : "Buy pack"}
              </Button>
            </Card>
            </SpatialCard>
          ))}
        </div>
      )}

      <div className="space-y-2 text-center text-xs text-muted-foreground">
        <p>
          Prices shown in your local currency. Orders are processed by Paddle.com, our Merchant of
          Record. Cancel anytime from your billing page.
        </p>
        <p className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/terms" className="underline hover:text-foreground">
            Terms &amp; Conditions
          </Link>
          <Link to="/refund-policy" className="underline hover:text-foreground">
            Refund Policy
          </Link>
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Notice
          </Link>
        </p>
      </div>
    </div>
  );
}
