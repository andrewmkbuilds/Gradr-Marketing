/**
 * Database contract used by automated integration tests and the DB health check.
 *
 * Keep this list in sync with the tables/RPCs the app actually depends on at
 * runtime. Adding an entry here means CI will fail if the object disappears
 * from the database schema cache.
 */

/** Tables the app reads or writes on core flows. */
export const REQUIRED_TABLES = [
  // identity & preferences
  "profiles",
  "user_roles",
  "user_preferences",
  // billing / entitlements
  "usage_credits",
  "feature_usage",
  "subscribers",
  "purchases",
  "paddle_subscriptions",
  "paddle_customers",
  // career surfaces
  "resumes",
  "job_matches",
  "tracked_jobs",
  "job_reminders",
  "career_plans",
  "interview_sessions",
  "interview_session_state",
  "interview_session_metrics",
  "scheduled_interviews",
  // affiliate program
  "affiliate_profiles",
  "affiliate_applications",
  "affiliate_campaigns",
  "affiliate_clicks",
  "affiliate_commissions",
  "affiliate_payouts",
  "affiliate_referrals",
  "affiliate_settings",
  "affiliate_tiers",
  // discounts & eligibility
  "discount_rules",
  "discount_redemptions",
  "eligibility_verifications",
  "verification_requests",
  // platform
  "notifications",
  "analytics_events",
  "legal_documents",
  "legal_acceptances",
  "security_audit_log",
] as const;

export type RpcContract = {
  /** Function name in the public schema. */
  name: string;
  /** Argument payload matching the function's identity arguments. */
  args: Record<string, unknown>;
};

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * RPCs the app calls. Args only need to satisfy PostgREST signature
 * resolution — the tests assert the function *resolves*, not that an
 * anonymous caller is authorized to get data back.
 */
export const REQUIRED_RPCS: RpcContract[] = [
  // credits / entitlements
  { name: "current_plan_tier", args: { _user_id: NIL_UUID, _env: "production" } },
  { name: "entitlement_snapshot", args: { _env: "production" } },
  { name: "plan_allowance", args: { _tier: "free", _feature: "interview_session" } },
  { name: "has_active_subscription", args: { _user_id: NIL_UUID, _env: "production" } },
  // roles
  { name: "has_role", args: { _user_id: NIL_UUID, _role: "admin" } },
  // affiliate
  { name: "get_affiliate_public_settings", args: {} },
  { name: "my_affiliate_overview", args: {} },
  { name: "lookup_affiliate_by_code", args: { _code: "__contract_probe__" } },
  { name: "affiliate_leaderboard", args: { _limit: 1 } },
  // eligibility & legal
  { name: "my_eligibility_state", args: {} },
  { name: "pending_legal_acceptances", args: {} },
];

/** Lightweight read probes exercised by the DB health check. */
export const HEALTH_QUERIES: { label: string; path: string }[] = [
  { label: "credits", path: "usage_credits?select=id&limit=1" },
  { label: "feature usage", path: "feature_usage?select=id&limit=1" },
  { label: "user preferences", path: "user_preferences?select=user_id&limit=1" },
  { label: "affiliate profiles", path: "affiliate_profiles?select=id&limit=1" },
  { label: "affiliate commissions", path: "affiliate_commissions?select=id&limit=1" },
  { label: "job matches", path: "job_matches?select=id&limit=1" },
  { label: "tracked jobs", path: "tracked_jobs?select=id&limit=1" },
  { label: "resumes", path: "resumes?select=id&limit=1" },
];

/** PostgREST codes that mean the object does not exist in the schema cache. */
export const MISSING_TABLE_CODE = "PGRST205";
export const MISSING_FUNCTION_CODE = "PGRST202";

export function isMissingObject(body: unknown): boolean {
  const code = (body as { code?: string } | null)?.code;
  return code === MISSING_TABLE_CODE || code === MISSING_FUNCTION_CODE;
}
