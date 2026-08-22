import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/design-system/gradr-9b9b95";

interface Props {
  affiliateProfileId: string;
}

type Range = 7 | 30 | 90 | 365;

const RANGES: { label: string; value: Range }[] = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "1y", value: 365 },
];

export function AffiliateAnalytics({ affiliateProfileId }: Props) {
  const [range, setRange] = useState<Range>(30);
  const [tab, setTab] = useState<"clicks" | "referrals" | "commissions" | "payouts">("clicks");

  const since = useMemo(() => startOfDay(subDays(new Date(), range - 1)).toISOString(), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["affiliateAnalytics", affiliateProfileId, range],
    queryFn: async () => {
      const [clicks, refs, comms, pays] = await Promise.all([
        supabase.from("affiliate_clicks")
          .select("id, clicked_at, landing_page, utm_source, utm_medium, utm_campaign")
          .eq("affiliate_profile_id", affiliateProfileId)
          .gte("clicked_at", since)
          .order("clicked_at", { ascending: false }),
        supabase.from("affiliate_referrals")
          .select("id, created_at, conversion_type, conversion_date, attribution_status, referral_code")
          .eq("affiliate_profile_id", affiliateProfileId)
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
        supabase.from("affiliate_commissions")
          .select("id, created_date, commission_amount, source_amount, status, notes")
          .eq("affiliate_profile_id", affiliateProfileId)
          .gte("created_date", since)
          .order("created_date", { ascending: false }),
        supabase.from("affiliate_payouts")
          .select("id, created_at, payout_date, amount, status, payout_method, reference")
          .eq("affiliate_profile_id", affiliateProfileId)
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
      ]);
      return {
        clicks: clicks.data || [],
        referrals: refs.data || [],
        commissions: comms.data || [],
        payouts: pays.data || [],
      };
    },
  });

  const timeseries = useMemo(() => {
    if (!data) return [];
    const days = eachDayOfInterval({ start: subDays(new Date(), range - 1), end: new Date() });
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const label = format(day, range > 90 ? "MMM" : "MMM d");
      const clicks = data.clicks.filter((c) => format(new Date(c.clicked_at), "yyyy-MM-dd") === key).length;
      const signups = data.referrals.filter((r) => format(new Date(r.created_at), "yyyy-MM-dd") === key).length;
      const conversions = data.referrals.filter(
        (r) => r.conversion_date && format(new Date(r.conversion_date), "yyyy-MM-dd") === key
      ).length;
      const earned = data.commissions
        .filter((c) => format(new Date(c.created_date), "yyyy-MM-dd") === key)
        .reduce((a, c) => a + Number(c.commission_amount || 0), 0);
      return { key, label, clicks, signups, conversions, earned: Number(earned.toFixed(2)) };
    });
  }, [data, range]);

  const chartAxisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 border border-border">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              variant="ghost"
              size="sm"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={range === r.value ? "bg-background text-foreground shadow-raise" : "text-muted-foreground"}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="elev-2 rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Clicks & signups</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <defs>
                  <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={chartAxisStyle} />
                <YAxis tick={chartAxisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area name="Clicks" type="monotone" dataKey="clicks" stroke="hsl(var(--chart-1))" fill="url(#clicksFill)" strokeWidth={2} />
                <Area name="Signups" type="monotone" dataKey="signups" stroke="hsl(var(--chart-2))" fill="url(#signupsFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="elev-2 rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Commission earned</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={chartAxisStyle} />
                <YAxis tick={chartAxisStyle} tickFormatter={(v) => `$${v}`} />
                {/* recharts 3 widens tooltip values to string | number | array, so coerce before formatting */}
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `$${Number(v).toFixed(2)}`} />

                <Bar name="Earned" dataKey="earned" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="elev-2 rounded-xl p-0 overflow-hidden">
        <div className="flex gap-1 border-b border-border px-3 pt-3 overflow-x-auto">
          {(["clicks", "referrals", "commissions", "payouts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs capitalize border-b-2 transition whitespace-nowrap ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t} ({data?.[t]?.length ?? 0})
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {isLoading || !data ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : tab === "clicks" ? (
            <DrillTable
              rows={data.clicks}
              empty="No clicks in this range."
              headers={["Date", "Landing", "Source", "Medium", "Campaign"]}
              render={(c: any) => [
                format(new Date(c.clicked_at), "MMM d, HH:mm"),
                <span key="p" className="text-muted-foreground truncate max-w-[200px] inline-block">{c.landing_page || "/"}</span>,
                c.utm_source || "—",
                c.utm_medium || "—",
                c.utm_campaign || "—",
              ]}
            />
          ) : tab === "referrals" ? (
            <DrillTable
              rows={data.referrals}
              empty="No referrals in this range."
              headers={["Date", "Type", "Code", "Converted", "Status"]}
              render={(r: any) => [
                format(new Date(r.created_at), "MMM d, yyyy"),
                r.conversion_type || "signup",
                <code key="c" className="text-xs">{r.referral_code}</code>,
                r.conversion_date ? format(new Date(r.conversion_date), "MMM d") : "—",
                <StatusPill key="s" status={r.attribution_status} />,
              ]}
            />
          ) : tab === "commissions" ? (
            <DrillTable
              rows={data.commissions}
              empty="No commissions in this range."
              headers={["Date", "Amount", "Source amount", "Status"]}
              render={(c: any) => [
                format(new Date(c.created_date), "MMM d, yyyy"),
                <span key="a" className="font-medium">${Number(c.commission_amount).toFixed(2)}</span>,
                `$${Number(c.source_amount || 0).toFixed(2)}`,
                <StatusPill key="s" status={c.status} />,
              ]}
            />
          ) : (
            <DrillTable
              rows={data.payouts}
              empty="No payouts in this range."
              headers={["Date", "Amount", "Method", "Reference", "Status"]}
              render={(p: any) => [
                p.payout_date ? format(new Date(p.payout_date), "MMM d, yyyy") : format(new Date(p.created_at), "MMM d, yyyy"),
                <span key="a" className="font-medium">${Number(p.amount).toFixed(2)}</span>,
                p.payout_method || "—",
                <code key="r" className="text-xs text-muted-foreground">{p.reference || "—"}</code>,
                <StatusPill key="s" status={p.status} />,
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DrillTable({
  rows, headers, render, empty,
}: {
  rows: any[]; headers: string[]; render: (row: any) => React.ReactNode[]; empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-10 text-center">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>{headers.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.id ?? i} className="border-t border-border">
            {render(row).map((cell, j) => (
              <td key={j} className="px-4 py-2.5 text-foreground">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "paid" || status === "confirmed" ? "bg-success/10 text-success"
      : status === "approved" ? "bg-primary/10 text-primary"
      : status === "reversed" || status === "canceled" || status === "rejected" ? "bg-destructive/10 text-destructive"
      : "bg-warning/10 text-warning";
  return <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}
