import { useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCw, Zap, Mic, ExternalLink, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useBillingActions, useBillingRealtime, useCredits, usePurchases, useSubscription } from "@/hooks/useSubscription";
import { PLAN_PRICING, formatUsd, type PlanId } from "@/config/pricing";
import { Seo } from "@/components/Seo";
import { PaymentIssueBanner } from "@/components/PaymentIssueBanner";
import { PaymentsConfigBanner } from "@/components/PaymentsConfigBanner";
import { CancelPlanDialog } from "@/components/billing/CancelPlanDialog";
import { Link } from "react-router-dom";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() })
    .format(cents / 100);
}

function packTypeOf(packKey: string) {
  return packKey.startsWith("interview") ? "interview" : "application";
}


export default function Billing() {
  useBillingRealtime();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sub = useSubscription();
  const { data: credits } = useCredits();
  const { data: purchases } = usePurchases();
  const { pending, openPortal, restorePurchases } = useBillingActions();

  useEffect(() => {
    if (params.get("checkout") === "success" || params.get("purchase") === "success") {
      toast.success("Payment complete — syncing your account…");
      void restorePurchases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [packType, setPackType] = useState("all");
  const [status, setStatus] = useState("all");
  const [cancelOpen, setCancelOpen] = useState(false);

  const filtered = useMemo(() => {
    return (purchases ?? []).filter((p) => {
      const created = new Date(p.created_at);
      if (from && created < new Date(`${from}T00:00:00`)) return false;
      if (to && created > new Date(`${to}T23:59:59`)) return false;
      if (packType !== "all" && packTypeOf(p.pack_key) !== packType) return false;
      if (status !== "all" && p.status !== status) return false;
      return true;
    });
  }, [purchases, from, to, packType, status]);

  const exportCsv = () => {
    const header = ["Date", "Pack", "Type", "Credits", "Amount", "Currency", "Status"];
    const rows = filtered.map((p) => [
      new Date(p.created_at).toISOString(),
      p.pack_label ?? p.pack_key,
      packTypeOf(p.pack_key),
      String(p.credits_granted),
      (p.amount_total / 100).toFixed(2),
      p.currency.toUpperCase(),
      p.status,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradr-purchases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };



  // List price for the plan actually on file. Paddle may charge less (discount,
  // proration or tax differences), so this is labelled as an estimate.
  const nextAmount = sub.isSubscribed && sub.plan !== "free" && !sub.cancelAtPeriodEnd
    ? formatUsd(
        sub.billingInterval === "annual"
          ? PLAN_PRICING[sub.plan as PlanId].annual
          : PLAN_PRICING[sub.plan as PlanId].monthly,
      )
    : null;

  const renews = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Seo
        title="Billing & Subscription"
        description="Manage your Gradr subscription, credits and purchase history."
        path="/billing"
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="type-h1 text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">Manage your plan, credits and payment history.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void restorePurchases()} disabled={pending === "restore"}>
          <RefreshCw className={`h-4 w-4 ${pending === "restore" ? "animate-spin" : ""}`} />
          Restore purchases
        </Button>
      </div>

      <PaymentIssueBanner />

      <PaymentsConfigBanner context="billing" />





      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Current plan</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="type-h1 text-foreground">
                {sub.isSubscribed
                  ? `Gradr ${sub.isPro ? "Pro" : "Starter"} (${sub.billingInterval === "annual" ? "Annual" : "Monthly"})`
                  : "Free plan"}
              </span>
              {sub.status && sub.status !== "none" && (
                <Badge variant={sub.isSubscribed ? "default" : "secondary"}>{sub.status}</Badge>
              )}
            </div>
            {sub.isSubscribed && renews && (
              <p className="text-sm text-muted-foreground">
                {sub.cancelAtPeriodEnd ? `Cancels on ${renews}` : `Renews on ${renews}`}
              </p>
            )}
            {sub.isSubscribed && (
              <dl className="grid gap-3 pt-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Billing cycle</dt>
                  <dd className="text-sm text-foreground">
                    {sub.billingInterval === "annual" ? "Yearly" : "Monthly"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {sub.cancelAtPeriodEnd ? "Access until" : "Next renewal"}
                  </dt>
                  <dd className="text-sm text-foreground">{renews ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Next charge</dt>
                  <dd className="text-sm text-foreground">
                    {sub.cancelAtPeriodEnd ? "No further charges" : nextAmount ? `${nextAmount} (est.)` : "—"}
                  </dd>
                </div>
              </dl>
            )}
            {!sub.isSubscribed && (
              <p className="text-sm text-muted-foreground">Upgrade to unlock unlimited AI analysis and coaching.</p>
            )}
          </div>

          <div className="flex gap-2">
            {sub.isSubscribed ? (
              <>
                <Button className="gap-2" onClick={() => void openPortal()} disabled={pending === "portal"}>
                  <ExternalLink className="h-4 w-4" />
                  Manage subscription
                </Button>
                {!sub.cancelAtPeriodEnd && (
                  <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                    Cancel plan
                  </Button>
                )}
              </>
            ) : (
              <Button className="gap-2" onClick={() => navigate("/pricing")}>
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>
        {sub.isSubscribed && (
          <p className="text-xs text-muted-foreground mt-4">
            Change plan from the pricing page — upgrades apply instantly and are pro-rated. Update your
            card or cancel from the Paddle billing portal.
          </p>
        )}
        <CancelPlanDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onContinueToCancel={() => void openPortal()}
          onOfferAccepted={() => void restorePurchases()}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              Application credits
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link to="/credits">Details</Link>
            </Button>
          </div>
          <div className="type-h1 text-foreground">{credits?.application_credits ?? 0}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="h-4 w-4 text-mahogany" />
            <span className="text-sm text-muted-foreground">Interview prep credits</span>
          </div>
          <div className="type-h1 text-foreground">{credits?.interview_credits ?? 0}</div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-sm font-semibold text-foreground">Purchase history</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <div className="space-y-1">
            <Label htmlFor="history-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="history-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="history-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-pack-type" className="text-xs text-muted-foreground">Pack type</Label>
            <Select value={packType} onValueChange={setPackType}>
              <SelectTrigger id="history-pack-type" aria-label="Filter purchases by pack type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All packs</SelectItem>
                <SelectItem value="application">Applications</SelectItem>
                <SelectItem value="interview">Interview prep</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-status" className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="history-status" aria-label="Filter purchases by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {purchases && purchases.length > 0 ? "No purchases match these filters." : "No pack purchases yet."}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="text-foreground">{p.pack_label ?? p.pack_key}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()} · {p.credits_granted} credits
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground">{formatMoney(p.amount_total, p.currency)}</span>
                  <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>


      <Button variant="ghost" className="w-full" onClick={() => navigate("/pricing")}>
        Browse plans and pay-per-use packs
      </Button>

      <p className="flex flex-wrap items-center justify-center gap-3 pb-4 text-xs text-muted-foreground">
        <span>Payments processed by Paddle.com, our Merchant of Record.</span>
        <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
        <Link to="/refund-policy" className="underline hover:text-foreground">Refunds</Link>
        <Link to="/privacy" className="underline hover:text-foreground">Privacy</Link>
      </p>
    </div>
  );
}
