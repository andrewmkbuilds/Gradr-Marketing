import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  classifyProviderFailure,
  corsHeaders,
  DEFAULT_MODEL_ID,
  DEFAULT_OUTPUT_FORMAT,
  jsonResponse as json,
  loadVoiceConfig,
  providerDetail,
  recordVoiceEvent,
  resolveProfile,
  serviceClient,
  VOICE_PROFILES,
} from "../_shared/voiceProvider.ts";

/**
 * Admin console for the interviewer voice provider.
 *
 * Actions
 *  - status        credential presence, provider account standing, entitlement
 *                  (character quota) and the most recent failures
 *  - stream-test   a real streaming synthesis with the *live* configuration:
 *                  measures time-to-first-byte and total audio bytes and
 *                  returns the clip so an admin can actually hear it
 *  - save-config   model / output format / per-persona voice ids
 *
 * The credential itself is never returned, and provider prose never crosses
 * this boundary — only Gradr codes and enumerated provider reasons.
 */

async function providerSubscription(apiKey: string) {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return { ok: false, ...classifyProviderFailure(res.status, raw) };
    }
    const data = await res.json();
    return {
      ok: true,
      tier: String(data?.tier ?? "unknown"),
      charactersUsed: Number(data?.character_count ?? 0),
      characterLimit: Number(data?.character_limit ?? 0),
      status: String(data?.status ?? "unknown"),
    };
  } catch (e) {
    console.error("[voice-diagnostics] subscription probe threw", String(e));
    return { ok: false, code: "VOICE_CONNECTION_FAILED", reason: "PROVIDER_NETWORK" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = typeof body.action === "string" ? body.action : "status";
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const config = await loadVoiceConfig();

  // ---- lookup -------------------------------------------------------------
  // Resolve a candidate-reported requestId to the sanitized Gradr error the
  // studio showed *and* the server-side provider detail behind it. Admin-only
  // (enforced above) — the detail never leaves this action.
  if (action === "lookup") {
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    if (!/^[A-Za-z0-9-]{6,64}$/.test(requestId)) {
      return json({ error: "Enter a valid request id" }, 400);
    }

    const { data: events, error } = await serviceClient()
      .from("voice_provider_events")
      .select("id, user_id, outcome, code, provider_reason, upstream_status, provider_detail, persona_id, context, request_id, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[voice-diagnostics] lookup failed", error.message);
      return json({ error: "Lookup failed" }, 500);
    }

    console.info("[voice-diagnostics] lookup", { by: user.id, requestId, hits: events?.length ?? 0 });
    return json({ requestId, events: events ?? [] });
  }


  // ---- save-config --------------------------------------------------------
  if (action === "save-config") {
    const overrides: Record<string, string> = {};
    const incoming = body.voiceOverrides ?? {};
    for (const persona of Object.keys(VOICE_PROFILES)) {
      const value = incoming?.[persona];
      if (typeof value === "string" && /^[A-Za-z0-9]{8,64}$/.test(value.trim())) {
        overrides[persona] = value.trim();
      }
    }
    const modelId = typeof body.modelId === "string" && /^[a-z0-9_\-.]{3,64}$/.test(body.modelId)
      ? body.modelId
      : DEFAULT_MODEL_ID;
    const outputFormat = typeof body.outputFormat === "string" && /^[a-z0-9_]{3,32}$/.test(body.outputFormat)
      ? body.outputFormat
      : DEFAULT_OUTPUT_FORMAT;

    const { error } = await serviceClient().from("voice_provider_config").upsert({
      id: true,
      model_id: modelId,
      output_format: outputFormat,
      voice_overrides: overrides,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[voice-diagnostics] config save failed", error.message);
      return json({ error: "Could not save voice configuration" }, 500);
    }
    console.info("[voice-diagnostics] config saved", { by: user.id, modelId, outputFormat });
    return json({ saved: true, config: { modelId, outputFormat, voiceOverrides: overrides } });
  }

  // ---- stream-test --------------------------------------------------------
  if (action === "stream-test") {
    if (!apiKey) {
      return json({ ok: false, credential: "missing", code: "VOICE_CONFIGURATION_ERROR", reason: "PROVIDER_CREDENTIAL_MISSING" });
    }
    const personaId = typeof body.personaId === "string" ? body.personaId : "hiring-manager";
    const profile = resolveProfile(personaId, config);
    const text = typeof body.text === "string" && body.text.trim()
      ? body.text.trim().slice(0, 240)
      : "Thanks for making time today. Let's start with a quick introduction.";

    const startedAt = Date.now();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${profile.voiceId}/stream` +
        `?output_format=${config.outputFormat}&optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: config.modelId,
          voice_settings: {
            stability: profile.stability,
            similarity_boost: profile.similarityBoost,
            style: profile.style,
            use_speaker_boost: true,
            speed: profile.speed,
          },
        }),
      },
    ).catch((e) => {
      console.error("[voice-diagnostics] stream test threw", String(e));
      return null;
    });

    if (!res || !res.ok || !res.body) {
      const raw = res ? await res.text().catch(() => "") : "";
      console.error("[voice-diagnostics] stream test failed", {
        status: res?.status ?? 0,
        detail: providerDetail(raw),
      });
      const mapped = classifyProviderFailure(res?.status ?? 0, raw);
      await recordVoiceEvent({
        userId: user.id,
        outcome: "failure",
        code: mapped.code,
        reason: mapped.reason,
        upstreamStatus: res?.status ?? 0,
        context: "diagnostics",
      });
      return json({ ok: false, credential: "present", upstreamStatus: res?.status ?? 0, code: mapped.code, reason: mapped.reason });
    }

    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    let ttfbMs = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (!bytes) ttfbMs = Date.now() - startedAt;
        bytes += value.byteLength;
        parts.push(value);
      }
    }

    if (!bytes) {
      await recordVoiceEvent({
        userId: user.id,
        outcome: "failure",
        code: "VOICE_UNAVAILABLE",
        reason: "PROVIDER_UNKNOWN",
        context: "diagnostics",
      });
      return json({ ok: false, credential: "present", code: "VOICE_UNAVAILABLE", reason: "PROVIDER_UNKNOWN", bytes: 0 });
    }

    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.byteLength;
    }
    let binary = "";
    for (let i = 0; i < merged.length; i += 0x8000) {
      binary += String.fromCharCode(...merged.subarray(i, i + 0x8000));
    }

    await recordVoiceEvent({ userId: user.id, outcome: "ok", context: "diagnostics" });
    console.info("[voice-diagnostics] stream test ok", { bytes, ttfbMs, personaId });
    return json({
      ok: true,
      credential: "present",
      bytes,
      ttfbMs,
      totalMs: Date.now() - startedAt,
      personaId,
      voiceId: profile.voiceId,
      modelId: config.modelId,
      audioBase64: btoa(binary),
    });
  }

  // ---- status -------------------------------------------------------------
  const { data: recent } = await serviceClient()
    .from("voice_provider_events")
    .select("outcome, code, provider_reason, upstream_status, context, request_id, persona_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!apiKey) {
    console.error("[voice-diagnostics] credential missing");
    return json({
      credential: "missing",
      synthesis: "unavailable",
      code: "VOICE_CONFIGURATION_ERROR",
      reason: "PROVIDER_CREDENTIAL_MISSING",
      config,
      personas: Object.entries(VOICE_PROFILES).map(([id, p]) => ({ id, defaultVoiceId: p.voiceId })),
      recent: recent ?? [],
    });
  }

  const subscription = await providerSubscription(apiKey);
  return json({
    credential: "present",
    synthesis: subscription.ok ? "ok" : "failing",
    code: subscription.ok ? null : (subscription as { code?: string }).code ?? "VOICE_UNAVAILABLE",
    reason: subscription.ok ? null : (subscription as { reason?: string }).reason ?? "PROVIDER_UNKNOWN",
    subscription: subscription.ok ? subscription : null,
    config,
    personas: Object.entries(VOICE_PROFILES).map(([id, p]) => ({ id, defaultVoiceId: p.voiceId })),
    recent: recent ?? [],
  });
});
