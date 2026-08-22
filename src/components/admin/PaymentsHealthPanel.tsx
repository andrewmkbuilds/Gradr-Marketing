import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { currentPaymentsDiagnostics } from "@/lib/paymentsConfig";
import { CREDIT_PACKS, TIERS } from "@/config/tiers";

interface PriceCheck {
  priceId: string;
  ok: boolean;
  paddleId?: string;
  status?: number;
  ms?: number;
  errorCode?: string;
  error?: string;
}

interface HealthResponse {
  environment: "sandbox" | "live";
  healthy: boolean;
  secrets: { name: string; present: boolean }[];
  missingSecrets: string[];
  prices: PriceCheck[];
  checkedAt: string;
}

interface AbuseAlert {
  id: string;
  user_id: string;
  price_id: string;
  environment: string;
  attempts: number;
  window_seconds: number;
  subscription_id: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  created_at: string;
}

const ALL_PRICE_IDS = [
  ...TIERS.flatMap((t) => [t.priceId.month, t.priceId.year]),
  ...CREDIT_PACKS.map((p) => p.priceId),
];

/**
 * Admin panel: live verification that the price resolver can fetch prices from
 * Paddle, plus the duplicate-checkout monitor. Both surface the exact cause
 * (missing secret name, Paddle error code) rather than a generic failure.
 */
export function PaymentsHealthPanel() {
  const diag = currentPaymentsDiagnostics();
  const environment = diag.environment ?? "sandbox";

  const health = useQuery({
    queryKey: ["payments-price-health", environment],
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<HealthResponse> => {
      const { data, error } = await supabase.functions.invoke("payments-price-health", {
        body: { environment, priceIds: ALL_PRICE_IDS },
      });
      if (error) throw new Error(error.message);
      return data as HealthResponse;
    },
  });

  const alerts = useQuery({
    queryKey: ["checkout-abuse-alerts"],
    retry: false,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AbuseAlert[]> => {
      const { data, error } = await supabase
        .from("checkout_abuse_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as AbuseAlert[];
    },
  });

  const failing = health.data?.prices.filter((p) => !p.ok) ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Price resolver health</h2>
            <p className="text-sm text-muted-foreground">
              Fetches every catalog price live from Paddle ({environment}).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void health.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Re-check
          </Button>
        </div>

        {health.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking prices…
          </p>
        )}

        {health.isError && (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Health endpoint failed: {(health.error as Error).message}
          </p>
        )}

        {health.data && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={health.data.healthy ? "text-success" : "text-destructive"}
              >
                {health.data.healthy ? "All prices resolving" : `${failing.length} failing`}
              </Badge>
              {health.data.secrets.map((s) => (
                <Badge
                  key={s.name}
                  variant="outline"
                  className={s.present ? "text-success" : "text-destructive"}
                >
                  {s.name}: {s.present ? "set" : "missing"}
                </Badge>
              ))}
            </div>

            <ul>
              {health.data.prices.map((p) => (
                <li
                  key={p.priceId}
                  className="flex items-start gap-3 border-b border-border/60 py-2 last:border-0"
                >
                  {p.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p.priceId}</p>
                    <p className="break-words text-sm text-muted-foreground">
                      {p.ok
                        ? `→ ${p.paddleId} (${p.ms}ms)`
                        : `${p.errorCode ?? "error"}: ${p.error ?? "Unknown failure"}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Repeated checkout attempts</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Alerts raised when the same subscriber opens checkout 3+ times inside 10 minutes — the
          signature of a duplicate-subscription risk.
        </p>

        {alerts.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading alerts…
          </p>
        )}
        {alerts.isError && (
          <p className="text-sm text-destructive">
            Could not load alerts: {(alerts.error as Error).message}
          </p>
        )}
        {alerts.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No repeated-checkout alerts recorded.</p>
        )}

        <ul>
          {(alerts.data ?? []).map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {a.attempts} attempts in {Math.round(a.window_seconds / 60)} min · {a.price_id}
                </p>
                <p className="break-words text-sm text-muted-foreground">
                  user {a.user_id} · subscription {a.subscription_id ?? "none"} ·{" "}
                  {a.subscription_tier ?? "no tier"} / {a.subscription_status ?? "no status"} ·{" "}
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant="outline">{a.environment}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
