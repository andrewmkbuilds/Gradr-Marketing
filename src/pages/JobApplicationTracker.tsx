import { appSignupHref } from "@/lib/appLinks";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  BarChart3,
  CalendarClock,
  ClipboardList,
  KanbanSquare,
  Mic,
  Sparkles,
  Target,
} from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { FaqBlock } from "@/components/seo/FaqBlock";
import { trackEvent, withUtm } from "@/lib/analytics";
import {
  SITE_NAME,
  SITE_ORIGIN,
  absoluteUrl,
  buildBreadcrumbLd,
  buildFaqLd,
  buildHowToLd,
} from "@/lib/structuredData";

const PATH = "/job-application-tracker";

const UTM = {
  source: "job_application_tracker",
  medium: "landing",
  campaign: "job_application_tracker",
};

const ctaHref = (path: string, content: string) => withUtm(path, { ...UTM, content });

const trackCta = (location: string, destination: string) => () =>
  trackEvent("tracker_landing_cta_click", { location, destination });

const WORKFLOW = [
  {
    icon: Target,
    title: "Capture every role in one pipeline",
    body: "Save a posting and Gradr pulls the company, title, location, salary range and closing date into a single board. No more spreadsheet columns you stopped filling in by week two.",
  },
  {
    icon: Sparkles,
    title: "Score before you apply",
    body: "Each saved role is matched against your resume with an ATS score and a list of missing keywords, so you spend your effort on the applications you can actually win.",
  },
  {
    icon: ClipboardList,
    title: "Generate the tailored application",
    body: "Gradr drafts the tailored resume version and cover letter from your real experience, attaches them to the pipeline card, and keeps the version history for the next similar role.",
  },
  {
    icon: CalendarClock,
    title: "Follow up on schedule",
    body: "Applied on Tuesday? Gradr sets the follow-up for the following week, writes the nudge email, and moves the card forward the moment you hear back.",
  },
  {
    icon: Mic,
    title: "Rehearse before the call",
    body: "When a card reaches Interview, one click launches an AI mock interview built from that exact job description — real voice, real follow-ups, scored transcript.",
  },
  {
    icon: BarChart3,
    title: "Learn from the numbers",
    body: "Response rate by role, by company size, by resume version. The tracker tells you which parts of your search are working so the next fifty applications beat the last fifty.",
  },
];

const STAGES = [
  { stage: "Saved", meaning: "Interesting roles you haven't committed to yet, with match score attached." },
  { stage: "Applied", meaning: "Submitted, with the exact resume version and cover letter you sent." },
  { stage: "Follow-up", meaning: "Waiting on a reply, with a reminder date and a drafted nudge." },
  { stage: "Interview", meaning: "Scheduled conversations, prep notes, and mock interview scorecards." },
  { stage: "Offer", meaning: "Live offers with compensation notes and decision deadlines." },
  { stage: "Closed", meaning: "Rejected or withdrawn — kept, because the pattern in them is the lesson." },
];

const AGAINST_SPREADSHEETS = [
  {
    title: "It updates itself",
    body: "Statuses, follow-up dates, and document versions move with the application instead of relying on you remembering to edit a cell after a stressful phone call.",
  },
  {
    title: "It knows the job description",
    body: "A spreadsheet stores a link. Gradr stores the requirements, so scoring, tailoring, and interview prep all run off the same source of truth.",
  },
  {
    title: "It surfaces what's rotting",
    body: "Applications with no reply after fourteen days rise to the top of the board rather than quietly scrolling out of view.",
  },
  {
    title: "It's honest about outcomes",
    body: "Response and interview rates are computed from your own history — no vanity metrics, no invented benchmarks.",
  },
];

const FAQS = [
  {
    question: "What is a job application tracker?",
    answer:
      "A job application tracker is a single system of record for every role you have saved, applied to, or interviewed for. It stores the job description, the exact resume and cover letter you sent, the current stage, and the next action, so nothing is lost between applying and hearing back.",
  },
  {
    question: "Is the Gradr job application tracker free?",
    answer:
      "Yes. A free Gradr account includes the application pipeline, stage tracking, and follow-up reminders. Paid plans add unlimited AI tailoring, resume versioning, job matching across live postings, and AI mock interviews built from each job description.",
  },
  {
    question: "How is this better than a job search spreadsheet?",
    answer:
      "A spreadsheet records what you did; a tracker moves the search forward. Gradr scores each role against your resume, drafts the tailored application, schedules the follow-up, launches interview practice from the same job description, and reports your response rate by role and resume version.",
  },
  {
    question: "Can I track applications I submitted somewhere else?",
    answer:
      "Yes. You can add any role manually — including applications submitted directly on a company site, through a recruiter, or via referral — and keep it in the same pipeline as roles you found through Gradr job matching.",
  },
  {
    question: "How many jobs should I be applying to?",
    answer:
      "Fewer, better-targeted applications generally outperform volume. The tracker makes that measurable: it shows response rate against match score, so you can see the point where lowering your targeting stops producing replies.",
  },
  {
    question: "When should I follow up on a job application?",
    answer:
      "About five to seven business days after applying, and again after an interview if the stated timeline has passed. Gradr sets those dates automatically when a card changes stage and drafts a short, specific follow-up you can edit and send.",
  },
];

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gradr Job Application Tracker",
  url: absoluteUrl(PATH),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Free job application tracker that scores each role against your resume, drafts tailored applications, schedules follow-ups, and reports your response rate.",
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  inLanguage: "en",
};

