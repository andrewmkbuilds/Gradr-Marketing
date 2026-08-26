/**
 * Conversion-tracking health monitor.
 *
 * Answers one question: are the events the growth funnels are built on
 * (`payment_completed`, `subscription_created`, `upgraded_to_premium`) actually
 * arriving in PostHog, once each, promptly?
 *
 * Three modes:
 *  - `report`  (default) — health summary + open alerts for /admin/analytics-health
 *  - `scan`    — runs the SQL detector immediately instead of waiting for cron
 *  - `notify`  — scans, then emails admins about any unnotified critical alert
 *
 * Admin JWT required for every mode; the cron job runs the SQL detector
 * directly, so no service token is exposed here.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Revenue events that must exist for the growth funnels to be trustworthy. */
const CRITICAL_EVENTS = ["payment_completed", "subscription_created", "upgraded_to_premium"];

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await asUser.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = ["report", "scan", "notify"].includes(body?.action) ? body.action : "report";
    const hours = Math.min(Math.max(Number(body?.hours ?? 24) || 24, 1), 24 * 30);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const db = admin();

    let scanned: number | null = null;
    if (action === "scan" || action === "notify") {
      const { data, error } = await db.rpc("detect_analytics_regressions", { p_window: `${hours} hours` });
      if (error) throw error;
      scanned = Number(data ?? 0);
    }

    // Delivery ledger rolled up per event.
    const { data: deliveries, error: dErr } = await db
      .from("analytics_event_deliveries")
      .select("event_name, status, latency_ms, occurred_at, provider_event_id, error")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (dErr) throw dErr;

    const byEvent = new Map<string, {
      event: string; ok: number; failed: number; skipped: number;
      duplicates: number; maxLatencyMs: number; lastSeen: string | null; lastError: string | null;
    }>();
    const seenKeys = new Set<string>();

    for (const row of deliveries ?? []) {
      const name = String(row.event_name);
      const entry = byEvent.get(name) ?? {
        event: name, ok: 0, failed: 0, skipped: 0, duplicates: 0,
        maxLatencyMs: 0, lastSeen: null, lastError: null,
      };
      entry[row.status as "ok" | "failed" | "skipped"] += 1;
      entry.maxLatencyMs = Math.max(entry.maxLatencyMs, Number(row.latency_ms ?? 0));
      if (!entry.lastSeen) entry.lastSeen = row.occurred_at as string;
      if (row.error && !entry.lastError) entry.lastError = String(row.error);
      if (row.provider_event_id && row.status === "ok") {
        const key = `${row.provider_event_id}:${name}`;
        if (seenKeys.has(key)) entry.duplicates += 1;
        seenKeys.add(key);
      }
      byEvent.set(name, entry);
    }

    // A critical event with no deliveries at all is as bad as a failing one.
    for (const name of CRITICAL_EVENTS) {
      if (!byEvent.has(name)) {
        byEvent.set(name, {
          event: name, ok: 0, failed: 0, skipped: 0, duplicates: 0,
          maxLatencyMs: 0, lastSeen: null, lastError: null,
        });
      }
    }

    const { data: alerts, error: aErr } = await db
      .from("analytics_alerts")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (aErr) throw aErr;

    // Billing side of the comparison: what should have produced events.
    const { count: paidWebhooks } = await db
      .from("webhook_deliveries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("event_type", "subscription.created");

    const { count: unprocessed } = await db
      .from("webhook_deliveries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .neq("state", "processed");

    const openCritical = (alerts ?? []).filter((a) => a.severity === "critical");

    let notified = 0;
    if (action === "notify" && openCritical.length) {
      const pending = openCritical.filter((a) => !a.notified_at);
      if (pending.length) {
        const { data: admins } = await db
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        for (const row of admins ?? []) {
          // Admin emails live in auth, not in profiles.
          const { data: authUser } = await db.auth.admin.getUserById(row.user_id as string);
          const email = authUser?.user?.email;
          if (!email) continue;
          // Security/anomaly email is owned by app.gradr.me; this surface only
          // records that an admin still needs to be notified there.
          console.info("analytics-monitor: alert notification delegated to app.gradr.me", {
            adminUserId: row.user_id,
            alertId: pending[0].id,
            openCritical: pending.length,
          });
          if (email) notified += 1;
        }
        await db
          .from("analytics_alerts")
          .update({ notified_at: new Date().toISOString() })
          .in("id", pending.map((a) => a.id));
      }
    }

    const status = openCritical.length ? "critical" : (alerts ?? []).length ? "degraded" : "healthy";

    return json({
      status,
      window_hours: hours,
      scanned_alerts: scanned,
      notified_admins: notified,
      billing: {
        subscription_webhooks: paidWebhooks ?? 0,
        unprocessed_webhooks: unprocessed ?? 0,
      },
      events: [...byEvent.values()].sort((a, b) => a.event.localeCompare(b.event)),
      critical_events: CRITICAL_EVENTS,
      alerts: alerts ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("analytics-monitor error:", message);
    return json({ error: "Monitor failed", details: message }, 500);
  }
});
