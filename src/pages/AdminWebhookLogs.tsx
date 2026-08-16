import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FlaskConical, RefreshCw, ShieldCheck, Webhook, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsvWithManifest } from "@/lib/admin/auditManifest";
import { cn } from "@/lib/utils";

/**
 * Webhook delivery logs + signature harness.
 *
 * The harness generates provider-shaped test payloads, signs them with the
 * configured webhook secret and verifies signatures with the same algorithm
 * the live handler uses. It never replays payloads into production handlers,
 * so it cannot mutate subscriptions or grant entitlements.
 */

interface DeliveryLog {
  id: string;
  provider: string;
  environment: string | null;
  event_type: string | null;
  event_id: string | null;
  source: string;
  signature_present: boolean;
  signature_valid: boolean | null;
  verification_error: string | null;
  status: string;
  http_status: number | null;
  duration_ms: number | null;
  payload_digest: string | null;
  error: string | null;
  created_at: string;
}

interface WriteResult {
  op: string;
  table: string;
  ok: boolean;
  user_id?: string | null;
  detail?: Record<string, unknown> | null;
  error?: string | null;
  at?: string;
}

interface DeliveryEvent {
  id: string;
  provider: string;
  environment: string | null;
  event_id: string;
  event_type: string | null;
  state: string;
  attempts: number;
  user_id: string | null;
  last_error: string | null;
  write_results: WriteResult[] | null;
  processed_at: string | null;
  created_at: string;
}

const COLUMNS: (keyof DeliveryLog)[] = [
  "created_at", "provider", "environment", "event_type", "event_id", "source",
  "signature_present", "signature_valid", "verification_error", "status",
  "http_status", "duration_ms", "payload_digest", "error", "id",
];

const PADDLE_EVENTS = [
  "subscription.created", "subscription.updated", "subscription.canceled",
  "transaction.completed", "transaction.payment_failed",
];
const RC_EVENTS = ["initial_purchase", "renewal", "cancellation", "expiration"];

function StatusBadge({ log }: { log: DeliveryLog }) {
  if (log.status === "processed") return <Badge variant="secondary">processed</Badge>;
  if (log.status === "received") return <Badge variant="outline">received</Badge>;
  return <Badge variant="destructive">{log.status}</Badge>;
}

