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
import { cn } from "@/lib/utils";
import { Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
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
import {
  ToolHero, ToolSection, ToolEyebrow, ToolHeading,
  ToolStepCard, ToolFeatureCard, ToolCtaSection, ToolTable, ToolRelatedLinks,
} from "@/components/marketing/ToolPrimitives";
import { Reveal } from "@/components/landing/Reveal";

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

      <ToolHero
        eyebrow="Free tool · Application Engine"
        title="Job Application Tracker"
        lede="Stop losing the job search in a spreadsheet. Gradr keeps every role, resume version, follow-up and interview in one intelligent pipeline — and tells you which applications are actually worth your afternoon."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
          >
            <KanbanSquare className="h-4 w-4" aria-hidden="true" />
            Start tracking free
          </a>
          <Link
            to={ctaHref("/ats-resume-checker", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/ats-resume-checker")}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Score your resume first
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Unlimited saved roles on the free plan · Your documents stay private to your account
        </p>
      </ToolHero>

      <ToolSection id="workflow">
        <Reveal className="space-y-4">
          <ToolEyebrow>The workflow</ToolEyebrow>
          <ToolHeading>The AI job domination workflow</ToolHeading>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Six moves, run in order, on every single role. The tracker is what keeps them connected —
            the job description you saved on Monday is the same one scoring your resume, writing your
            follow-up, and asking your interview questions on Friday.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {WORKFLOW.map((step, i) => (
            <ToolStepCard
              key={step.title}
              icon={step.icon}
              index={i + 1}
              title={step.title}
              delay={i * 60}
            >
              {step.body}
            </ToolStepCard>
          ))}
        </div>
      </ToolSection>

      <ToolSection id="stages" bg="card" sceneVariant="gridscan" sceneIntensity={0.3}>
        <Reveal className="space-y-4">
          <ToolEyebrow>Pipeline stages</ToolEyebrow>
          <ToolHeading>Every application, in a stage that means something</ToolHeading>
        </Reveal>
        <div className="mt-8">
          <ToolTable
            caption="Gradr job application pipeline stages and what each means"
            headers={["Stage", "What lives there"]}
            rows={STAGES.map((row) => ({ cells: [row.stage, row.meaning] }))}
          />
        </div>
      </ToolSection>

      <ToolSection id="vs-spreadsheet">
        <Reveal className="space-y-4">
          <ToolEyebrow>Why it's better</ToolEyebrow>
          <ToolHeading>
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-6 w-6 text-primary" aria-hidden="true" />
              Why this beats a job search spreadsheet
            </span>
          </ToolHeading>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {AGAINST_SPREADSHEETS.map((item, i) => (
            <ToolFeatureCard key={item.title} title={item.title} delay={i * 50}>
              {item.body}
            </ToolFeatureCard>
          ))}
        </div>
      </ToolSection>

      <ToolSection bg="card">
        <Reveal className="space-y-4">
          <ToolEyebrow>FAQ</ToolEyebrow>
        </Reveal>
        <div className="mt-8">
          <FaqBlock items={FAQS} source="job-application-tracker" />
        </div>
      </ToolSection>

      <ToolRelatedLinks
        links={[
          {
            to: ctaHref("/career-advice", "related"),
            title: "Career advice hub",
            desc: "Guides for resumes, cover letters and interviews",
            onClick: trackCta("related", "/career-advice"),
          },
          {
            to: ctaHref("/ats-resume-checker", "related"),
            title: "ATS resume checker",
            desc: "Score your resume against any posting",
            onClick: trackCta("related", "/ats-resume-checker"),
          },
          {
            to: ctaHref("/ai-interview-coach", "related"),
            title: "AI interview coach",
            desc: "Voice mock interviews with scored feedback",
            onClick: trackCta("related", "/ai-interview-coach"),
          },
        ]}
      />

      <ToolCtaSection
        title="Run your next fifty applications properly"
        lede="Create a free account, save your first role, and let Gradr handle the scoring, the tailoring, the follow-ups and the interview prep."
      >
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
        >
          Start tracking free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </ToolCtaSection>
    </PublicShell>
  );
}
