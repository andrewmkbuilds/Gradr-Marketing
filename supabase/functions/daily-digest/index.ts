import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DigestJob = {
  title: string;
  company: string | null;
  location: string | null;
  match_score: number | null;
  url: string | null;
};

type DigestReminder = {
  title: string;
  due_at: string;
  tracked_jobs?: { title: string; company: string | null } | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function localTimeInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function buildSubject(jobsCount: number, remindersCount: number) {
  if (jobsCount && remindersCount) return `${jobsCount} high-match jobs + ${remindersCount} follow-ups due`;
  if (jobsCount) return `${jobsCount} high-match jobs for you today`;
  if (remindersCount) return `${remindersCount} follow-ups need attention`;
  return "Your Gradr digest is ready";
}

function buildPreview(jobs: DigestJob[], reminders: DigestReminder[]) {
  return {
    subject: buildSubject(jobs.length, reminders.length),
    preheader: "Your daily job-search snapshot from Gradr.",
    highMatchJobs: jobs.map((job) => ({
      title: job.title,
      company: job.company || "Unknown company",
      location: job.location || "Remote / flexible",
      matchScore: job.match_score ?? 0,
      url: job.url,
    })),
    overdueReminders: reminders.map((reminder) => ({
      title: reminder.title,
      jobTitle: reminder.tracked_jobs?.title || "Pipeline follow-up",
      company: reminder.tracked_jobs?.company || null,
      dueAt: reminder.due_at,
    })),
  };
}

async function buildDigestForUser(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const [jobsRes, remindersRes] = await Promise.all([
    supabase
      .from("tracked_jobs")
      .select("title, company, location, match_score, url")
      .eq("user_id", userId)
      .neq("status", "rejected")
      .gte("match_score", 85)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("job_reminders")
      .select("title, due_at, tracked_jobs(title, company)")
      .eq("user_id", userId)
      .eq("done", false)
      .lt("due_at", now)
      .order("due_at", { ascending: true })
      .limit(8),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  if (remindersRes.error) throw remindersRes.error;

  const jobs = (jobsRes.data || []) as DigestJob[];
  const reminders = (remindersRes.data || []) as DigestReminder[];
  return buildPreview(jobs, reminders);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const body = await req.json().catch(() => ({}));
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body?.cron === true) {
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (!cronSecret) return json({ error: "Server misconfigured" }, 500);
      // Constant-time-ish check via length+value compare
      const expected = `Bearer ${cronSecret}`;
      if (authHeader.length !== expected.length || authHeader !== expected) {
        return json({ error: "Unauthorized" }, 401);
      }

      const { data: preferences, error } = await serviceClient
        .from("user_preferences")
        .select("user_id, digest_send_time, digest_timezone")
        .eq("digest_enabled", true);
      if (error) throw error;

      const now = new Date();
      let prepared = 0;
      for (const pref of preferences || []) {
        const preferredTime = String(pref.digest_send_time || "08:00").slice(0, 5);
        const localTime = localTimeInZone(now, pref.digest_timezone || "America/New_York");
        if (localTime !== preferredTime) continue;

        const preview = await buildDigestForUser(serviceClient, pref.user_id);
        const jobsCount = preview.highMatchJobs.length;
        const remindersCount = preview.overdueReminders.length;
        if (!jobsCount && !remindersCount) continue;

        await serviceClient.from("digest_send_logs").insert({
          user_id: pref.user_id,
          status: "prepared",
          jobs_count: jobsCount,
          reminders_count: remindersCount,
          preview,
        });
        prepared++;
      }
      return json({ prepared, status: "prepared" });
    }

    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const preview = await buildDigestForUser(serviceClient, user.id);
    const jobsCount = preview.highMatchJobs.length;
    const remindersCount = preview.overdueReminders.length;
    const status = body?.previewOnly ? "previewed" : "prepared";

    const { error: logError } = await serviceClient.from("digest_send_logs").insert({
      user_id: user.id,
      status,
      jobs_count: jobsCount,
      reminders_count: remindersCount,
      preview,
    });
    if (logError) throw logError;

    return json({
      status,
      jobsCount,
      remindersCount,
      preview,
      message: "Digest prepared. Email sending is not configured because no sender domain is connected.",
    });
  } catch (error) {
    console.error("daily-digest error", error);
    return json({ error: "An internal error occurred. Please try again." }, 500);
  }
});
