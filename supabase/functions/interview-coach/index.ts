import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit as durableRateLimit } from "../_shared/rateLimit.ts";
import { consume, paymentRequired, resolveEnv } from "../_shared/entitlements.ts";
import { logAiAuthorization } from "../_shared/securityAudit.ts";
/** Minimal shape of a chat turn accepted from the client. */
type ChatMessage = { role?: string; content?: unknown };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Streaming chat: 30 messages per 60s per user.
// Durable + shared across instances (see _shared/rateLimit.ts); fails closed.
const ENDPOINT = "interview-coach";
const RATE_LIMIT = 30;
const WINDOW_SECONDS = 60;

async function checkRateLimit(userId: string): Promise<{ ok: boolean; retryAfter?: number }> {
  const r = await durableRateLimit(userId, ENDPOINT, RATE_LIMIT, WINDOW_SECONDS);
  return { ok: r.allowed, retryAfter: r.retry_after };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      void logAiAuthorization({ source: "interview-coach", decision: "denied", reason: "invalid_token" });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, targetRole, resumeText, directive, environment } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Sanitize: only allow user/assistant roles + bounded content; cap message count
    const safeMessages = messages
      .filter((m: ChatMessage) => m && typeof m.content === "string")
      .slice(-50)
      .map((m: ChatMessage) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 4000),
      }));

    const rl = await checkRateLimit(user.id);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Try again in ${rl.retryAfter}s.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) } },
      );
    }

    // ---- Entitlement: charged once per session, on the opening turn ------
    const isSessionStart = !safeMessages.some((m: { role: string }) => m.role === "assistant");
    if (isSessionStart) {
      const paymentEnv = resolveEnv(environment);
      const entitlement = await consume(user.id, "interview", paymentEnv);
      void logAiAuthorization({ source: "interview-coach", decision: entitlement.allowed ? "allowed" : "denied", userId: user.id, feature: "interview", env: paymentEnv, reason: entitlement.reason ?? entitlement.source ?? null, details: { tier: entitlement.tier, used: entitlement.used, allowance: entitlement.allowance } });
      if (!entitlement.allowed) return paymentRequired(entitlement, corsHeaders);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const safeDirective = typeof directive === "string" ? directive.slice(0, 8000) : "";

    // Everything this model produces is spoken aloud by ElevenLabs, so the
    // prompt optimises for delivery (short turns, one idea per sentence) and
    // for adaptivity (follow the candidate, not a script).
    const systemPrompt = `You are a real human interviewer conducting a live, spoken interview for a ${targetRole || "software engineering"} role. You are NOT an assistant, a coach, or a narrator. There is no script.

HOW YOU TALK
- Short sentences. One idea per sentence. Contractions. The way people actually speak on a call.
- Vary your rhythm: sometimes a four-word reaction, sometimes two sentences of setup, then the question.
- Never read a paragraph aloud. If your turn is longer than about three sentences, cut it.
- Do not explain why you're asking a question. Just ask it.
- Do not compliment or grade answers. No "great answer", no "that's a really good point". At most a three-word acknowledgement.
- Vary your connectors and never reuse one twice in a row: "Alright", "Got it", "Okay", "That's interesting", "Let me dig into that", "Hm", "Right".
- No markdown, no lists, no headings, no emoji, no stage directions, no bracketed notes.
- Never write filler disfluencies like "um" or "uh". Realism comes from pacing and content, not fake stumbling.
- Ask exactly ONE question per turn, then stop.

HOW YOU DECIDE WHAT TO ASK
- Listen to the answer that was just given and follow it. The next question comes from what they actually said, their resume, the job description, and the seniority the role implies.
- Latch onto specifics: numbers, technologies, scale, decisions, conflicts, failures. Pull the thread.
  Example: they say "an API that handled thousands of requests" -> you ask what happened when traffic spiked, and whether they had caching or rate limiting.
- If an answer is vague, do not move on. Ask for the concrete thing that's missing.
- If the answer is thorough, move to a genuinely new area rather than over-drilling.
- Redirect when they drift: name it in a few words, then re-ask the actual question.
- Do not repeat a question you already asked, and do not reuse phrasing from your earlier turns.
- Open the interview with one short line of who you are and why you're talking, then your first question. Nothing more.
${safeDirective ? `\n--- Session brief (this defines your persona, pace and bar — follow it precisely) ---\n${safeDirective}\n--- End session brief ---` : ""}
${resumeText ? `\nCandidate's resume — reference their real projects by name when probing:\n${String(resumeText).substring(0, 2000)}` : ""}

Output only the words you say out loud.`;


    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
        stream: true,
      }),
    });


    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI interview coach failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("interview-coach error:", e);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
