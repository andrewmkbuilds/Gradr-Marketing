import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MousePointerClick,
  Users,
  DollarSign,
  TrendingUp,
  Loader2,
  BarChart3,
  Wrench,
  LayoutDashboard,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyAffiliate, useAffiliateOverview, useAffiliateTiers } from "@/hooks/useAffiliate";
import { StatCard } from "@/components/StatCard";
import { format } from "date-fns";
import { CampaignBuilder } from "@/components/affiliate/CampaignBuilder";
import { AffiliateAnalytics } from "@/components/affiliate/AffiliateAnalytics";
import { TierProgress, MilestoneBadges } from "@/components/affiliate/TierProgress";
import { ShareCard } from "@/components/affiliate/ShareCard";
import { ReferralLeaderboard } from "@/components/affiliate/ReferralLeaderboard";
import { ActivityTimeline, type TimelineEvent } from "@/components/affiliate/ActivityTimeline";
import { Button, Card, Text } from "@/design-system/gradr-9b9b95";

type Tab = "overview" | "rewards" | "analytics" | "campaigns";

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const { data: my, isLoading: loadingMy } = useMyAffiliate();
  const { data: overview, isLoading: loadingOverview } = useAffiliateOverview();
  const { data: tiers } = useAffiliateTiers();
  const profile = my?.profile;
  const [tab, setTab] = useState<Tab>("overview");

  const link = useMemo(() => {
    if (!profile) return "";
    return `${window.location.origin}/?ref=${profile.affiliate_code}`;
  }, [profile]);

  const { data, isLoading } = useQuery({
    queryKey: ["affiliateStats", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [clicks, referrals, commissions, payouts] = await Promise.all([
        supabase.from("affiliate_clicks").select("id, clicked_at, landing_page, utm_source").eq("affiliate_profile_id", profile!.id).order("clicked_at", { ascending: false }).limit(20),
        supabase.from("affiliate_referrals").select("*").eq("affiliate_profile_id", profile!.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("affiliate_commissions").select("*").eq("affiliate_profile_id", profile!.id).order("created_date", { ascending: false }),
        supabase.from("affiliate_payouts").select("*").eq("affiliate_profile_id", profile!.id).order("created_at", { ascending: false }),
      ]);
      return {
        clicks: clicks.data || [],
        referrals: referrals.data || [],
        commissions: commissions.data || [],
        payouts: payouts.data || [],
      };
    },
  });

  const timeline: TimelineEvent[] = useMemo(() => {
    if (!data) return [];
    const events: TimelineEvent[] = [
      ...data.clicks.slice(0, 10).map((c) => ({
        id: `click-${c.id}`,
        at: c.clicked_at,
        kind: "click" as const,
        title: "Link click",
        detail: [c.landing_page, c.utm_source].filter(Boolean).join(" · ") || undefined,
      })),
      ...data.referrals.map((r) => ({
        id: `ref-${r.id}`,
        at: r.signup_date || r.created_at,
        kind: "referral" as const,
        title: r.conversion_date ? "Referral converted" : "Referral signed up",
        detail: `${r.conversion_type || "signup"} · ${r.attribution_status}`,
      })),
      ...data.commissions.map((c) => ({
        id: `com-${c.id}`,
        at: c.created_date,
        kind: c.status === "reversed" ? ("reversal" as const) : ("commission" as const),
        title:
          c.status === "reversed"
            ? `Commission reversed — $${Number(c.commission_amount).toFixed(2)}`
            : `Commission ${c.status} — $${Number(c.commission_amount).toFixed(2)}`,
        detail: c.source_amount ? `on $${Number(c.source_amount).toFixed(2)} order` : undefined,
      })),
      ...data.payouts.map((p) => ({
        id: `pay-${p.id}`,
        at: p.payout_date || p.created_at,
        kind: "payout" as const,
        title: `Payout ${p.status} — $${Number(p.amount).toFixed(2)}`,
        detail: [p.payout_method, p.reference].filter(Boolean).join(" · ") || undefined,
      })),
    ];
    return events.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 25);
  }, [data]);

  if (loadingMy || isLoading || loadingOverview) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!profile) {
    navigate("/affiliate", { replace: true });
    return null;
  }

  const earnings = overview?.earnings;
  const stats = overview?.stats;
  const threshold = earnings?.payout_threshold ?? 0;
  const unpaid = earnings?.unpaid ?? 0;
  const payoutProgress = threshold > 0 ? Math.min(100, Math.round((unpaid / threshold) * 100)) : 100;

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "rewards", label: "Rewards", icon: Trophy },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "campaigns", label: "Campaign links", icon: Wrench },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Text variant="h2" as="h1">Gradr Referral Program</Text>
          <Text variant="body-sm" tone="muted" className="mt-1">
            Share Gradr, climb the levels, get paid. Everything below is live data from your account.
          </Text>
        </div>
        <Button variant="link" size="inline" onClick={() => navigate("/affiliate/resources")}>
          Resources &amp; terms →
        </Button>
      </div>

      <ShareCard code={profile.affiliate_code} link={link} />

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant="ghost"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`whitespace-nowrap rounded-none border-b-2 ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" aria-hidden /> {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={MousePointerClick} title="Clicks" value={String(stats?.clicks ?? 0)} subtitle="all time" />
            <StatCard icon={Users} title="Referrals" value={String(stats?.referrals ?? 0)} subtitle={`${stats?.conversions ?? 0} converted`} />
            <StatCard icon={TrendingUp} title="Conversion rate" value={`${stats?.conversion_rate ?? 0}%`} subtitle="conversions / clicks" />
            <StatCard
              icon={DollarSign}
              title="Unpaid balance"
              value={`$${unpaid.toFixed(2)}`}
              subtitle={`$${(earnings?.lifetime ?? 0).toFixed(2)} lifetime`}
              glowing={unpaid > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card variant="raised" padding="lg" className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between text-sm">
                <Text variant="h6" as="h3">Payout progress</Text>
                <span className="text-xs text-muted-foreground">
                  ${unpaid.toFixed(2)} of ${threshold.toFixed(2)} minimum
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${payoutProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {unpaid >= threshold
                  ? "You've cleared the minimum — your balance is queued for the next payout run."
                  : `$${Math.max(threshold - unpaid, 0).toFixed(2)} more in approved commissions unlocks a payout.`}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                {[
                  { label: "Pending", value: earnings?.pending ?? 0, tone: "text-warning" },
                  { label: "Approved", value: earnings?.approved ?? 0, tone: "text-primary" },
                  { label: "Paid", value: earnings?.paid ?? 0, tone: "text-success" },
                  { label: "Reversed", value: earnings?.reversed ?? 0, tone: "text-destructive" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-secondary/50 p-3">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className={`text-lg font-bold mt-1 ${s.tone}`}>${Number(s.value).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="raised" padding="lg">
              <Text variant="h6" as="h3" className="mb-2">Earnings projection</Text>
              <Text variant="h3" as="div">
                ${(earnings?.projected_next_30d ?? 0).toFixed(2)}
              </Text>
              <Text variant="caption" className="mt-2">
                Estimated next 30 days, based on your actual conversion pace and average commission of $
                {(earnings?.avg_commission ?? 0).toFixed(2)}.
              </Text>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActivityTimeline events={timeline} />
            <Card variant="raised" padding="lg">
              <Text variant="h6" as="h3" className="mb-3">Payout history</Text>
              {data!.payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No payouts yet. Payouts are processed monthly once you hit the minimum threshold.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data!.payouts.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50">
                      <div>
                        <div className="text-foreground">${Number(p.amount).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{p.payout_method || "—"} · {p.reference || "no ref"}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          p.status === "paid" ? "bg-success/10 text-success"
                          : p.status === "failed" ? "bg-destructive/10 text-destructive"
                          : "bg-warning/10 text-warning"
                        }`}>{p.status}</span>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {format(new Date(p.payout_date || p.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {tab === "rewards" && overview && (
        <div className="space-y-4">
          <TierProgress overview={overview} tiers={(tiers as never[]) ?? []} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MilestoneBadges overview={overview} />
            <ReferralLeaderboard />
          </div>
        </div>
      )}

      {tab === "analytics" && <AffiliateAnalytics affiliateProfileId={profile.id} />}

      {tab === "campaigns" && <CampaignBuilder affiliateProfileId={profile.id} affiliateCode={profile.affiliate_code} />}
    </div>
  );
}
