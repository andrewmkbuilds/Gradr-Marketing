import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit as durableRateLimit } from "../_shared/rateLimit.ts";

/** Job payload the client sends for scoring. */
type JobInput = { title?: string; company?: string; description?: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINT = "recommend-jobs";
const RATE_LIMIT = 10;
const WINDOW_SECONDS = 60;

/** Durable, cross-instance limit (see _shared/rateLimit.ts). Fails closed. */
async function checkRateLimit(userId: string): Promise<{ ok: boolean; retryAfter?: number }> {
  const r = await durableRateLimit(userId, ENDPOINT, RATE_LIMIT, WINDOW_SECONDS);
  return { ok: r.allowed, retryAfter: r.retry_after };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const rl = await checkRateLimit(user.id);
    if (!rl.ok) return new Response(JSON.stringify({ error: `Rate limit. Retry in ${rl.retryAfter}s.` }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { jobs, resumeText } = await req.json();
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ scores: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Truncate to keep prompt small
    const compact = jobs.slice(0, 20).map((j: JobInput, i: number) => ({
      i,
      title: j.title,
      company: j.company,
      desc: (j.description || "").slice(0, 600),
    }));

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You score how well jobs fit a candidate's resume. Use the tool to return one score per job." },
          { role: "user", content: `Resume:\n${(resumeText || "").slice(0, 4000)}\n\nJobs:\n${JSON.stringify(compact)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_jobs",
            description: "Return match scores",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      i: { type: "number" },
                      score: { type: "number", description: "0-100" },
                      reason: { type: "string" },
                    },
                    required: ["i", "score", "reason"],
                  },
                },
              },
              required: ["scores"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "score_jobs" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429 || resp.status === 402) {
        return new Response(JSON.stringify({ error: resp.status === 402 ? "AI credits exhausted" : "AI rate limited" }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error ${resp.status}`);
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    const result = tc ? JSON.parse(tc.function.arguments) : { scores: [] };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("recommend-jobs error:", e);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
