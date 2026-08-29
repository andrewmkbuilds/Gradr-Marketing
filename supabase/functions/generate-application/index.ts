import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { consume, paymentRequired, refund, resolveEnv, type PaymentEnv } from "../_shared/entitlements.ts";
import { logAiAuthorization } from "../_shared/securityAudit.ts";
import { sseResponse, streamGatewayChat } from "../_shared/aiStream.ts";
import { checkRateLimit as durableRateLimit } from "../_shared/rateLimit.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENDPOINT = "generate-application";
const RATE_LIMIT = 10;
const WINDOW_SECONDS = 60;

/** Durable, cross-instance limit (see _shared/rateLimit.ts). Fails closed. */
async function checkRateLimit(userId: string): Promise<{ ok: boolean; retryAfter?: number }> {
  const r = await durableRateLimit(userId, ENDPOINT, RATE_LIMIT, WINDOW_SECONDS);
  return { ok: r.allowed, retryAfter: r.retry_after };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Set once the request has been charged, so a later failure can be refunded.
  let meteredUserId: string | null = null;
  let paymentEnv: PaymentEnv = "sandbox";



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
      void logAiAuthorization({ source: "generate-application", decision: "denied", reason: "invalid_token" });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = await checkRateLimit(user.id);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Try again in ${rl.retryAfter}s.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) } },
      );
    }

    const { type, resumeText, jobTitle, company, jobDescription, userName, environment, stream } =
      await req.json();
    const wantsStream = stream === true;

    if (!type || !resumeText) {
      return new Response(JSON.stringify({ error: "type and resumeText are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Entitlement: monthly allowance first, then purchased credits -----
    paymentEnv = resolveEnv(environment);
    const entitlement = await consume(user.id, "application", paymentEnv);
    void logAiAuthorization({ source: "generate-application", decision: entitlement.allowed ? "allowed" : "denied", userId: user.id, feature: "application", env: paymentEnv, reason: entitlement.reason ?? entitlement.source ?? null, details: { tier: entitlement.tier, used: entitlement.used, allowance: entitlement.allowance } });
    if (!entitlement.allowed) return paymentRequired(entitlement, corsHeaders);
    meteredUserId = user.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let toolName = "";
    let toolParams: Record<string, unknown> = {};

    if (type === "cover_letter") {
      systemPrompt = `You are an expert career writer. Write a compelling, personalized cover letter. Be specific, avoid generic phrases, and highlight relevant experience from the resume. Keep it under 400 words. Professional but warm tone.`;
      toolName = "generate_cover_letter";
      toolParams = {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Full cover letter text with paragraphs" },
        },
        required: ["subject", "body"],
      };
    } else if (type === "recruiter_message") {
      systemPrompt = `You are an expert networking strategist. Write a concise, compelling LinkedIn/email message to a recruiter or hiring manager. Be direct, show genuine interest, mention specific relevant skills. Keep it under 150 words.`;
      toolName = "generate_recruiter_message";
      toolParams = {
        type: "object",
        properties: {
          subject: { type: "string", description: "Message subject or first line" },
          body: { type: "string", description: "Full message text" },
        },
        required: ["subject", "body"],
      };
    } else if (type === "application_pack") {
      systemPrompt = `You are an expert career writer producing a complete application pack: a tailored cover letter, a short recruiter outreach message, and 3-5 rewritten resume bullet points that better target this role. Be specific, ATS-friendly, and quantitative where possible.`;
      toolName = "generate_application_pack";
      toolParams = {
        type: "object",
        properties: {
          cover_letter: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body: { type: "string", description: "Full cover letter, < 350 words, paragraphs separated by blank lines" },
            },
            required: ["subject", "body"],
          },
          recruiter_message: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body: { type: "string", description: "Short outreach message, < 120 words" },
            },
            required: ["subject", "body"],
          },
          bullet_rewrites: {
            type: "array",
            description: "3-5 rewritten resume bullets tailored to the job",
            items: {
              type: "object",
              properties: {
                original_hint: { type: "string", description: "Topic/area from resume this rewrites" },
                rewritten: { type: "string", description: "New bullet point, action verb + outcome + metric" },
              },
              required: ["rewritten"],
            },
          },
        },
        required: ["cover_letter", "recruiter_message", "bullet_rewrites"],
      };
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'cover_letter', 'recruiter_message', or 'application_pack'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = `Resume:\n${resumeText.substring(0, 5000)}\n\nTarget Position: ${jobTitle || "Not specified"} at ${company || "Not specified"}\n${jobDescription ? `Job Description:\n${jobDescription.substring(0, 4000)}` : ""}\nApplicant Name: ${userName || "Not specified"}`;

    // ------------------------- streamed generation ------------------------
    // The client renders tokens as they arrive and can cancel mid-flight.
    if (wantsStream) {
      const chargedUserId = meteredUserId;
      meteredUserId = null; // ownership moves into the stream handler
      const isProse = type === "cover_letter" || type === "recruiter_message";

      return sseResponse(corsHeaders, async (writer, signal) => {
        writer.stage("prepare", "Reading your resume and the role", 0.08);

        const gatewayBody: Record<string, unknown> = isProse
          ? {
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `${systemPrompt}\n\nOutput format: the first line must be "Subject: <subject line>", then a blank line, then the full text. No markdown, no preamble, no commentary.`,
                },
                { role: "user", content: userContent },
              ],
            }
          : {
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
              ],
              tools: [{ type: "function", function: { name: toolName, description: `Generate a ${type.replace(/_/g, " ")}`, parameters: toolParams } }],
              tool_choice: { type: "function", function: { name: toolName } },
            };

        writer.stage("generating", isProse ? "Writing your draft" : "Assembling your application pack", 0.18);

        // Expected output length, used to turn token flow into real progress.
        const expected = type === "recruiter_message" ? 900 : type === "cover_letter" ? 2400 : 3600;
        let lastProgress = 0.18;
        const report = (chars: number) => {
          const next = Math.min(0.95, 0.18 + (chars / expected) * 0.72);
          if (next - lastProgress >= 0.02) {
            lastProgress = next;
            writer.stage("generating", isProse ? "Writing your draft" : "Assembling your application pack", next);
          }
        };

        let streamed;
        try {
          streamed = await streamGatewayChat({
            apiKey: LOVABLE_API_KEY,
            body: gatewayBody,
            signal,
            onText: (delta, all) => {
              writer.delta(delta);
              report(all.length);
            },
            onToolArgs: (_name, _delta, all) => report(all.length),
          });
        } catch (err) {
          // Client cancelled (or the socket died) — give the credit back.
          if (chargedUserId) await refund(chargedUserId, "application", paymentEnv);
          if (signal.aborted) return;
          throw err;
        }

        if (!streamed.ok) {
          if (chargedUserId) await refund(chargedUserId, "application", paymentEnv);
          writer.send("error", { message: streamed.error ?? "AI generation failed", status: streamed.status });
          return;
        }


        let result: Record<string, unknown> | null = null;
        if (isProse) {
          const raw = streamed.text.trim();
          const match = raw.match(/^\s*subject\s*:\s*(.+)$/im);
          const subject = match?.[1]?.trim() || `${jobTitle || "Application"}${company ? ` — ${company}` : ""}`;
          const body = match ? raw.slice(raw.indexOf(match[0]) + match[0].length).trim() : raw;
          if (body) result = { subject, body };
        } else {
          const args = streamed.toolArgs[toolName] ?? Object.values(streamed.toolArgs)[0];
          if (args) {
            try {
              result = JSON.parse(args);
            } catch {
              result = null;
            }
          }
        }

        if (!result) {
          if (chargedUserId) await refund(chargedUserId, "application", paymentEnv);
          writer.send("error", { message: "The model returned an empty draft. Please retry.", status: 502 });
          return;
        }

        writer.stage("done", "Draft ready", 1);
        writer.send("result", result);
      });
    }



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
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: toolName,
            description: `Generate a ${type.replace(/_/g, " ")}`,
            parameters: toolParams,
          },
        }],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!response.ok) {
      if (meteredUserId) {
        await refund(meteredUserId, "application", paymentEnv);
        meteredUserId = null; // already refunded — don't refund twice in catch
      }
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
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const result = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!result) throw new Error("Failed to parse AI response");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-application error:", e);
    if (meteredUserId) await refund(meteredUserId, "application", paymentEnv);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
