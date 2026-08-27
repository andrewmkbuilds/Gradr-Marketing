import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
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
import { cn } from "@/lib/utils";
import {
  MCP_CLIENTS,
  clearProfile,
  loadChecklist,
  loadProfile,
  maskMcpUrl,
  saveChecklist,
  saveProfile,
  testMcpConnection,
  validateMcpUrl,
  type ConnectionTestResult,
  type McpClientId,
  type McpConnectionProfile,
} from "@/lib/mcp/connectionProfile";

const APP_NAME = "Gradr";
const SERVER_SLUG = "gradr";

/** Derive the public MCP endpoint from the browser-reachable backend URL. */
function resolveMcpUrl(): string {
  const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseUrl = new URL(configuredSupabaseUrl);
  const authority = configuredSupabaseUrl.match(/^https?:\/\/([^/?#]*)/i)?.[1];
  const loopbackAuthority = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(
    authority ?? "",
  );
  if (
    !authority ||
    authority.includes("@") ||
    configuredSupabaseUrl.includes("?") ||
    configuredSupabaseUrl.includes("#") ||
    (supabaseUrl.protocol === "http:" && !loopbackAuthority)
  ) {
    throw new Error(
      "VITE_SUPABASE_URL must use HTTPS unless it targets localhost or a loopback IP, and must not contain credentials, query, or fragment",
    );
  }
  const legacyLovableCloud =
    supabaseUrl.hostname.endsWith(".lovable.cloud") && !supabaseUrl.hostname.startsWith("c--");
  const dataPlaneUrl = legacyLovableCloud
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : supabaseUrl.toString().replace(/\/+$/, "");
  return `${dataPlaneUrl}/functions/v1/mcp`;
}

function CopyButton({
  value,
  label,
  variant = "outline",
}: {
  value: string;
  label: string;
  variant?: "outline" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size="md"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="ml-5 list-decimal space-y-2 text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="text-body-sm">
          {item}
        </li>
      ))}
    </ol>
  );
}

const CHECKLIST: { id: string; title: string; detail: string }[] = [
  {
    id: "url",
    title: "Confirm your server URL",
    detail: "Paste or keep the URL below and make sure it validates.",
  },
  {
    id: "test",
    title: "Test the connection",
    detail: "Run the reachability check so you know the endpoint answers before you add it.",
  },
  {
    id: "save",
    title: "Save your connection",
    detail: "Store the URL and your assistant so this page is ready next time.",
  },
  {
    id: "add",
    title: "Add the connector in your assistant",
    detail: "Follow the steps for your assistant below and finish any sign-in prompt.",
  },
  {
    id: "verify",
    title: "Run a tool",
    detail: `Ask your assistant to use ${APP_NAME} and confirm it returns your data.`,
  },
];

