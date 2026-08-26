/**
 * Public affiliate program settings.
 *
 * The affiliate landing pages are read by logged-out visitors, so the numbers
 * they show (commission rate, cookie window, payout minimum) have to be
 * reachable without a session. They used to come from a SECURITY DEFINER RPC
 * that `anon` could execute directly; that grant is gone. This endpoint is the
 * only anonymous read path, it runs as service_role, and it hand-picks the
 * marketing-safe columns so internal affiliate config can never leak.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const PUBLIC_COLUMNS =
  "default_commission_rate, cookie_duration_days, minimum_payout_cents, payout_schedule, terms_url";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { data, error } = await db
      .from("affiliate_settings")
      .select(PUBLIC_COLUMNS)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return json({ settings: data ?? null });
  } catch (e) {
    console.error("affiliate-public-settings error:", e instanceof Error ? e.message : String(e));
    // The marketing page falls back to its own defaults rather than erroring.
    return json({ settings: null }, 200);
  }
});
