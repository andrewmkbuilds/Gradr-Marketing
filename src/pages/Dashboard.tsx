import { useEffect } from "react";
import { SkeletonList, SkeletonPanel } from "@/components/states";
import { trackOnce } from "@/lib/telemetry/events";
import { FileText, Target, Zap, Mic, TrendingUp, Briefcase, Bookmark, Send, CalendarCheck, Trophy, XCircle, Bell, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ScoreRing } from "@/components/ScoreRing";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { CreditsBalance } from "@/components/CreditsBalance";
import { PaymentIssueBanner } from "@/components/PaymentIssueBanner";
import { PurchaseSuccessToast } from "@/components/billing/PurchaseSuccessToast";
import { UsageBars } from "@/components/UsageBars";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { CareerReadiness, type ReadinessPillar } from "@/components/dashboard/CareerReadiness";
import { ActivityChart, PipelineFunnelChart, type ActivityPoint } from "@/components/dashboard/DashboardCharts";
import { CountUp } from "@/components/motion";
import { ThreeDayPlan } from "@/components/dashboard/ThreeDayPlan";
import { FollowUpReminders } from "@/components/dashboard/FollowUpReminders";


interface DashboardStats {
  resumeScore: number;
  keywordMatch: number;
  formattingScore: number;
  impactScore: number;
  totalMatches: number;
  highConfidence: number;
  totalResumes: number;
  interviewRate: string;
  appliedThisWeek: number;
}

interface StageCount {
  saved: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
}

interface ReminderRow {
  id: string;
  title: string;
  due_at: string;
  done: boolean;
  tracked_jobs?: { title: string; company: string | null } | null;
}

const STAGE_META: { key: keyof StageCount; label: string; icon: typeof Bookmark; color: string }[] = [
  { key: "saved", label: "Saved", icon: Bookmark, color: "text-muted-foreground" },
  { key: "applied", label: "Applied", icon: Send, color: "text-primary" },
  { key: "interview", label: "Interview", icon: CalendarCheck, color: "text-warning" },
  { key: "offer", label: "Offer", icon: Trophy, color: "text-success" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "text-destructive" },
];