export default function JobApplicationTracker() {
  useEffect(() => {
    trackEvent("tracker_landing_page_view", { path: PATH });
  }, []);

  return (
    <PublicShell source="job_application_tracker">
      <JsonLd
        nodes={[
          softwareLd,
          buildHowToLd({
            name: "How to run an AI-powered job application workflow",
            description:
              "Capture roles, score them against your resume, generate tailored applications, follow up on schedule, and rehearse before every interview.",
            path: PATH,
            steps: WORKFLOW.map((s) => ({ name: s.title, text: s.body })),
          }),
          buildFaqLd(FAQS),
          buildBreadcrumbLd([
            { name: "Gradr", path: "/" },
            { name: "Career advice", path: "/career-advice" },
            { name: "Job Application Tracker", path: PATH },
          ]),
        ]}
        label="job-application-tracker"
      />

      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Free tool · Application Engine
        </p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Job Application Tracker
        </h1>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
          Stop losing the job search in a spreadsheet. Gradr keeps every role, resume version,
          follow-up and interview in one intelligent pipeline — and tells you which applications
          are actually worth your afternoon.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
          >
            <KanbanSquare className="h-4 w-4" aria-hidden="true" />
            Start tracking free
          </a>
          <Link
            to={ctaHref("/ats-resume-checker", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/ats-resume-checker")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Score your resume first
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Unlimited saved roles on the free plan · Your documents stay private to your account
        </p>
      </section>

      <section className="section-gap" aria-labelledby="workflow">
        <h2 id="workflow" className="text-2xl font-semibold tracking-tight text-foreground">
          The AI job domination workflow
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Six moves, run in order, on every single role. The tracker is what keeps them connected —
          the job description you saved on Monday is the same one scoring your resume, writing your
          follow-up, and asking your interview questions on Friday.
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {WORKFLOW.map((step, i) => (
            <li
              key={step.title}
              id={`step-${i + 1}`}
              className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="font-medium text-foreground">
                  <span className="text-muted-foreground">{i + 1}.</span> {step.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section-gap" aria-labelledby="stages">
        <h2 id="stages" className="text-2xl font-semibold tracking-tight text-foreground">
          Every application, in a stage that means something
        </h2>
        <div
          className="mt-6 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          role="group"
          aria-label="Application pipeline stages table, scrollable horizontally"
        >
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Gradr job application pipeline stages and what each means</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Stage</th>
                <th scope="col" className="py-2 font-medium">What lives there</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((row) => (
                <tr key={row.stage} className="border-b border-border/60">
                  <th scope="row" className="whitespace-nowrap py-3 pr-4 text-left font-medium text-foreground">
                    {row.stage}
                  </th>
                  <td className="py-3 text-muted-foreground">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-gap" aria-labelledby="vs-spreadsheet">
        <h2
          id="vs-spreadsheet"
          className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"
        >
          <BellRing className="h-5 w-5 text-primary" aria-hidden="true" />
          Why this beats a job search spreadsheet
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {AGAINST_SPREADSHEETS.map((item) => (
            <div key={item.title} className="rounded-xl border border-border/70 p-5">
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-gap">
        <FaqBlock items={FAQS} source="job-application-tracker" />
      </section>

      <section className="section-gap rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">Keep reading</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The tracker works best alongside the rest of the workflow.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { to: "/career-advice", label: "Career advice hub", note: "Guides for resumes, cover letters and interviews" },
            { to: "/ats-resume-checker", label: "ATS resume checker", note: "Score your resume against any posting" },
            { to: "/ai-interview-coach", label: "AI interview coach", note: "Voice mock interviews with scored feedback" },
          ].map((link) => (
            <li key={link.to}>
              <Link
                to={ctaHref(link.to, "related")}
                onClick={trackCta("related", link.to)}
                className="group block h-full rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/50"
              >
                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                  {link.label}
                  <ArrowRight className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{link.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section-gap text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Run your next fifty applications properly
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Create a free account, save your first role, and let Gradr handle the scoring, the
          tailoring, the follow-ups and the interview prep.
        </p>
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
        >
          Start tracking free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </section>
    </PublicShell>
  );
}
