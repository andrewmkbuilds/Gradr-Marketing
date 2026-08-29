import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit as durableRateLimit } from "../_shared/rateLimit.ts";
/** Minimal shape of a chat turn accepted from the client. */
type ChatMessage = { role?: string; content?: unknown };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENDPOINT = "interview-report";
const RATE_LIMIT = 5;
const WINDOW_SECONDS = 60;

/** Durable, cross-instance limit (see _shared/rateLimit.ts). Fails closed. */
async function checkRateLimit(userId: string): Promise<boolean> {
  const r = await durableRateLimit(userId, ENDPOINT, RATE_LIMIT, WINDOW_SECONDS);
  return r.allowed;
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!await checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "Too many reports. Try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetRole = String(body.targetRole ?? "").slice(0, 120);
    const integrity = body.integrity && typeof body.integrity === "object" ? body.integrity : null;
    const durationSec = Number.isFinite(body.durationSec) ? Math.max(0, Math.round(body.durationSec)) : 0;

    const transcript = messages
      .filter((m: ChatMessage) => m && typeof m.content === "string")
      .slice(-60)
      .map((m: ChatMessage) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${String(m.content).slice(0, 3000)}`)
      .join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a senior interview assessor. Score the candidate's mock interview for a ${targetRole || "software engineering"} role. Be specific, cite moments from the transcript, and never invent facts. Scores are 0-100.`,
          },
          {
            role: "user",
            content: `Transcript:\n${transcript}\n\nSession length: ${durationSec}s.\n${
              integrity
                ? `On-device camera signals — eye contact ${integrity.eyeContactPct}%, in-frame ${integrity.presencePct}%, times off-camera ${integrity.absenceEvents}, multi-face frames ${integrity.multiFaceFrames}. Use these only for delivery/presence coaching.`
                : "Camera was off; skip presence coaching."
            }`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_report",
              description: "Return the structured interview scorecard.",
              parameters: {
                type: "object",
                properties: {
                  overallScore: { type: "number" },
                  communication: { type: "number" },
                  technicalDepth: { type: "number" },
                  structure: { type: "number" },
                  confidence: { type: "number" },
                  summary: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  improvements: { type: "array", items: { type: "string" } },
                  nextSteps: { type: "array", items: { type: "string" } },
                  recommendedQuestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 specific interview questions the candidate should practise next, based on their weakest answers.",
                  },
                },
                required: [
                  "overallScore", "communication", "technicalDepth", "structure",
                  "confidence", "summary", "strengths", "improvements", "nextSteps",
                  "recommendedQuestions",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_report" } },
      }),
    });

    if (response.status === 429 || response.status === 402) {
      return new Response(
        JSON.stringify({ error: response.status === 429 ? "Rate limit exceeded, try again later." : "Credits exhausted." }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      throw new Error("Report generation failed");
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No report returned");
    const report = JSON.parse(args);

    return new Response(JSON.stringify({ report, integrity, durationSec }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("interview-report error:", e);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
