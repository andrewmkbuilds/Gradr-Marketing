import { supabase } from "@/integrations/supabase/client";
import type { VoiceProviderReason } from "@/lib/interview/voiceErrors";

/**
 * Server-reported health of the interviewer voice provider.
 *
 * Read-only status: whether the backend holds a working voice credential,
 * whether the caller's plan includes voice, and the last success/failure so a
 * silent turn can be explained without digging through logs.
 */
export interface VoiceHealth {
  /** The backend has a usable voice provider credential. */
  configured: boolean;
  /** The caller's plan includes the interviewer voice. */
  entitled: boolean;
  /** Last known stream attempt succeeded (or none has failed yet). */
  healthy: boolean;
  /** Plan tier the entitlement decision was made against. */
  tier: string;
  /** ISO timestamp of the last successful voice stream, when known. */
  lastSuccessAt: string | null;
  lastFailure: {
    /** Machine-readable failure code from the voice edge function. */
    code: string | null;
    reason: VoiceProviderReason | null;
    /** HTTP status the upstream provider returned, when there was one. */
    upstreamStatus: number | null;
    at: string;
  } | null;
}

const FALLBACK: VoiceHealth = {
  configured: false,
  entitled: false,
  healthy: false,
  tier: "free",
  lastSuccessAt: null,
  lastFailure: null,
};

/**
 * Reads voice health from the backend. Never throws: a failed read is itself a
 * degraded signal, so callers get the conservative fallback instead of an
 * exception that would break an in-progress interview.
 */
export async function fetchVoiceHealth(): Promise<VoiceHealth> {
  try {
    const { data, error } = await supabase.functions.invoke("interview-voice-health");
    if (error || !data) return FALLBACK;
    const raw = data as Partial<VoiceHealth> & { last_success_at?: string | null };
    return {
      configured: Boolean(raw.configured),
      entitled: Boolean(raw.entitled),
      healthy: Boolean(raw.healthy),
      tier: typeof raw.tier === "string" ? raw.tier : "free",
      lastSuccessAt: raw.lastSuccessAt ?? raw.last_success_at ?? null,
      lastFailure: raw.lastFailure ?? null,
    };
  } catch {
    return FALLBACK;
  }
}
