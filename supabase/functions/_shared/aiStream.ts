/**
 * Shared Server-Sent Events helpers for streamed AI generation.
 *
 * Every streamed engine speaks the same small protocol so the client can use
 * one hook for all of them:
 *
 *   event: stage    { key, label, progress }   coarse milestone + 0..1 progress
 *   event: delta    { text }                   partial generated text
 *   event: partial  { ... }                    a usable intermediate result
 *   event: result   { ... }                    the final payload
 *   event: error    { message, status }        terminal failure
 *
 * Streaming is also what keeps long generations alive: bytes flow from the
 * first milestone, so platform request timeouts never fire mid-generation.
 */

export const streamCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface SseWriter {
  /** Emit a named event with a JSON payload. */
  send(event: string, data: unknown): void;
  /** Emit a milestone. `progress` is 0..1. */
  stage(key: string, label: string, progress: number): void;
  /** Emit a chunk of generated text. */
  delta(text: string): void;
  /** True once the client has gone away (cancel / navigation). */
  readonly aborted: boolean;
}

/**
 * Build a streamed Response. `run` receives a writer; when the client cancels,
 * `signal` aborts so the upstream gateway request is torn down too.
 */
export function sseResponse(
  cors: Record<string, string>,
  run: (writer: SseWriter, signal: AbortSignal) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (chunk: string) => {
        if (closed || abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const writer: SseWriter = {
        send(event, data) {
          push(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
        },
        stage(key, label, progress) {
          writer.send("stage", { key, label, progress });
        },
        delta(text) {
          if (text) writer.send("delta", { text });
        },
        get aborted() {
          return abort.signal.aborted;
        },
      };

      // Open the stream immediately so proxies flush headers.
      push(": open\n\n");

      try {
        await run(writer, abort.signal);
      } catch (e) {
        if (!abort.signal.aborted) {
          console.error("sse handler error:", e);
          writer.send("error", {
            message: e instanceof Error && e.message ? e.message : "Generation failed",
            status: 500,
          });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      // Client-initiated cancel only — tears down the in-flight gateway call.
      abort.abort();
    },
  });

  return new Response(body, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export interface GatewayStreamResult {
  ok: boolean;
  status: number;
  /** Accumulated assistant text (empty when the model only called a tool). */
  text: string;
  /** Accumulated tool-call arguments, keyed by tool name. */
  toolArgs: Record<string, string>;
  /** Error message when `ok` is false. */
  error?: string;
}

/**
 * Call the Lovable AI gateway with `stream: true` and surface deltas as they
 * arrive. Never wraps the call in a timer — reasoning/long generations are
 * expected to take a while, and an aborted call is still billed.
 */
export async function streamGatewayChat(opts: {
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  onText?: (delta: string, accumulated: string) => void;
  onToolArgs?: (name: string, delta: string, accumulated: string) => void;
}): Promise<GatewayStreamResult> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...opts.body, stream: true }),
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    let error = "AI generation failed";
    if (response.status === 429) error = "Rate limit exceeded, please try again in a moment.";
    else if (response.status === 402) error = "AI credits exhausted.";
    else console.error("AI gateway error:", response.status, await response.text().catch(() => ""));
    return { ok: false, status: response.status, text: "", toolArgs: {}, error };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const toolArgs: Record<string, string> = {};
  const toolNameByIndex = new Map<number, string>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = parsed?.choices?.[0]?.delta;
      if (!delta) continue;

      if (typeof delta.content === "string" && delta.content) {
        text += delta.content;
        opts.onText?.(delta.content, text);
      }

      for (const call of delta.tool_calls ?? []) {
        const index = typeof call.index === "number" ? call.index : 0;
        const name = call.function?.name ?? toolNameByIndex.get(index);
        if (name) toolNameByIndex.set(index, name);
        const key = name ?? `tool_${index}`;
        const argsDelta: string = call.function?.arguments ?? "";
        if (!argsDelta) continue;
        toolArgs[key] = (toolArgs[key] ?? "") + argsDelta;
        opts.onToolArgs?.(key, argsDelta, toolArgs[key]);
      }
    }
  }

  return { ok: true, status: 200, text, toolArgs };
}
