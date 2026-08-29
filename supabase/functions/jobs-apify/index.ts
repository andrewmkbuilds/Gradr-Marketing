import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit as durableRateLimit } from "../_shared/rateLimit.ts";
import { connectorConfigured, gatewayJson, GatewayError } from "../_shared/gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const KEY = "APIFY_API_KEY";

/**
 * Actor ids are tilde-separated (username~actor-name).
 *
 * The LinkedIn scraper is a *rented* (paid) Apify actor — running it on an
 * account that has not rented it fails with `actor-is-not-rented`, which made
 * every search look broken. It is therefore opt-in: set APIFY_LINKEDIN_ACTOR
 * once the actor is rented on the connected Apify account.
 */
const LINKEDIN_ACTOR = Deno.env.get("APIFY_LINKEDIN_ACTOR");
const ACTORS: Record<string, string> = {
  ...(LINKEDIN_ACTOR ? { linkedin: LINKEDIN_ACTOR } : {}),
  indeed: Deno.env.get("APIFY_INDEED_ACTOR") || "misceres~indeed-scraper",
};
const DEFAULT_SOURCES = Object.keys(ACTORS);

/**
 * The Indeed actor validates `country` against an uppercase ISO-3166 list, so
 * a lowercase or unknown value fails the whole run with `invalid-input`.
 */
const COUNTRY_BY_HINT: Record<string, string> = {
  "united states": "US", usa: "US", us: "US", remote: "US",
  "united kingdom": "GB", uk: "GB", england: "GB", london: "GB",
  canada: "CA", australia: "AU", germany: "DE", france: "FR", india: "IN",
  netherlands: "NL", ireland: "IE", spain: "ES", italy: "IT", singapore: "SG",
  "united arab emirates": "AE", uae: "AE", dubai: "AE", switzerland: "CH",
};

function resolveCountry(location: string): string {
  const l = location.toLowerCase();
  for (const [hint, code] of Object.entries(COUNTRY_BY_HINT)) {
    if (l.includes(hint)) return code;
  }
  const tail = l.split(",").pop()?.trim() ?? "";
  if (/^[a-z]{2}$/.test(tail)) return tail.toUpperCase();
  return "US";
}

const ENDPOINT = "jobs-apify";
const RATE_LIMIT = 6;
const WINDOW_SECONDS = 60;

interface NormalizedJob {
  dedupe_key: string;
  source: string;
  external_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string | null;
  posted_at: string | null;
  raw: Record<string, unknown>;
}

const clean = (v: unknown, max = 300) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Stable identity across sources: title + company + normalised location. */
function dedupeKey(title: string, company: string | null, location: string | null) {
  return [title, company ?? "", location ?? ""]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9| ]/g, "")
    .trim();
}

function normalize(source: string, item: Record<string, unknown>): NormalizedJob | null {
  const title = clean(item.title || item.positionName || item.jobTitle, 200);
  const url = clean(item.url || item.jobUrl || item.link || item.externalApplyLink, 800);
  if (!title || !url) return null;

  const company = clean(item.company || item.companyName || item.employer, 160);
  const location = clean(item.location || item.jobLocation || item.formattedLocation, 160);
  const desc = clean(item.description || item.descriptionText || item.jobDescription, 6000);
  const postedRaw = item.postedAt || item.publishedAt || item.date || item.postingDateParsed;
  const posted = typeof postedRaw === "string" && !Number.isNaN(Date.parse(postedRaw))
    ? new Date(postedRaw).toISOString()
    : null;

  return {
    dedupe_key: dedupeKey(title, company, location),
    source,
    external_id: clean(item.id || item.jobId || item.key, 200),
    title,
    company,
    location,
    remote: typeof item.isRemote === "boolean"
      ? item.isRemote
      : /remote/i.test(`${location ?? ""} ${title}`) || null,
    url,
    salary_min: Number.isFinite(Number(item.salaryMin)) ? Number(item.salaryMin) : null,
    salary_max: Number.isFinite(Number(item.salaryMax)) ? Number(item.salaryMax) : null,
    currency: clean(item.currency, 8),
    description: desc,
    posted_at: posted,
    raw: { salary: clean(item.salary, 120), contractType: clean(item.contractType, 60) },
  };
}

function actorInput(source: string, query: string, location: string, limit: number) {
  if (source === "indeed") {
    return {
      position: query,
      location,
      country: resolveCountry(location),
      maxItems: limit,
      parseCompanyDetails: false,
    };
  }
  return { title: query, location, rows: limit, proxy: { useApifyProxy: true } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized", code: "unauthorized" }, 401);

    const scoped = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await scoped.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized", code: "unauthorized" }, 401);

    // Durable, cross-instance limit; fails closed (see _shared/rateLimit.ts).
    const rl = await durableRateLimit(user.id, ENDPOINT, RATE_LIMIT, WINDOW_SECONDS);
    if (!rl.allowed) {
      return json({ error: "Too many job searches. Try again in a minute.", code: "rate_limited" }, 429);
    }

    if (!connectorConfigured(KEY)) {
      return json({ error: "Job scraping isn't configured yet.", code: "not_configured" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const query = clean(body.query, 120);
    if (!query) return json({ error: "A search query is required.", code: "invalid_input" }, 400);
    const location = clean(body.location, 120) ?? "";
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
    const requested: string[] = Array.isArray(body.sources) && body.sources.length
      ? body.sources.filter((s: string) => s in ACTORS)
      : DEFAULT_SOURCES;
    const sources = requested.length ? requested : DEFAULT_SOURCES;
    if (!sources.length) {
      return json({ error: "No job scraping sources are configured.", code: "not_configured" }, 503);
    }

    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const items = await gatewayJson<Record<string, unknown>[]>(
          "apify",
          KEY,
          `/acts/${ACTORS[source]}/run-sync-get-dataset-items?timeout=120&limit=${limit}`,
          { method: "POST", body: JSON.stringify(actorInput(source, query, location, limit)) },
        );
        return (Array.isArray(items) ? items : [])
          .map((i) => normalize(source, i))
          .filter((j): j is NormalizedJob => Boolean(j));
      }),
    );

    const failures: { source: string; detail: string }[] = [];
    const merged = new Map<string, NormalizedJob>();
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const e = r.reason;
        failures.push({ source: sources[i], detail: e instanceof GatewayError ? e.body.slice(0, 300) : String(e) });
        return;
      }
      // First source wins on a duplicate; later sources only fill missing fields.
      for (const job of r.value) {
        const existing = merged.get(job.dedupe_key);
        if (!existing) merged.set(job.dedupe_key, job);
        else {
          existing.description ||= job.description;
          existing.salary_min ??= job.salary_min;
          existing.salary_max ??= job.salary_max;
        }
      }
    });

    const jobs = [...merged.values()];

    if (jobs.length) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await admin.from("discovered_jobs").upsert(
        jobs.map((j) => ({ ...j, last_seen_at: new Date().toISOString() })),
        { onConflict: "dedupe_key" },
      );
      if (error) console.error("discovered_jobs upsert failed:", error.message);
    }

    if (!jobs.length && failures.length === sources.length) {
      return json({ error: "All job sources failed", code: "provider_failed", failures }, 502);
    }

    return json({ ok: true, jobs, failures, sources });
  } catch (e) {
    if (e instanceof GatewayError) {
      return json({ error: "Apify request failed", status: e.status, details: e.body }, e.status);
    }
    console.error("jobs-apify error:", e);
    return json({ error: "Unexpected error", details: String(e) }, 500);
  }
});
