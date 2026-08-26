import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw, ShieldAlert } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  FormField,
  Input,
  Text,
} from "@/design-system/gradr-9b9b95";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

type PreviewTemplate = {
  templateName: string;
  displayName: string;
  version: string;
  subject: string;
  html: string;
  status: "ready" | "render_failed";
  errorMessage?: string;
};

type LogRow = {
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type LogResponse = {
  rows: LogRow[];
  stats: Record<string, number>;
  templates: { templateName: string; displayName: string; version: string }[];
};

const RANGE_OPTIONS = [
  { label: "24 hours", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

type BadgeTone = "primary" | "danger" | "accent" | "neutral" | "outline";

const STATUS_TONE: Record<string, BadgeTone> = {
  sent: "primary",
  dlq: "danger",
  failed: "danger",
  bounced: "danger",
  complained: "danger",
  suppressed: "accent",
  pending: "outline",
};

function statusVariant(status: string): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Internal marketing email console: preview every marketing template and read the
 * deduplicated send log (recipient, template version, delivery status).
 *
 * Auth emails are deliberately absent — sign-up, magic link, recovery, invite,
 * email change and verification codes are sent by the app.gradr.me project and
 * are never registered on this surface.
 */
export default function MarketingEmailOps() {
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<"log" | "previews">("log");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogResponse | null>(null);
  const [previews, setPreviews] = useState<PreviewTemplate[] | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [templateFilter, setTemplateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke("marketing-email-admin", {
      body,
    });
    if (fnError) throw new Error(data?.error ?? fnError.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLog(
        await call({
          action: "log",
          days,
          templateName: templateFilter || undefined,
          status: statusFilter || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load send log");
    } finally {
      setLoading(false);
    }
  }, [call, days, templateFilter, statusFilter]);

  const loadPreviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await call({ action: "previews" });
      setPreviews(data.templates ?? []);
      setSelectedPreview((current) => current ?? data.templates?.[0]?.templateName ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render previews");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    if (!signedIn) return;
    if (tab === "log") void loadLog();
    else void loadPreviews();
  }, [signedIn, tab, loadLog, loadPreviews]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setAuthError("Those credentials did not work.");
    setAuthBusy(false);
  };

  const active = useMemo(
    () => previews?.find((p) => p.templateName === selectedPreview) ?? null,
    [previews, selectedPreview],
  );

  if (!sessionReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Seo title="Marketing email console" description="Internal Gradr tool." path="/ops/marketing-emails" noindex />
        <Card className="w-full max-w-md p-8">
          <CardTitle>Marketing email console</CardTitle>
          <CardDescription>Admin access only. Sign in to continue.</CardDescription>
          <form className="mt-6 space-y-4" onSubmit={signIn}>
            <FormField label="Email" required>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Password" required>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </FormField>
            {authError ? <Alert variant="danger">{authError}</Alert> : null}
            <Button type="submit" disabled={authBusy} className="w-full">
              {authBusy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-background px-6 py-12">
      <Seo title="Marketing email console" description="Internal Gradr tool." path="/ops/marketing-emails" noindex />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Text as="h1" variant="h2">
            Marketing emails
          </Text>
          <Text variant="body-sm" tone="muted">
            Preview marketing templates and review delivery for gradr.me sends. Auth emails are
            owned by app.gradr.me and never appear here.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "log" ? "primary" : "outline"}
            onClick={() => setTab("log")}
          >
            Send log
          </Button>
          <Button
            variant={tab === "previews" ? "primary" : "outline"}
            onClick={() => setTab("previews")}
          >
            Previews
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="danger" className="mt-6">
          <ShieldAlert className="size-4" aria-hidden /> {error}
        </Alert>
      ) : null}

      {tab === "log" ? (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.days}
                  size="sm"
                  variant={days === option.days ? "primary" : "outline"}
                  onClick={() => setDays(option.days)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by template">
              <Button
                size="sm"
                variant={templateFilter === "" ? "primary" : "outline"}
                onClick={() => setTemplateFilter("")}
              >
                All templates
              </Button>
              {log?.templates.map((t) => (
                <Button
                  key={t.templateName}
                  size="sm"
                  variant={templateFilter === t.templateName ? "primary" : "outline"}
                  onClick={() => setTemplateFilter(t.templateName)}
                >
                  {t.displayName}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={statusFilter === option.value ? "primary" : "outline"}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => void loadLog()} disabled={loading}>
              <RefreshCw className="size-4" aria-hidden /> Refresh
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {["total", "sent", "pending", "dlq"].map((key) => (
              <Card key={key} className="p-5">
                <Text variant="overline" tone="muted">
                  {key === "dlq" ? "Failed" : key}
                </Text>
                <Text variant="h3">{log?.stats?.[key] ?? 0}</Text>
              </Card>
            ))}
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Template", "Version", "Recipient", "Status", "Sent"].map((h) => (
                    <th key={h} className="px-5 py-3">
                      <Text variant="caption" tone="muted">
                        {h}
                      </Text>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                    </td>
                  </tr>
                ) : log?.rows.length ? (
                  log.rows.map((row) => (
                    <tr key={`${row.message_id}-${row.created_at}`} className="border-b border-border">
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.template_name}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm" tone="muted">
                          {String(row.metadata?.template_version ?? "—")}
                        </Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.recipient_email}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        {row.error_message ? (
                          <Text variant="caption" tone="muted">
                            {row.error_message}
                          </Text>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm" tone="muted">
                          {formatDate(row.created_at)}
                        </Text>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <Text variant="body-sm" tone="muted">
                        <Mail className="mx-auto mb-2 size-5" aria-hidden />
                        No marketing emails in this range.
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>
      ) : (
        <section className="mt-8 grid gap-6 lg:grid-cols-4">
          <nav aria-label="Marketing templates" className="space-y-2 lg:col-span-1">
            {previews?.map((preview) => (
              <button
                key={preview.templateName}
                type="button"
                onClick={() => setSelectedPreview(preview.templateName)}
                className={`w-full rounded-control border px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedPreview === preview.templateName
                    ? "border-primary bg-surface-muted"
                    : "border-border bg-surface"
                }`}
                aria-current={selectedPreview === preview.templateName}
              >
                <Text variant="body-sm">{preview.displayName}</Text>
                <Text variant="caption" tone="muted">
                  v{preview.version}
                </Text>
              </button>
            ))}
          </nav>

          <Card className="p-0 lg:col-span-3">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : active ? (
              active.status === "render_failed" ? (
                <Alert variant="danger" className="m-6">
                  {active.errorMessage ?? "This template failed to render."}
                </Alert>
              ) : (
                <div>
                  <div className="border-b border-border px-6 py-4">
                    <Text variant="body-sm" tone="muted">
                      Subject
                    </Text>
                    <Text variant="body">{active.subject}</Text>
                  </div>
                  <iframe
                    title={`${active.displayName} preview`}
                    srcDoc={active.html}
                    className="h-screen w-full rounded-b-card border-0 bg-surface"
                  />
                </div>
              )
            ) : (
              <div className="p-6">
                <Text variant="body-sm" tone="muted">
                  Select a template to preview it.
                </Text>
              </div>
            )}
          </Card>
        </section>
      )}
    </main>
  );
}
