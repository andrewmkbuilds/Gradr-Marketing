import { supabase } from "@/integrations/supabase/client";
import { reportLlmFailure } from "@/lib/monitoring/reliability";

/**
 * Client half of the streamed-generation protocol implemented in
 * `supabase/functions/_shared/aiStream.ts`.
 *
 * Edge functions are called with `fetch` (rather than `functions.invoke`) so
 * the response body can be read incrementally. The only abort path is an
 * explicit user cancel — never a timer.
 */

export interface StreamStage {
  key: string;
  label: string;
  /** 0..1 */
  progress: number;
}

export interface StreamHandlers<TResult> {
  onStage?: (stage: StreamStage) => void;
  /** A chunk of generated text, plus everything received so far. */
  onDelta?: (chunk: string, accumulated: string) => void;
  /** A usable intermediate result (e.g. deterministic scores). */
  onPartial?: (partial: TResult) => void;
  onResult?: (result: TResult) => void;
}

export class AiStreamError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiStreamError";
    this.status = status;
  }
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Invoke an edge function in streaming mode and dispatch its SSE events.
 * Resolves with the final result, or throws `AiStreamError` / `AbortError`.
 */
export async function streamEdgeFunction<TResult>(
  fn: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers<TResult> = {},
  signal?: AbortSignal,
): Promise<TResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    reportLlmFailure(fn, new Error("missing session token"), { status: 401, code: "unauthorized" });
    throw new AiStreamError("Please sign in to use this feature", 401);
  }

  const response = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!response.ok || !response.body) {
    // Non-streamed failures (auth, rate limit, entitlement) still come back
    // as ordinary JSON, so surface their message verbatim.
    let message = "Generation failed";
    try {
      const payload = await response.json();
      if (payload?.error) message = String(payload.error);
    } catch {
      /* keep the default */
    }
    reportLlmFailure(fn, new Error(message), { status: response.status });
    throw new AiStreamError(message, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let result: TResult | null = null;
  let failure: AiStreamError | null = null;

  const dispatch = (event: string, raw: string) => {
    let data: Record<string, unknown>;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return;
    }
    switch (event) {
      case "stage":
        handlers.onStage?.({
          key: String(data.key ?? "working"),
          label: String(data.label ?? "Working"),
          progress: typeof data.progress === "number" ? data.progress : 0,
        });
        break;
      case "delta":
        if (typeof data.text === "string") {
          accumulated += data.text;
          handlers.onDelta?.(data.text, accumulated);
        }
        break;
      case "partial":
        handlers.onPartial?.(data as TResult);
        break;
      case "result":
        result = data as TResult;
        handlers.onResult?.(data as TResult);
        break;
      case "error":
        failure = new AiStreamError(String(data.message ?? "Generation failed"), Number(data.status) || 500);
        break;
      default:
        break;
    }
  };

  const flush = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) dispatch(event, dataLines.join("\n"));
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      flush(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
    }
  }
  if (buffer.trim()) flush(buffer);

  if (failure) {
    reportLlmFailure(fn, failure, { status: (failure as AiStreamError).status, code: "stream_error" });
    throw failure;
  }
  if (result === null) {
    reportLlmFailure(fn, new Error("stream ended without a result"), {
      status: 502,
      code: "stream_truncated",
      context: { received_chars: accumulated.length },
    });
    throw new AiStreamError("The stream ended before a result arrived. Please retry.", 502);
  }
  return result;
}