export default function AdminWebhookLogs() {
  const { user } = useAuth();
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  // Harness state
  const [hProvider, setHProvider] = useState<"paddle" | "revenuecat">("paddle");
  const [hEnv, setHEnv] = useState<"sandbox" | "live">("sandbox");
  const [hEvent, setHEvent] = useState(PADDLE_EVENTS[0]);
  const [raw, setRaw] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);

  const events_ = useQuery({
    queryKey: ["admin-webhook-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("id, provider, environment, event_id, event_type, state, attempts, user_id, last_error, write_results, processed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryEvent[];
    },
    refetchInterval: 30_000,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-webhook-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_delivery_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryLog[];
    },
  });

  const logs = useMemo(
    () => (data ?? []).filter(
      (l) => (providerFilter === "all" || l.provider === providerFilter)
        && (statusFilter === "all" || l.status === statusFilter),
    ),
    [data, providerFilter, statusFilter],
  );

  const summary = useMemo(() => {
    const total = logs.length;
    const failed = logs.filter((l) => l.status === "failed" || l.status === "rejected").length;
    const badSig = logs.filter((l) => l.signature_valid === false).length;
    return { total, failed, badSig, ok: total - failed };
  }, [logs]);

  const callHarness = async (action: "sample" | "sign" | "verify") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("webhook-harness", {
        body: {
          action,
          provider: hProvider,
          environment: hEnv,
          eventType: hEvent,
          raw: raw || undefined,
          signature: signature || undefined,
        },
      });
      if (error) throw error;
      const payload = data as Record<string, unknown>;
      if (action === "sample") {
        setRaw(String(payload.raw ?? ""));
        setSignature("");
        setResult(null);
        toast.success("Test payload generated");
      } else if (action === "sign") {
        if (payload.configured === false) {
          toast.error(String(payload.message ?? "Secret not configured"));
        } else {
          setSignature(String(payload.value ?? ""));
          toast.success("Payload signed");
        }
        setResult(payload);
      } else {
        setResult(payload);
        if (payload.valid) toast.success("Signature verified");
        else toast.error("Signature did not verify");
      }
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Harness request failed");
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!logs.length) {
      toast.error("Nothing to export.");
      return;
    }
    setExporting(true);
    try {
      const manifest = await downloadCsvWithManifest({
        basename: `gradr-webhook-deliveries-${format(new Date(), "yyyyMMdd-HHmm")}`,
        dataset: "webhook_delivery_logs",
        rows: logs as unknown as Record<string, unknown>[],
        columns: COLUMNS as string[],
        exportedBy: user?.email ?? user?.id ?? "unknown-admin",
        filters: { provider: providerFilter, status: statusFilter },
      });
      toast.success(`Exported ${manifest.row_count} deliveries`, {
        description: `SHA-256 ${manifest.sha256.slice(0, 16)}…`,
      });
    } finally {
      setExporting(false);
    }
  };

  const events = hProvider === "paddle" ? PADDLE_EVENTS : RC_EVENTS;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 pt-6 sm:px-6">
      <PageHeader
        eyebrow="Billing operations"
        title="Webhook deliveries"
        description="Every Paddle and RevenueCat delivery, its signature verdict, and a harness for testing payloads safely."
        icon={<Webhook className="h-5 w-5" aria-hidden="true" />}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Deliveries", value: summary.total, tone: "text-foreground" },
          { label: "Succeeded", value: summary.ok, tone: "text-success" },
          { label: "Failed", value: summary.failed, tone: summary.failed ? "text-destructive" : "text-foreground" },
          { label: "Bad signatures", value: summary.badSig, tone: summary.badSig ? "text-destructive" : "text-foreground" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
            {isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : (
              <p className={cn("mt-1 text-3xl font-semibold tabular-nums", s.tone)}>{s.value}</p>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Event processing &amp; write results</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              What each provider event actually wrote — entitlement upserts, credit grants, purchase rows and
              lifecycle emails — with the error text when a write failed.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void events_.refetch()}>
            <RefreshCw className={cn("h-4 w-4", events_.isFetching && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {events_.isLoading ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (events_.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No provider events recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60">
            {(events_.data ?? []).map((e) => {
              const writes = Array.isArray(e.write_results) ? e.write_results : [];
              const failedWrites = writes.filter((w) => !w.ok);
              const open = expanded === e.id;
              return (
                <li key={e.id} className="py-3">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                    onClick={() => setExpanded(open ? null : e.id)}
                    aria-expanded={open}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {e.event_type ?? "unknown event"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })} · {e.environment ?? "—"} ·{" "}
                        {e.event_id}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{writes.length} writes</Badge>
                      {failedWrites.length > 0 && (
                        <Badge variant="destructive">{failedWrites.length} failed</Badge>
                      )}
                      <Badge
                        variant={
                          e.state === "processed" ? "secondary" : e.state === "failed" ? "destructive" : "outline"
                        }
                      >
                        {e.state}
                      </Badge>
                    </span>
                  </button>

                  {open && (
                    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                      {e.last_error && (
                        <p className="text-xs text-destructive">Handler error: {e.last_error}</p>
                      )}
                      {e.user_id && (
                        <p className="text-xs text-muted-foreground">User: {e.user_id}</p>
                      )}
                      {writes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No entitlement or credit writes were attempted for this event.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {writes.map((w, i) => (
                            <li key={`${e.id}-${i}`} className="flex items-start gap-2 text-xs">
                              {w.ok
                                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                                : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />}
                              <span className="min-w-0">
                                <span className="font-medium text-foreground">{w.op}</span>{" "}
                                <span className="text-muted-foreground">→ {w.table}</span>
                                {w.detail && (
                                  <span className="block break-all text-muted-foreground">
                                    {JSON.stringify(w.detail)}
                                  </span>
                                )}
                                {w.error && <span className="block text-destructive">{w.error}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="h-4 w-4 text-primary" aria-hidden="true" /> Test payload &amp; signature harness
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Generates a provider-shaped payload, signs it with the configured secret and verifies it using the exact
          algorithm the live handler runs. Payloads are never replayed into production handlers.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="h-provider" className="text-xs text-muted-foreground">Provider</Label>
            <Select value={hProvider} onValueChange={(v) => { setHProvider(v as "paddle" | "revenuecat"); setHEvent(v === "paddle" ? PADDLE_EVENTS[0] : RC_EVENTS[0]); }}>
              <SelectTrigger id="h-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paddle">Paddle</SelectItem>
                <SelectItem value="revenuecat">RevenueCat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="h-env" className="text-xs text-muted-foreground">Environment</Label>
            <Select value={hEnv} onValueChange={(v) => setHEnv(v as "sandbox" | "live")}>
              <SelectTrigger id="h-env"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="h-event" className="text-xs text-muted-foreground">Event type</Label>
            <Select value={hEvent} onValueChange={setHEvent}>
              <SelectTrigger id="h-event"><SelectValue /></SelectTrigger>
              <SelectContent>
                {events.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="h-raw" className="text-xs text-muted-foreground">Payload (raw JSON body)</Label>
          <Textarea
            id="h-raw"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder="Generate a sample payload, or paste one captured from the provider dashboard."
          />
        </div>

        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="h-sig" className="text-xs text-muted-foreground">Signature header</Label>
          <Input
            id="h-sig"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            className="font-mono text-xs"
            placeholder="ts=...;h1=..."
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => callHarness("sample")} disabled={busy}>Generate payload</Button>
          <Button variant="outline" onClick={() => callHarness("sign")} disabled={busy || !raw}>Sign</Button>
          <Button onClick={() => callHarness("verify")} disabled={busy || !raw || !signature}>
            <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" /> Verify signature
          </Button>
        </div>

        {result && (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by provider"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            <SelectItem value="paddle">Paddle</SelectItem>
            <SelectItem value="revenuecat">RevenueCat</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" /> Refresh
        </Button>
        <Button onClick={onExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV + manifest
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Webhook delivery log</caption>
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">When</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Provider</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Event</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Signature</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Status</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-6"><Skeleton className="h-6 w-full" /></td></tr>
              )}
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No deliveries recorded yet. Run the harness above or wait for the next provider event.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-2">
                    {l.provider}
                    <span className="ml-1 text-xs text-muted-foreground">{l.environment}</span>
                    {l.source === "test" && <Badge variant="outline" className="ml-2">test</Badge>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{l.event_type ?? "—"}</span>
                    {l.event_id && <span className="block font-mono text-[11px] text-muted-foreground">{l.event_id}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {l.signature_valid === true && (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> valid
                      </span>
                    )}
                    {l.signature_valid === false && (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> {l.verification_error ?? "invalid"}
                      </span>
                    )}
                    {l.signature_valid === null && <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2"><StatusBadge log={l} /></td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {l.duration_ms ? `${l.duration_ms} ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
