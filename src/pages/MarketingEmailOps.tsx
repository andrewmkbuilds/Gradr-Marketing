import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { SpatialLoader } from "@/components/three-d";
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

type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  topic: string | null;
  source: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  lastEmail: { templateName: string; status: string; createdAt: string } | null;
  followupsPending: number;
  followupsSent: number;
  nextFollowupAt: string | null;
};

type SubscriberResponse = {
  rows: SubscriberRow[];
  stats: Record<string, number>;
};

type EngagementResponse = {
  templates: {
    templateName: string;
    displayName: string;
    sent: number;
    opens: number;
    clicks: number;
    openRate: number | null;
    clickRate: number | null;
  }[];
  events: {
    message_id: string;
    template_name: string;
    recipient_email: string;
    event_type: "open" | "click";
    target_url: string | null;
    created_at: string;
  }[];
};

const SUBSCRIBER_STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending confirm", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Unsubscribed", value: "unsubscribed" },
];

const SUBSCRIBER_TONE: Record<string, BadgeTone> = {
  confirmed: "primary",
  pending: "outline",
  unsubscribed: "accent",
};

const RANGE_OPTIONS = [
  { label: "24 hours", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

type BadgeTone = "primary" | "danger" | "accent" | "neutral" | "outline";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Sent", value: "sent" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "dlq" },
  { label: "Suppressed", value: "suppressed" },
];

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

function formatRate(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

/** Download the current subscriber view without leaving the console. */
function downloadFile(filename: string, mime: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: SubscriberRow[]): string {
  const headers = [
    "email",
    "first_name",
    "topic",
    "source",
    "status",
    "created_at",
    "confirmed_at",
    "unsubscribed_at",
    "last_email_template",
    "last_email_status",
    "last_email_at",
    "followups_sent",
    "followups_pending",
    "next_followup_at",
  ];
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    // Guard against spreadsheet formula injection in exported cells.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((row) =>
    [
      row.email,
      row.first_name,
      row.topic,
      row.source,
      row.status,
      row.created_at,
      row.confirmed_at,
      row.unsubscribed_at,
      row.lastEmail?.templateName ?? null,
      row.lastEmail?.status ?? null,
      row.lastEmail?.createdAt ?? null,
      row.followupsSent,
      row.followupsPending,
      row.nextFollowupAt,
    ]
      .map(escape)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
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

  const [tab, setTab] = useState<"log" | "subscribers" | "engagement" | "previews">("log");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogResponse | null>(null);
  const [previews, setPreviews] = useState<PreviewTemplate[] | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [templateFilter, setTemplateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [subscribers, setSubscribers] = useState<SubscriberResponse | null>(null);
  const [subscriberStatus, setSubscriberStatus] = useState<string>("");
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [engagement, setEngagement] = useState<EngagementResponse | null>(null);

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

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubscribers(
        await call({
          action: "subscribers",
          days,
          status: subscriberStatus || undefined,
          search: subscriberSearch || undefined,
          limit: 1000,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }, [call, days, subscriberStatus, subscriberSearch]);

  const loadEngagement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEngagement(await call({ action: "engagement", days }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load engagement");
    } finally {
      setLoading(false);
    }
  }, [call, days]);

  useEffect(() => {
    if (!signedIn) return;
    if (tab === "log") void loadLog();
    else if (tab === "subscribers") void loadSubscribers();
    else if (tab === "engagement") void loadEngagement();
    else void loadPreviews();
  }, [signedIn, tab, loadLog, loadPreviews, loadSubscribers, loadEngagement]);

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
        <SpatialLoader size={36} />
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
            variant={tab === "subscribers" ? "primary" : "outline"}
            onClick={() => setTab("subscribers")}
          >
            Subscribers
          </Button>
          <Button
            variant={tab === "engagement" ? "primary" : "outline"}
            onClick={() => setTab("engagement")}
          >
            Engagement
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
                      <SpatialLoader size={24} className="w-full justify-center" />
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
      ) : tab === "subscribers" ? (
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by subscriber status">
              {SUBSCRIBER_STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={subscriberStatus === option.value ? "primary" : "outline"}
                  onClick={() => setSubscriberStatus(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadSubscribers();
              }}
            >
              <FormField label="Search email or name">
                {(control) => (
                  <Input
                    {...control}
                    type="search"
                    value={subscriberSearch}
                    placeholder="amara@"
                    onChange={(event) => setSubscriberSearch(event.target.value)}
                  />
                )}
              </FormField>
              <Button type="submit" size="sm" variant="outline" disabled={loading}>
                <Search className="size-4" aria-hidden /> Search
              </Button>
            </form>
            <Button
              size="sm"
              variant="outline"
              disabled={!subscribers?.rows.length}
              onClick={() =>
                downloadFile(
                  `gradr-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
                  "text/csv",
                  toCsv(subscribers?.rows ?? []),
                )
              }
            >
              <Download className="size-4" aria-hidden /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!subscribers?.rows.length}
              onClick={() =>
                downloadFile(
                  `gradr-subscribers-${new Date().toISOString().slice(0, 10)}.json`,
                  "application/json",
                  JSON.stringify(subscribers?.rows ?? [], null, 2),
                )
              }
            >
              <Download className="size-4" aria-hidden /> JSON
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { key: "total", label: "Total" },
              { key: "pending", label: "Pending confirm" },
              { key: "confirmed", label: "Confirmed" },
              { key: "unsubscribed", label: "Unsubscribed" },
            ].map((stat) => (
              <Card key={stat.key} className="p-5">
                <Text variant="overline" tone="muted">
                  {stat.label}
                </Text>
                <Text variant="h3">{subscribers?.stats?.[stat.key] ?? 0}</Text>
              </Card>
            ))}
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Landing page newsletter subscribers</caption>
              <thead>
                <tr className="border-b border-border">
                  {["Email", "Status", "Signed up", "Last email sent", "Follow-ups"].map((header) => (
                    <th key={header} scope="col" className="px-5 py-3">
                      <Text variant="caption" tone="muted">
                        {header}
                      </Text>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <SpatialLoader size={24} className="w-full justify-center" />
                    </td>
                  </tr>
                ) : subscribers?.rows.length ? (
                  subscribers.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.email}</Text>
                        {row.first_name ? (
                          <Text variant="caption" tone="muted">
                            {row.first_name}
                            {row.topic ? ` · ${row.topic}` : ""}
                          </Text>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={SUBSCRIBER_TONE[row.status] ?? "neutral"}>
                          {row.status === "pending" ? "pending confirm" : row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm" tone="muted">
                          {formatDate(row.created_at)}
                        </Text>
                      </td>
                      <td className="px-5 py-3">
                        {row.lastEmail ? (
                          <>
                            <Text variant="body-sm">{row.lastEmail.templateName}</Text>
                            <Text variant="caption" tone="muted">
                              {row.lastEmail.status} · {formatDate(row.lastEmail.createdAt)}
                            </Text>
                          </>
                        ) : (
                          <Text variant="body-sm" tone="muted">
                            —
                          </Text>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">
                          {row.followupsSent} sent · {row.followupsPending} queued
                        </Text>
                        {row.nextFollowupAt ? (
                          <Text variant="caption" tone="muted">
                            next {formatDate(row.nextFollowupAt)}
                          </Text>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <Text variant="body-sm" tone="muted">
                        <Mail className="mx-auto mb-2 size-5" aria-hidden />
                        No subscribers in this range.
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>
      ) : tab === "engagement" ? (
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
            <Button variant="outline" size="sm" onClick={() => void loadEngagement()} disabled={loading}>
              <RefreshCw className="size-4" aria-hidden /> Refresh
            </Button>
          </div>

          <Text variant="body-sm" tone="muted">
            Opens are measured with a tracking pixel, so image blocking makes them a floor, not a
            count. Clicks are exact. Rates are unique recipients per delivered email.
          </Text>

          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Open and click rates per email template</caption>
              <thead>
                <tr className="border-b border-border">
                  {["Template", "Delivered", "Opens", "Open rate", "Clicks", "Click rate"].map((header) => (
                    <th key={header} scope="col" className="px-5 py-3">
                      <Text variant="caption" tone="muted">
                        {header}
                      </Text>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <SpatialLoader size={24} className="w-full justify-center" />
                    </td>
                  </tr>
                ) : engagement?.templates.length ? (
                  engagement.templates.map((row) => (
                    <tr key={row.templateName} className="border-b border-border">
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.displayName}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.sent}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.opens}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{formatRate(row.openRate)}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{row.clicks}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{formatRate(row.clickRate)}</Text>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <Text variant="body-sm" tone="muted">
                        No tracked activity in this range.
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Recent open and click events</caption>
              <thead>
                <tr className="border-b border-border">
                  {["When", "Event", "Template", "Recipient", "Link"].map((header) => (
                    <th key={header} scope="col" className="px-5 py-3">
                      <Text variant="caption" tone="muted">
                        {header}
                      </Text>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engagement?.events.length ? (
                  engagement.events.slice(0, 100).map((event, index) => (
                    <tr key={`${event.message_id}-${event.created_at}-${index}`} className="border-b border-border">
                      <td className="px-5 py-3">
                        <Text variant="body-sm" tone="muted">
                          {formatDate(event.created_at)}
                        </Text>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={event.event_type === "click" ? "primary" : "outline"}>
                          {event.event_type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{event.template_name}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="body-sm">{event.recipient_email}</Text>
                      </td>
                      <td className="px-5 py-3">
                        <Text variant="caption" tone="muted">
                          {event.target_url ?? "—"}
                        </Text>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <Text variant="body-sm" tone="muted">
                        No events yet.
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
                <SpatialLoader size={36} />
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
