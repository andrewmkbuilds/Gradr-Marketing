/**
 * Content-Security-Policy violation collector (report-only).
 *
 * Public endpoint: browsers and the client-side `securitypolicyviolation`
 * listener post here. It stores only origin-level, credential-free facts —
 * never cookies, tokens or full URLs with query strings.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** Strip query strings and credentials — we only need origin + path. */
function safeUri(value: unknown): { uri: string; origin: string; path: string } {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return { uri: "unknown", origin: "unknown", path: "/" };
  try {
    const u = new URL(raw);
    return { uri: `${u.origin}${u.pathname}`, origin: u.origin, path: u.pathname };
  } catch {
    // Keyword blocked-URIs: inline, eval, data, blob, self
    return { uri: raw.slice(0, 120), origin: raw.slice(0, 60), path: "/" };
  }
}

function browserFamily(ua: string | null): string | null {
  if (!ua) return null;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    // Accept both the browser `report-uri` shape and our client summary shape.
    const list: Record<string, unknown>[] = Array.isArray(body)
      ? body.map((r) => r.body ?? r)
      : [body["csp-report"] ?? body];

    const ua = req.headers.get("user-agent");
    const rows = list.slice(0, 20).map((r) => {
      const doc = safeUri(r["document-uri"] ?? r.documentURI ?? r.documentPath ?? r.document_path);
      const blocked = safeUri(r["blocked-uri"] ?? r.blockedURI ?? r.blockedOrigin ?? r.blocked_origin);
      const effective = String(
        r["effective-directive"] ?? r.effectiveDirective ?? r.directive ?? "unknown",
      ).slice(0, 80);
      return {
        document_uri: doc.uri,
        document_path: r.documentPath ?? r.document_path ?? doc.path,
        referrer: null,
        violated_directive: String(r["violated-directive"] ?? r.violatedDirective ?? effective).slice(0, 80),
        effective_directive: effective,
        blocked_uri: blocked.uri,
        blocked_origin: blocked.origin,
        source_file: safeUri(r["source-file"] ?? r.sourceFile).uri,
        line_number: Number(r["line-number"] ?? r.lineNumber) || null,
        column_number: Number(r["column-number"] ?? r.columnNumber) || null,
        status_code: Number(r["status-code"] ?? r.statusCode) || null,
        disposition: String(r.disposition ?? "report").slice(0, 20),
        script_sample: r["script-sample"] ?? r.sample ? String(r["script-sample"] ?? r.sample).slice(0, 200) : null,
        user_agent: browserFamily(ua),
        raw: null,
      };
    });

    if (rows.length) {
      const { error } = await db.from("csp_violation_reports").insert(rows);
      if (error) console.error("[csp-report] insert failed", error.message);
    }

    // Always 204 — a collector must never become a client-visible failure.
    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (e) {
    console.error("[csp-report] error", e instanceof Error ? e.message : e);
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});
