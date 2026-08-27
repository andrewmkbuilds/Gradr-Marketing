/**
 * Client-side helpers for the public Connect page: validating an MCP server
 * URL, masking its identifying parts for display, remembering the visitor's
 * saved connection profile, and tracking onboarding checklist progress.
 *
 * Everything here is stored in the browser only (this is the marketing
 * surface — there is no account or backend session on this host).
 */

export const MCP_CLIENTS = ["ChatGPT", "Claude", "Claude Code", "Other assistants"] as const;
export type McpClientId = (typeof MCP_CLIENTS)[number];

export function isMcpClientId(value: unknown): value is McpClientId {
  return typeof value === "string" && (MCP_CLIENTS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type UrlValidation = { ok: true; url: string } | { ok: false; error: string };

const LOOPBACK = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i;

/**
 * Accepts an HTTPS MCP endpoint (or a loopback HTTP one for local testing).
 * Rejects embedded credentials, fragments and non-HTTP protocols, and
 * normalises away trailing slashes so saved values compare cleanly.
 */
export function validateMcpUrl(raw: string): UrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter your MCP server URL." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That isn't a valid URL — include https:// at the start." };
  }

  const loopback = LOOPBACK.test(parsed.host);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    return { ok: false, error: "The server URL must use https:// (http:// is only for localhost)." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Remove the username or password from the URL — MCP signs in separately." };
  }
  if (parsed.hash) {
    return { ok: false, error: "Remove the # fragment from the URL." };
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return { ok: true, url: parsed.toString().replace(/\/$/, parsed.pathname === "/" ? "/" : "") };
}

/* ------------------------------------------------------------------ */
/* Masking                                                             */
/* ------------------------------------------------------------------ */

function maskSegment(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length);
  return `${value.slice(0, 2)}${"•".repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

/**
 * Hides the parts of an MCP URL that identify the project — the first host
 * label (the backend project ref) and any query-string secret — so the URL
 * can be shown in a screenshot or shared with support safely.
 */
export function maskMcpUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }

  const labels = parsed.hostname.split(".");
  if (labels.length > 2 && labels[0]) {
    labels[0] = maskSegment(labels[0]);
  } else if (labels[0]) {
    labels[0] = maskSegment(labels[0]);
  }
  const host = labels.join(".");

  const params = new URLSearchParams(parsed.search);
  for (const key of Array.from(params.keys())) {
    params.set(key, maskSegment(params.get(key) ?? ""));
  }
  const query = params.toString() ? `?${decodeURIComponent(params.toString())}` : "";
  const port = parsed.port ? `:${parsed.port}` : "";

  return `${parsed.protocol}//${host}${port}${parsed.pathname}${query}`;
}

/* ------------------------------------------------------------------ */
/* Saved profile                                                       */
/* ------------------------------------------------------------------ */

export interface McpConnectionProfile {
  url: string;
  client: McpClientId;
  savedAt: string;
}

const PROFILE_KEY = "gradr.mcp.profile";
const CHECKLIST_KEY = "gradr.mcp.checklist";

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadProfile(): McpConnectionProfile | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<McpConnectionProfile>;
    const validated = validateMcpUrl(String(parsed.url ?? ""));
    if (!validated.ok || !isMcpClientId(parsed.client)) return null;
    return {
      url: validated.url,
      client: parsed.client,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveProfile(url: string, client: McpClientId): McpConnectionProfile | null {
  const validated = validateMcpUrl(url);
  if (!validated.ok) return null;
  const profile: McpConnectionProfile = {
    url: validated.url,
    client,
    savedAt: new Date().toISOString(),
  };
  try {
    safeStorage()?.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable — the page still works, it just won't remember */
  }
  return profile;
}

export function clearProfile(): void {
  try {
    safeStorage()?.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Checklist progress                                                  */
/* ------------------------------------------------------------------ */

export function loadChecklist(): string[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(CHECKLIST_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function saveChecklist(ids: string[]): void {
  try {
    safeStorage()?.setItem(CHECKLIST_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Connection test                                                     */
/* ------------------------------------------------------------------ */

export type ConnectionTestState = "idle" | "testing" | "reachable" | "auth" | "warning" | "error";

export interface ConnectionTestResult {
  state: Exclude<ConnectionTestState, "idle" | "testing">;
  title: string;
  detail: string;
}

const TIMEOUT_MS = 10_000;

/**
 * Probes the endpoint with a real MCP `initialize` call. A 401 is a healthy
 * result for a protected server — it proves the endpoint exists and is
 * asking the assistant to sign in.
 */
export async function testMcpConnection(rawUrl: string): Promise<ConnectionTestResult> {
  const validated = validateMcpUrl(rawUrl);
  if (!validated.ok) {
    return { state: "error", title: "Invalid URL", detail: validated.error };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(validated.url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "gradr-connect-page", version: "1.0.0" },
        },
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        state: "auth",
        title: "Server reachable — sign-in required",
        detail:
          "The server answered and asked for authorization. That's expected: your assistant will prompt you to sign in when you add the connector.",
      };
    }
    if (response.ok || response.status === 202) {
      return {
        state: "reachable",
        title: "Server reachable",
        detail: "The MCP endpoint responded to a handshake. You're ready to add it to your assistant.",
      };
    }
    if (response.status === 404) {
      return {
        state: "error",
        title: "Not found (404)",
        detail: "Nothing is served at that path. Check the URL ends with /functions/v1/mcp.",
      };
    }
    if (response.status >= 500) {
      return {
        state: "error",
        title: `Server error (${response.status})`,
        detail: "The endpoint exists but returned an error. Try again in a moment.",
      };
    }
    return {
      state: "warning",
      title: `Unexpected response (${response.status})`,
      detail:
        "The endpoint answered but not with an MCP handshake. It may still work in your assistant — try adding it.",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        state: "error",
        title: "Timed out",
        detail: "The server didn't respond within 10 seconds. Check the URL and that the server is running.",
      };
    }
    return {
      state: "warning",
      title: "Couldn't reach the server from this page",
      detail:
        "The request was blocked — usually a browser CORS restriction rather than a broken server. Your assistant connects from its own backend, so it may still work.",
    };
  } finally {
    clearTimeout(timer);
  }
}