export default function Connect() {
  const defaultUrl = useMemo(() => {
    try {
      return resolveMcpUrl();
    } catch {
      return "";
    }
  }, []);

  const [profile, setProfile] = useState<McpConnectionProfile | null>(null);
  const [urlInput, setUrlInput] = useState(defaultUrl);
  const [urlTouched, setUrlTouched] = useState(false);
  const [tab, setTab] = useState<McpClientId>("ChatGPT");
  const [revealed, setRevealed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore the saved profile and checklist progress on first paint.
  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      setProfile(saved);
      setUrlInput(saved.url);
      setTab(saved.client);
    }
    setDone(loadChecklist());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveChecklist(done);
  }, [done, hydrated]);

  const validation = validateMcpUrl(urlInput);
  const mcpUrl = validation.ok ? validation.url : "";
  const displayUrl = mcpUrl ? (revealed ? mcpUrl : maskMcpUrl(mcpUrl)) : "";
  const isSaved = Boolean(profile && profile.url === mcpUrl && profile.client === tab);

  const markDone = (id: string) => setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const toggleDone = (id: string) =>
    setDone((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  useEffect(() => {
    if (validation.ok) markDone("url");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.ok]);

  const claudeUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(
    APP_NAME,
  )}&connectorUrl=${encodeURIComponent(mcpUrl)}`;
  const claudeCodeCmd = `claude mcp add --scope user --transport http ${SERVER_SLUG} '${mcpUrl.replace(
    /'/g,
    "'\\''",
  )}'`;

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const result = await testMcpConnection(mcpUrl);
    setTestResult(result);
    setTesting(false);
    if (result.state !== "error") markDone("test");
  }

  const connectSteps: Record<McpClientId, React.ReactNode[]> = {
    ChatGPT: [
      <>
        Open{" "}
        <a
          className="link-tap text-foreground underline"
          href="https://chatgpt.com/#settings/Connectors/Advanced"
          target="_blank"
          rel="noreferrer"
        >
          ChatGPT settings → Apps (Advanced)
        </a>{" "}
        and turn on Developer mode, reading the risk notice shown there. If it isn't available, ask
        a ChatGPT admin to enable it.
      </>,
      <>
        Open the{" "}
        <a
          className="link-tap text-foreground underline"
          href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins"
          target="_blank"
          rel="noreferrer"
        >
          New plugin dialog
        </a>
        .
      </>,
      <>
        Enter <strong className="text-foreground">{APP_NAME}</strong> as the name and paste the
        server URL above into the URL field.
      </>,
      <>
        Review the details, tick “I understand and want to continue” (ChatGPT shows this for every
        custom server), then click Create.
      </>,
      <>Enable {APP_NAME} from the chat composer and ask ChatGPT to use it.</>,
    ],
    Claude: [
      <>
        Open the{" "}
        <a className="link-tap text-foreground underline" href={claudeUrl} target="_blank" rel="noreferrer">
          prefilled custom connector dialog
        </a>{" "}
        in Claude.
      </>,
      <>Review the details and click Add.</>,
      <>
        If the prefilled form doesn't open, go to Claude's Connectors page, choose “Add custom
        connector”, name it {APP_NAME} and paste the server URL above.
      </>,
      <>Enable the connector from the chat composer and ask Claude to use it.</>,
    ],
    "Claude Code": [
      <>Run the install command below in a terminal.</>,
      <>
        Start Claude Code and run <code className="text-foreground">/mcp</code> to confirm {APP_NAME}{" "}
        is connected — sign in from that menu when prompted.
      </>,
      <>Ask Claude Code to use {APP_NAME}.</>,
    ],
    "Other assistants": [
      <>Open your assistant's MCP server or custom connector settings.</>,
      <>Create a remote MCP server connection.</>,
      <>Name it {APP_NAME} and paste the server URL above.</>,
      <>Finish any sign-in or authorization prompts.</>,
      <>Enable the connection, then ask the assistant to use {APP_NAME}.</>,
    ],
  };

  const refreshSteps: Record<McpClientId, React.ReactNode[]> = {
    ChatGPT: [
      <>Open ChatGPT's Plugins page and select {APP_NAME}.</>,
      <>Scroll to “Information” and click Refresh.</>,
      <>
        ChatGPT can't change an existing app's URL — if the URL above changed, delete the app and
        connect it again.
      </>,
      <>Start a new chat and ask ChatGPT to use {APP_NAME}.</>,
    ],
    Claude: [
      <>Open the Connectors page and select the {APP_NAME} connector.</>,
      <>Refresh or update the connector's tools.</>,
      <>
        Claude can't change an existing connector's URL — if the URL above changed, remove the
        connector and add it again.
      </>,
      <>Ask Claude to use {APP_NAME}.</>,
    ],
    "Claude Code": [
      <>Start a new Claude Code session — it loads the latest tools when it connects.</>,
      <>
        If the URL changed, run <code className="text-foreground">claude mcp remove {SERVER_SLUG}</code>{" "}
        and run the install command again.
      </>,
      <>Ask Claude Code to use {APP_NAME}.</>,
    ],
    "Other assistants": [
      <>Open your assistant's MCP server or connector settings.</>,
      <>Select the connection you created for {APP_NAME}.</>,
      <>Refresh the tool list, reload the server, or reconnect it.</>,
      <>If the URL changed, paste the latest one from above.</>,
      <>Start a new chat and ask the assistant to use {APP_NAME}.</>,
    ],
  };

  const completed = CHECKLIST.filter((item) => done.includes(item.id)).length;

  return (
    <PublicShell source="connect">
      <div className="section-y-sm mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Text as="h1" variant="h1">
            Connect {APP_NAME} to your AI assistant
          </Text>
          <Text variant="lead" className="text-muted-foreground">
            Add {APP_NAME} as a connector in ChatGPT, Claude or any assistant that supports remote
            MCP servers. Once connected, the assistant can work with your resumes, job matches and
            pipeline on your behalf.
          </Text>
        </header>

        {/* Guided checklist ------------------------------------------------ */}
        <Card variant="raised" padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Setup checklist</CardTitle>
              <CardDescription>
                Your progress is remembered on this device, so you can pick up where you left off.
              </CardDescription>
            </div>
            <Badge variant={completed === CHECKLIST.length ? "primary" : "outline"}>
              {completed} of {CHECKLIST.length} done
            </Badge>
          </div>

          <ul className="space-y-2">
            {CHECKLIST.map((item) => {
              const checked = done.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleDone(item.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-control border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      checked ? "border-primary bg-primary/5" : "border-border hover:bg-surface-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                      aria-hidden="true"
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="space-y-1">
                      <Text
                        variant="body-sm"
                        className={cn(checked ? "text-foreground" : "text-foreground")}
                      >
                        {item.title}
                      </Text>
                      <Text variant="caption" className="block text-muted-foreground">
                        {item.detail}
                      </Text>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Server URL ------------------------------------------------------ */}
        <Card variant="raised" padding="lg" className="space-y-5">
          <div className="space-y-1">
            <CardTitle>Your MCP server</CardTitle>
            <CardDescription>
              Save the endpoint and the assistant you use so reconnecting later takes one glance.
            </CardDescription>
          </div>

          <FormField
            label="Server URL"
            help="Must be an https:// endpoint — usually ending in /functions/v1/mcp."
            error={urlTouched && !validation.ok ? validation.error : undefined}
          >
            {(control) => (
              <Input
                {...control}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://example.supabase.co/functions/v1/mcp"
                value={urlInput}
                onChange={(event) => {
                  setUrlInput(event.target.value);
                  setUrlTouched(true);
                  setTestResult(null);
                }}
              />
            )}
          </FormField>

          <FormField label="Assistant" help="We'll show the matching setup steps below.">
            {(control) => (
              <select
                {...control}
                value={tab}
                onChange={(event) => setTab(event.target.value as McpClientId)}
                className="h-10 w-full rounded-control border border-border bg-surface px-3 text-body-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MCP_CLIENTS.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          {mcpUrl && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="flex-1 overflow-x-auto rounded-control border border-border bg-surface-muted px-4 py-3 text-code text-foreground">
                  {displayUrl}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={revealed ? "Hide the full server URL" : "Reveal the full server URL"}
                  onClick={() => setRevealed((value) => !value)}
                >
                  {revealed ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={mcpUrl} label="Copy URL" />
                <CopyButton value={maskMcpUrl(mcpUrl)} label="Copy masked" variant="ghost" />
              </div>
              <Text variant="caption" className="block text-muted-foreground">
                The project identifier is hidden by default. “Copy masked” is safe to paste into a
                screenshot or a support thread; your assistant needs the full URL.
              </Text>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" disabled={!mcpUrl || testing} onClick={runTest}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button
              type="button"
              disabled={!mcpUrl || isSaved}
              onClick={() => {
                const saved = saveProfile(mcpUrl, tab);
                if (saved) {
                  setProfile(saved);
                  markDone("save");
                }
              }}
            >
              {isSaved ? "Saved" : "Save connection"}
            </Button>
            {profile && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearProfile();
                  setProfile(null);
                  setUrlInput(defaultUrl);
                  setTestResult(null);
                }}
              >
                Forget
              </Button>
            )}
          </div>

          {profile && (
            <Text variant="caption" className="block text-muted-foreground">
              Saved for {profile.client} on {new Date(profile.savedAt).toLocaleString()}.
            </Text>
          )}

          <div aria-live="polite">
            {testing && (
              <Text variant="body-sm" className="text-muted-foreground">
                Contacting your MCP server…
              </Text>
            )}
            {!testing && testResult && (
              <Alert
                variant={
                  testResult.state === "error"
                    ? "danger"
                    : testResult.state === "warning"
                      ? "info"
                      : "primary"
                }
                title={testResult.title}
              >
                <span className="flex items-start gap-2">
                  {testResult.state === "error" || testResult.state === "warning" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{testResult.detail}</span>
                </span>
              </Alert>
            )}
          </div>
        </Card>

        {/* Per-assistant instructions -------------------------------------- */}
        <div className="space-y-4">
          <Text as="h2" variant="h3">
            Connect your assistant
          </Text>

          <div role="tablist" aria-label="Assistant" className="flex flex-wrap gap-2">
            {MCP_CLIENTS.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={tab === c}
                onClick={() => setTab(c)}
                className={cn(
                  "rounded-control border px-4 py-2 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <Card variant="outline" padding="lg" className="space-y-6">
            <div className="space-y-3">
              <CardTitle>Connect with {tab}</CardTitle>
              <Steps items={connectSteps[tab]} />
              {tab === "Claude Code" && mcpUrl && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="flex-1 overflow-x-auto rounded-control border border-border bg-surface-muted px-4 py-3 text-code text-foreground">
                    {claudeCodeCmd}
                  </code>
                  <CopyButton value={claudeCodeCmd} label="Copy command" />
                </div>
              )}
              {tab === "Claude" && mcpUrl && (
                <a
                  className="link-tap inline-flex items-center gap-1 text-body-sm text-foreground underline"
                  href={claudeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Claude with the details prefilled
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-6">
              <CardTitle>Refresh after {APP_NAME} changes</CardTitle>
              <CardDescription>
                Assistants cache the tool list, so refresh the connection after we ship updates.
              </CardDescription>
              <Steps items={refreshSteps[tab]} />
            </div>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
