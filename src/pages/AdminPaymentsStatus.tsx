import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { currentPaymentsDiagnostics } from "@/lib/paymentsConfig";
import { LEGAL_PAGES } from "@/content/legal";
import { TIERS, CREDIT_PACKS } from "@/config/tiers";
import { PageHeader } from "@/components/app/PageHeader";
import { PaymentsHealthPanel } from "@/components/admin/PaymentsHealthPanel";
import { Activity } from "lucide-react";

type CheckStatus = "pass" | "warn" | "fail";

interface CheckRow {
  label: string;
  status: CheckStatus;
  detail: string;
}

const STATUS_META: Record<CheckStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-success", label: "Ready" },
  warn: { icon: AlertTriangle, className: "text-warning", label: "Attention" },
  fail: { icon: XCircle, className: "text-destructive", label: "Blocked" },
};

function StatusRow({ row }: { row: CheckRow }) {
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{row.label}</p>
        <p className="text-sm text-muted-foreground break-words">{row.detail}</p>
      </div>
      <Badge variant="outline" className={meta.className}>
        {meta.label}
      </Badge>
    </li>
  );
}

/** Admin-only runtime verification of the Paddle / sandbox configuration. */
export default function AdminPaymentsStatus() {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return Boolean(data);
    },
  });

  const diag = currentPaymentsDiagnostics();

  // Runtime probe: can the price resolver reach Paddle with the server API key?
  const priceProbe = useQuery({
    queryKey: ["payments-status-price-probe", diag.environment],
    enabled: Boolean(isAdmin),
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const priceId = TIERS[0]?.priceId.month ?? CREDIT_PACKS[0]?.priceId;
      const started = performance.now();
      const { data, error } = await supabase.functions.invoke("get-paddle-price", {
        body: { priceId, environment: diag.environment ?? "sandbox" },
      });
      const ms = Math.round(performance.now() - started);
      if (error) throw new Error(error.message);
      if (!data?.paddleId) throw new Error("Resolver responded without a paddleId");
      return { priceId, paddleId: data.paddleId as string, ms };
    },
  });

  // Runtime probe: policy pages required by Paddle's readiness check.
  const policyProbe = useQuery({
    queryKey: ["payments-status-policies"],
    enabled: Boolean(isAdmin),
    retry: false,
    queryFn: async () => {
      const results = await Promise.all(
        LEGAL_PAGES.map(async (page) => {
          try {
            const res = await fetch(page.path, { method: "GET" });
            return { path: page.path, ok: res.ok, status: res.status };
          } catch {
            return { path: page.path, ok: false, status: 0 };
          }
        }),
      );
      return results;
    },
  });

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const configRows: CheckRow[] = [
    {
      label: "VITE_PAYMENTS_CLIENT_TOKEN",
      status: diag.missing.includes("VITE_PAYMENTS_CLIENT_TOKEN") ? "fail" : "pass",
      detail: diag.tokenPreview
        ? `Present (${diag.tokenPreview}) — a ${diag.tokenEnvironment} token.`
        : "Not set in this build. Checkout cannot initialize.",
    },
    {
      label: "VITE_PAYMENTS_ENVIRONMENT",
      status: diag.missing.includes("VITE_PAYMENTS_ENVIRONMENT")
        ? "fail"
        : diag.environment
          ? "pass"
          : "fail",
      detail: diag.environment
        ? `Set to '${diag.environment}'.`
        : "Missing or invalid — must be exactly 'sandbox' or 'live'.",
    },
    {
      label: "Token / environment agreement",
      status: !diag.tokenEnvironment || !diag.environment ? "warn" : diag.ok ? "pass" : "fail",
      detail:
        diag.tokenEnvironment && diag.environment
          ? diag.ok
            ? `Token and environment both point at ${diag.environment}.`
            : `Mismatch: token is ${diag.tokenEnvironment}, environment is ${diag.environment}.`
          : "Cannot be evaluated until both variables are set.",
    },
    {
      label: "Checkout entrypoint",
      status: diag.ok ? "pass" : "fail",
      detail: diag.ok
        ? "Paddle.js can be initialized — pricing CTAs open checkout."
        : "Disabled. Pricing and billing pages show the misconfiguration banner instead.",
    },
  ];

  const runtimeRows: CheckRow[] = [
    {
      label: "Price resolver (get-paddle-price)",
      status: priceProbe.isLoading ? "warn" : priceProbe.isError ? "fail" : "pass",
      detail: priceProbe.isLoading
        ? "Probing…"
        : priceProbe.isError
          ? `Failed: ${(priceProbe.error as Error).message}. Check the Paddle API key secret for this environment.`
          : `Resolved '${priceProbe.data?.priceId}' → ${priceProbe.data?.paddleId} in ${priceProbe.data?.ms}ms.`,
    },
    ...(policyProbe.data ?? []).map<CheckRow>((p) => ({
      label: `Policy page ${p.path}`,
      status: p.ok ? "pass" : "fail",
      detail: p.ok
        ? "Publicly reachable — satisfies Paddle's readiness requirement."
        : `Not reachable (status ${p.status}). Paddle's readiness check will fail.`,
    })),
  ];

  const blocking = [...configRows, ...runtimeRows].filter((r) => r.status === "fail").length;

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow="Operations"
        icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
        title="Payments status"
        description="Runtime verification of the Paddle configuration for this build."
        meta={
          <Badge variant="outline" className={diag.ok ? "text-success" : "text-destructive"}>
            {diag.environment ? diag.environment.toUpperCase() : "UNCONFIGURED"}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void priceProbe.refetch();
              void policyProbe.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Re-check
          </Button>
        }
      />

      <Card
        className={`p-5 ${blocking ? "border-destructive/40 bg-destructive/5" : "border-success/40 bg-success/5"}`}
      >
        <p className="text-sm font-semibold text-foreground">
          {blocking === 0
            ? "All checks passing — checkout is operational."
            : `${blocking} blocking ${blocking === 1 ? "issue" : "issues"} — checkout will not complete.`}
        </p>
        {diag.reason && <p className="mt-1 text-sm text-muted-foreground">{diag.reason}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Build configuration</h2>
        <ul>
          {configRows.map((row) => (
            <StatusRow key={row.label} row={row} />
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Runtime checks</h2>
        <ul>
          {runtimeRows.map((row) => (
            <StatusRow key={row.label} row={row} />
          ))}
        </ul>
      </Card>

      <PaymentsHealthPanel />

      {diag.issues.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-semibold text-foreground">How to fix</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {diag.issues.map((issue, i) => (
              <li key={i} className="ml-4 list-decimal">
                <span className="text-foreground">{issue.message}</span> {issue.fix}
              </li>
            ))}
            <li className="ml-4 list-decimal">
              Rebuild and republish — Vite inlines <code>VITE_*</code> values at build time.
            </li>
          </ol>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        Related: <Link to="/admin/paddle" className="text-primary underline">Paddle customers</Link>{" "}
        · <Link to="/admin/security-log" className="text-primary underline">Billing webhook log</Link>
      </p>
    </div>
  );
}
