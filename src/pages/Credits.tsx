import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Plus, RefreshCw, Wallet, Zap } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/Seo";
import { PageHeader } from "@/components/app/PageHeader";
import { UsageBars } from "@/components/UsageBars";
import {
  useBillingActions,
  useBillingRealtime,
  useCredits,
  usePurchases,
  useSubscription,
} from "@/hooks/useSubscription";

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() })
    .format(minor / 100);
}

/**
 * Live credit wallet. Balances are written server-side by the payments
 * webhook, so this page listens for changes rather than trusting a snapshot
 * taken at page load.
 */
export default function Credits() {
  useBillingRealtime();

  const navigate = useNavigate();
  const { data: credits, isLoading } = useCredits();
  const { data: purchases } = usePurchases();
  const { isPro } = useSubscription();
  const { pending, restorePurchases } = useBillingActions();

  const totals = useMemo(() => {
    const granted = (purchases ?? [])
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.credits_granted ?? 0), 0);
    const held = Number(credits?.application_credits ?? 0) + Number(credits?.interview_credits ?? 0);
    return { granted, held, used: Math.max(0, granted - held) };
  }, [purchases, credits]);

  const balances = [
    {
      key: "application",
      label: "Application credits",
      hint: "Tailored resume + cover letter packages",
      icon: Zap,
      value: Number(credits?.application_credits ?? 0),
      tone: "text-primary",
    },
    {
      key: "interview",
      label: "Interview prep credits",
      hint: "AI mock interview sessions with scorecards",
      icon: Mic,
      value: Number(credits?.interview_credits ?? 0),
      tone: "text-mahogany",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 pt-6 sm:px-6">
      <Seo
        title="Credits balance"
        description="Track your Gradr application and interview credits, usage and top-ups in real time."
        path="/credits"
      />

      <PageHeader
        eyebrow="Account"
        title="Credits"
        description="Your purchased credits and how much of your plan you've used — updated live."
        icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void restorePurchases()}
              disabled={pending === "restore"}
            >
              <RefreshCw className={`h-4 w-4 ${pending === "restore" ? "animate-spin" : ""}`} aria-hidden="true" />
              Sync
            </Button>
            <Button size="sm" className="gap-2" onClick={() => navigate("/pricing")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Top up
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {balances.map((b) => (
          <Card key={b.key} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <b.icon className={`h-4 w-4 ${b.tone}`} aria-hidden="true" />
                {b.label}
              </span>
              {isPro && <Badge variant="secondary">Plan covers this</Badge>}
            </div>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-foreground" aria-live="polite">
              {isLoading ? "—" : b.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{b.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Credits purchased", value: totals.granted },
          { label: "Credits used", value: totals.used },
          { label: "Available now", value: totals.held },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{s.value}</p>
          </Card>
        ))}
      </div>

      <UsageBars />

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Recent top-ups</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/billing">Full billing history</Link>
          </Button>
        </div>
        {(purchases ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No credit packs yet. Packs add credits on top of your monthly plan allowance.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(purchases ?? []).slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.pack_label ?? p.pack_key}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "d MMM yyyy")} · +{p.credits_granted} credits
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums text-foreground">{money(p.amount_total, p.currency)}</p>
                  <Badge variant={p.status === "paid" ? "secondary" : "outline"}>{p.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
