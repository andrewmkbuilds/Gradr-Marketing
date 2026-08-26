import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { Button } from "@/design-system/gradr-9b9b95";
import { Card, CardDescription, CardTitle, Text } from "@/design-system/gradr-9b9b95";
import { cn } from "@/lib/utils";

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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
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

const CLIENTS = ["ChatGPT", "Claude", "Claude Code", "Other assistants"] as const;
type ClientId = (typeof CLIENTS)[number];

export default function Connect() {
  const [tab, setTab] = useState<ClientId>("ChatGPT");

  const mcpUrl = useMemo(() => {
    try {
      return resolveMcpUrl();
    } catch {
      return "";
    }
  }, []);

  const claudeUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(
    APP_NAME,
  )}&connectorUrl=${encodeURIComponent(mcpUrl)}`;
  const claudeCodeCmd = `claude mcp add --scope user --transport http ${SERVER_SLUG} '${mcpUrl.replace(
    /'/g,
    "'\\''",
  )}'`;

  const connectSteps: Record<ClientId, React.ReactNode[]> = {
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

  const refreshSteps: Record<ClientId, React.ReactNode[]> = {
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

        <Card variant="raised" padding="lg" className="space-y-4">
          <div className="space-y-1">
            <CardTitle>Server URL</CardTitle>
            <CardDescription>Paste this into your assistant's connector settings.</CardDescription>
          </div>
          {mcpUrl ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 overflow-x-auto rounded-control border border-border bg-surface-muted px-4 py-3 text-code text-foreground">
                {mcpUrl}
              </code>
              <CopyButton value={mcpUrl} label="Copy URL" />
            </div>
          ) : (
            <Text variant="body-sm" className="text-muted-foreground">
              The server URL isn't available in this environment.
            </Text>
          )}
        </Card>

        <div className="space-y-4">
          <Text as="h2" variant="h3">
            Connect your assistant
          </Text>

          <div role="tablist" aria-label="Assistant" className="flex flex-wrap gap-2">
            {CLIENTS.map((c) => (
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
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
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