/** Names the lowest-scoring resume sub-metric so the drill-down can point at it. */
function weakestResumeArea(s: DashboardStats) {
  const areas = [
    { label: "keyword coverage", value: s.keywordMatch },
    { label: "formatting", value: s.formattingScore },
    { label: "impact statements", value: s.impactScore },
  ].sort((a, b) => a.value - b.value);
  return `Lowest signal right now: ${areas[0].label} at ${areas[0].value}%.`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Activation view: the signed-in home of the product.
  useEffect(() => {
    if (user) trackOnce("career_dashboard_viewed", {}, "dashboard");
  }, [user]);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: loadDashboard,
  });

  async function loadDashboard() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const now = new Date();

    const [resumeRes, matchRes, trackedRes, remindersRes, interviewRes] = await Promise.all([
      supabase
        .from("resumes")
        .select("ats_score, keyword_match, formatting_score, impact_score")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("job_matches")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("tracked_jobs")
        .select("status, applied_at, created_at")
        .eq("user_id", user!.id),
      supabase
        .from("job_reminders")
        .select("id, title, due_at, done, tracked_jobs(title, company)")
        .eq("user_id", user!.id)
        .eq("done", false)
        .order("due_at", { ascending: true })
        .limit(20),
      supabase
        .from("interview_sessions")
        .select("created_at, overall_score")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const resume = resumeRes.data?.[0];
    const matches = matchRes.data || [];
    const tracked = trackedRes.data || [];
    const highConf = matches.filter((m) => (m.match_score ?? 0) >= 85).length;

    const stageCounts: StageCount = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    let appliedThisWeek = 0;
    tracked.forEach((t) => {
      const k = (t.status || "saved") as keyof StageCount;
      if (k in stageCounts) stageCounts[k]++;
      if (t.applied_at && new Date(t.applied_at) >= weekAgo) appliedThisWeek++;
    });

    const allReminders = (remindersRes.data || []) as ReminderRow[];
    const overdue = allReminders.filter((r) => new Date(r.due_at) < now).length;

    const stats: DashboardStats = {
      resumeScore: resume?.ats_score ?? 0,
      keywordMatch: resume?.keyword_match ?? 0,
      formattingScore: resume?.formatting_score ?? 0,
      impactScore: resume?.impact_score ?? 0,
      totalMatches: matches.length,
      highConfidence: highConf,
      totalResumes: resumeRes.data?.length ?? 0,
      interviewRate: matches.length > 0 ? `${Math.round((highConf / matches.length) * 100)}%` : "—",
      appliedThisWeek,
    };

    // Eight-week momentum series from tracked jobs + interview sessions.
    const sessions = (interviewRes.data || []) as { created_at: string; overall_score: number | null }[];
    const weeks: ActivityPoint[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      weeks.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        applications: tracked.filter((t) => t.applied_at && inRange(t.applied_at, start, end)).length,
        interviews: sessions.filter((x) => inRange(x.created_at, start, end)).length,
      });
    }

    const scored = sessions.filter((x) => typeof x.overall_score === "number");
    const interviewAvg = scored.length
      ? Math.round(scored.reduce((a, x) => a + (x.overall_score ?? 0), 0) / scored.length)
      : 0;

    return {
      stats,
      activity: weeks,
      interviewCount: sessions.length,
      interviewAvg,
      stages: stageCounts,
      reminders: allReminders.slice(0, 5),
      overdueCount: overdue,
      jobMatches: matches.slice(0, 4),
    };
  }

  function inRange(iso: string, start: Date, end: Date) {
    const d = new Date(iso).getTime();
    return d >= start.getTime() && d < end.getTime();
  }

  if (loading) {
    return (
      <div className="page-shell page-stack mx-auto max-w-6xl" aria-busy="true">
        <SkeletonPanel lines={2} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPanel key={i} lines={1} />
          ))}
        </div>
        <SkeletonList rows={2} />
      </div>
    );
  }

  const stats = data!.stats;
  const stages = data!.stages;
  const reminders = data!.reminders;
  const overdueCount = data!.overdueCount;
  const jobMatches = data!.jobMatches;
  const s = stats;
  const activity = data!.activity;
  const totalTracked = stages.saved + stages.applied + stages.interview + stages.offer + stages.rejected;
  const activeStages = stages.applied + stages.interview + stages.offer;

  // Composite readiness: resume quality, match strength, activity, practice.
  const pillars: ReadinessPillar[] = [
    {
      key: "resume", label: "Resume strength", weight: 3, value: s.resumeScore,
      hint: s.resumeScore > 0 ? "Latest ATS score across your resumes." : "Upload a resume to unlock this pillar.",
      signals: [
        { label: "Latest ATS score", value: s.resumeScore ? `${s.resumeScore}/100` : "no resume" },
        { label: "Keyword match", value: `${s.keywordMatch}%` },
        { label: "Formatting", value: `${s.formattingScore}%` },
        { label: "Impact statements", value: `${s.impactScore}%` },
      ],
      actions: s.resumeScore > 0
        ? [
            { label: "Fix the weakest resume section", detail: weakestResumeArea(s), to: "/resume" },
            { label: "Generate a tailored version", detail: "Rewrite for a specific role before applying.", to: "/apply" },
          ]
        : [{ label: "Upload your resume", detail: "Get an ATS score and section-level fixes in seconds.", to: "/resume" }],
    },
    {
      key: "matching", label: "Match quality", weight: 2,
      value: s.totalMatches ? (s.highConfidence / s.totalMatches) * 100 : 0,
      hint: `${s.highConfidence} of ${s.totalMatches || 0} matches above 85%.`,
      signals: [
        { label: "Scored matches", value: String(s.totalMatches) },
        { label: "Above 85% match", value: String(s.highConfidence) },
        { label: "High-confidence ratio", value: s.interviewRate },
      ],
      actions: [
        { label: "Refine your job search filters", detail: "Tighter titles and locations raise match scores.", to: "/jobs" },
        { label: "Re-score matches with your latest resume", detail: "Match quality follows resume quality.", to: "/match" },
      ],
    },
    {
      key: "activity", label: "Application activity", weight: 2,
      value: Math.min(100, (s.appliedThisWeek / 5) * 100),
      hint: `${s.appliedThisWeek} applied this week — 5 a week keeps momentum.`,
      signals: [
        { label: "Applied this week", value: `${s.appliedThisWeek} of 5 target` },
        { label: "Active pipeline", value: String(activeStages) },
        { label: "Overdue follow-ups", value: String(overdueCount) },
      ],
      actions: [
        ...(s.appliedThisWeek < 5
          ? [{ label: `Send ${5 - s.appliedThisWeek} more application${5 - s.appliedThisWeek === 1 ? "" : "s"} this week`, detail: "Quick Apply builds the pack for you.", to: "/apply" }]
          : []),
        ...(overdueCount > 0
          ? [{ label: `Clear ${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"}`, detail: "Follow-ups convert far better than new applications.", to: "/pipeline" }]
          : []),
        { label: "Review your pipeline", detail: "Move stale saved jobs forward or archive them.", to: "/pipeline" },
      ],
    },
    {
      key: "practice", label: "Interview practice", weight: 3,
      value: data!.interviewAvg || Math.min(60, data!.interviewCount * 20),
      hint: data!.interviewCount
        ? `${data!.interviewCount} mock sessions, avg score ${data!.interviewAvg || "—"}.`
        : "Run a mock interview to score this pillar.",
      signals: [
        { label: "Mock sessions", value: String(data!.interviewCount) },
        { label: "Average score", value: data!.interviewAvg ? `${data!.interviewAvg}/100` : "not scored yet" },
      ],
      actions: [
        { label: data!.interviewCount ? "Run another mock interview" : "Run your first mock interview", detail: "Live AI interviewer with a scored debrief.", to: "/interview" },
        ...(data!.interviewCount ? [{ label: "Review your last scorecard", detail: "Work the lowest-scoring competency first.", to: "/interview" }] : []),
      ],
    },
  ];

  const funnel = [
    { label: "Saved", value: stages.saved, chart: 5 },
    { label: "Applied", value: stages.applied, chart: 1 },
    { label: "Interview", value: stages.interview, chart: 3 },
    { label: "Offer", value: stages.offer, chart: 6 },
    { label: "Rejected", value: stages.rejected, chart: 2 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
      <PurchaseSuccessToast />
      <div>
        <h1 className="type-h2 tracking-tight text-foreground sm:text-2xl">Career Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI-powered career command center</p>
      </div>

      <PaymentIssueBanner />
      <CreditsBalance />
      <UsageBars />



      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} title="Resume Score" value={s.resumeScore > 0 ? String(s.resumeScore) : "—"} subtitle={s.resumeScore > 0 ? "Latest ATS score" : "Upload a resume"} glowing={s.resumeScore > 0} />
        <StatCard icon={Send} title="Applied This Week" value={String(s.appliedThisWeek)} subtitle={`${stages.applied} total in pipeline`} />
        <StatCard icon={Briefcase} title="Pipeline" value={String(totalTracked)} subtitle={`${activeStages} active`} />
        <StatCard icon={TrendingUp} title="Match Rate" value={s.interviewRate} subtitle="High-confidence ratio" />
      </div>

      {/* Level 3: the headline signal of the whole product. */}
      <CareerReadiness pillars={pillars} />

      {/* Level 3: AI-sequenced next actions. */}
      <ThreeDayPlan />

      <FollowUpReminders />

      {/* Level 2: supporting analytics. */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <ActivityChart data={activity} />
        <PipelineFunnelChart data={funnel} />
      </div>

      {/* Pipeline stage breakdown */}
      <Surface level={2}>
        <SurfaceHeader
          title="Pipeline by Stage"
          icon={Briefcase}
          action={
            <button onClick={() => navigate("/pipeline")} className="link-accent text-xs font-medium">
              View pipeline →
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {STAGE_META.map((stage) => (
            <button
              key={stage.key}
              onClick={() => navigate("/pipeline")}
              className="elev-1 elev-interactive flex min-h-11 flex-col items-start rounded-lg p-3 text-left sm:p-4"
            >
              <stage.icon className={`h-4 w-4 ${stage.color} mb-2`} />
              <span className="stat-value text-foreground">
                <CountUp to={stages[stage.key]} duration={0.9} />
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">{stage.label}</span>
            </button>
          ))}
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Resume Health */}
        <Surface level={2}>
          <SurfaceHeader title="Resume Health" icon={FileText} />
          <div className="flex items-center justify-center py-4">
            <ScoreRing score={s.resumeScore} size={140} label="ATS Score" />
          </div>
          <div className="space-y-3 mt-4">
            {[
              { label: "Keyword Match", value: s.keywordMatch },
              { label: "Formatting", value: s.formattingScore },
              { label: "Impact Statements", value: s.impactScore },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground">{item.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-1000"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Surface>

        {/* Upcoming Reminders */}
        <Surface level={2} className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bell className="h-4 w-4 text-mahogany" />
              Upcoming Reminders
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {overdueCount} overdue
                </span>
              )}
            </h3>
            <button onClick={() => navigate("/pipeline")} className="link-accent text-xs font-medium">
              Manage →
            </button>
          </div>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No upcoming reminders. Add follow-ups from the Pipeline.
            </p>
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => {
                const isOverdue = new Date(r.due_at) < new Date();
                return (
                  <div
                    key={r.id}
                    className="elev-1 elev-interactive flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.tracked_jobs?.title || "—"}
                        {r.tracked_jobs?.company ? ` · ${r.tracked_jobs.company}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs shrink-0 ml-3 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </div>

      {/* Recent Job Matches */}
      <Surface level={2}>
        <SurfaceHeader title="Recent Job Matches" icon={Target} />
        {jobMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No job matches yet. Use the Job Feed to find opportunities.</p>
        ) : (
          <div className="space-y-3">
            {jobMatches.map((match) => (
              <div
                key={match.id}
                className="elev-1 elev-interactive flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{(match.company || "?")[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{match.job_title}</p>
                    <p className="text-xs text-muted-foreground">{match.company || "Unknown"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="accent-chip tabular-nums">{match.match_score ?? 0}% match</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* Quick Actions */}
      <Surface level={2}>
        <SurfaceHeader title="Quick Actions" icon={Zap} />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          {[
            { icon: FileText, label: "Optimize Resume", desc: "Improve your ATS score", path: "/resume" },
            { icon: Target, label: "Find Jobs", desc: "AI-matched opportunities", path: "/jobs" },
            { icon: Zap, label: "Quick Apply", desc: "Generate application pack", path: "/apply" },
            { icon: Mic, label: "Mock Interview", desc: "Practice with AI coach", path: "/interview" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="elev-1 elev-interactive accent-hover group flex min-h-11 flex-col items-start rounded-lg p-3 text-left sm:p-4"
            >
              <action.icon className="mb-3 h-5 w-5 text-primary transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium text-foreground">{action.label}</span>
              <span className="mt-0.5 text-xs text-muted-foreground">{action.desc}</span>
            </button>
          ))}
        </div>
      </Surface>
    </div>
  );
}
