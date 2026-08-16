/**
 * Per-request ledger of the entitlement/credit writes a webhook performed.
 *
 * Troubleshooting a payment problem means answering "did the event actually
 * write anything, and did that write succeed?". Provider payloads alone can't
 * answer that, so every meaningful write records a structured result which is
 * persisted onto the delivery row and surfaced in the admin view.
 *
 * AsyncLocalStorage keeps the ledger scoped to one request even when several
 * webhook deliveries are handled concurrently by the same isolate.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface WriteResult {
  /** What was attempted, e.g. "entitlement.upsert" or "credits.grant". */
  op: string;
  table: string;
  ok: boolean;
  user_id?: string | null;
  detail?: Record<string, unknown>;
  error?: string | null;
  at: string;
}

const storage = new AsyncLocalStorage<WriteResult[]>();

export function runWithWriteLog<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run([], fn);
}

export function getWriteLog(): WriteResult[] {
  return storage.getStore() ?? [];
}

export function noteWrite(entry: Omit<WriteResult, "at">): void {
  const store = storage.getStore();
  if (!store) return;
  // Cap the ledger so a pathological event can't bloat the delivery row.
  if (store.length >= 40) return;
  store.push({ ...entry, at: new Date().toISOString() });
}

/** Runs a Supabase write and records its outcome in the request ledger. */
export async function tracked<T extends { error?: unknown }>(
  meta: { op: string; table: string; user_id?: string | null; detail?: Record<string, unknown> },
  run: () => PromiseLike<T>,
): Promise<T> {
  try {
    const result = await run();
    const error = result?.error as { message?: string } | null | undefined;
    noteWrite({
      op: meta.op,
      table: meta.table,
      user_id: meta.user_id ?? null,
      detail: meta.detail,
      ok: !error,
      error: error?.message ? String(error.message).slice(0, 300) : null,
    });
    return result;
  } catch (e) {
    noteWrite({
      op: meta.op,
      table: meta.table,
      user_id: meta.user_id ?? null,
      detail: meta.detail,
      ok: false,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
    });
    throw e;
  }
}
