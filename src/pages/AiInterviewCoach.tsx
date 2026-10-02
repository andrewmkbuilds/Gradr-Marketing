import { appSignupHref } from "@/lib/appLinks";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Gauge,
  Mic,
  MessageSquareQuote,
  Sparkles,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { Card, cardVariants } from "@/design-system/gradr-9b9b95/gradr/components/card";
import { PublicShell } from "@/components/PublicShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { trackEvent, withUtm } from "@/lib/analytics";
import {
  SITE_NAME,
  SITE_ORIGIN,
  absoluteUrl,
  buildBreadcrumbLd,
  buildFaqLd,
  buildHowToLd,
  buildScoringTableLd,
} from "@/lib/structuredData";
import {
  ToolHero, ToolSection, ToolEyebrow, ToolHeading,
  ToolStepCard, ToolFeatureCard, ToolCtaSection, ToolTable, ToolRelatedLinks,
} from "@/components/marketing/ToolPrimitives";
import { Reveal } from "@/components/landing/Reveal";

/**
 * Canonical path for the AI interview coach landing page. Every alias
 * (/interview-coach, /ai-mock-interview, trailing-slash and mixed-case
 * variants) redirects here so only one URL is ever indexed — see
 * CANONICAL_ALIASES in src/lib/seo/canonical.ts.
 */
export const AI_INTERVIEW_COACH_PATH = "/ai-interview-coach";

const UTM = {
  source: "ai_interview_coach",
  medium: "landing",
  campaign: "ai_interview_coach",
};

const ctaHref = (path: string, content: string) => withUtm(path, { ...UTM, content });

const trackCta = (location: string, destination: string) => () =>
  trackEvent("interview_coach_cta_click", { location, destination });

const STEPS = [
  {
    icon: Sparkles,
    name: "Set the role and company",
    text: "Choose the job title, seniority, industry, and optionally paste the job description. The coach builds an interviewer persona and question plan for that exact role instead of a generic question bank.",
  },
  {
    icon: Mic,
    name: "Hold a spoken interview",
    text: "Speak your answers out loud in the browser. The AI interviewer listens, asks contextual follow-ups, and lets you interrupt mid-question the way a real interviewer conversation actually flows.",
  },
  {
    icon: Gauge,
    name: "Get a scored report",
    text: "Every session ends with a 0–100 score broken into content, structure, evidence, communication, and role fit, plus the transcript with your strongest and weakest moments marked.",
  },
  {
    icon: Timer,
    name: "Practice the gaps",
    text: "The coach turns each weakness into a short practice plan — the specific questions to redo, the stories to tighten, and the metrics to add before your real interview.",
  },
];

/**
 * The scoring rubric. Rendered as an accessible HTML table and mirrored into
 * JSON-LD as a DefinedTermSet so the criteria are machine-readable.
 */
const SCORING = [
  {
    dimension: "Content relevance",
    weight: "30%",
    measures: "Whether the answer actually addresses the question that was asked.",
    signals: "Question-to-answer semantic overlap, required competency coverage, off-topic drift detection.",
  },
  {
    dimension: "Structure",
    weight: "20%",
    measures: "Whether the answer follows a followable arc such as situation, task, action, result.",
    signals: "Presence and ordering of STAR segments, answer length, time spent on setup versus outcome.",
  },
  {
    dimension: "Evidence and specificity",
    weight: "20%",
    measures: "Whether claims are backed by concrete, verifiable detail.",
    signals: "Named tools and systems, quantified outcomes, scope markers such as team size, timeline, or budget.",
  },
  {
    dimension: "Communication",
    weight: "15%",
    measures: "How clearly and confidently the answer is delivered out loud.",
    signals: "Speaking pace, filler-word density, pause length, sentence complexity, response latency.",
  },
  {
    dimension: "Role fit",
    weight: "15%",
    measures: "How well the answer maps to the seniority and requirements of the target role.",
    signals: "Job-description keyword alignment, ownership versus contribution language, seniority-appropriate scope.",
  },
];

const BANDS = [
  { band: "85–100", meaning: "Interview-ready for this role. Keep the stories warm and rehearse timing." },
  { band: "70–84", meaning: "Solid substance, inconsistent delivery. Tighten structure and add metrics." },
  { band: "55–69", meaning: "Relevant experience is present but under-evidenced or unstructured." },
  { band: "Below 55", meaning: "Answers drift from the question. Rebuild your core stories before applying." },
];

const FAQS = [
  {
    question: "What is an AI interview coach?",
    answer:
      "An AI interview coach runs a realistic mock interview with you, listens to your spoken answers, asks contextual follow-up questions, and scores your performance against the role you are targeting. Gradr's coach holds a live voice conversation and returns a scored report with a full transcript rather than a list of sample answers.",
  },
  {
    question: "Is the Gradr AI interview coach free?",
    answer:
      "Yes. A free Gradr account includes guided AI interview practice with scoring and a transcript. Paid plans add unlimited live voice sessions, company-specific and role-specific simulations, advanced interviewer personas, difficulty control, deep transcript analysis, and PDF scorecard exports.",
  },
  {
    question: "How does the AI interviewer score my answers?",
    answer:
      "Each answer is scored across five weighted dimensions: content relevance (30%), structure (20%), evidence and specificity (20%), communication (15%), and role fit (15%). Every dimension is reported separately with the exact signals behind it, so you can see why a score moved instead of receiving one opaque number.",
  },
  {
    question: "Can I practice interviews for a specific company or job description?",
    answer:
      "Yes. Paste a job description or name the company and role, and the coach builds its question plan and interviewer persona from that context — including the competencies the posting emphasises and the seniority level it expects.",
  },
  {
    question: "Do I need a microphone or special software?",
    answer:
      "You need a browser and a microphone. Sessions run in the browser with no downloads or plugins. If you prefer, you can also run a text-only session and still receive the same scored report.",
  },
  {
    question: "What types of interviews can I practice?",
    answer:
      "Behavioural, competency-based, situational, and role-specific technical discussions across seniority levels from internship to senior professional. You control the difficulty and the interviewer's style, from friendly screening call to demanding panel lead.",
  },
  {
    question: "Are my interview recordings private?",
    answer:
      "Your sessions, transcripts, and scorecards are tied to your account and are not shared with employers or other users. You can delete any session, and you can export or permanently delete all of your account data at any time from your Gradr settings.",
  },
];

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gradr AI Interview Coach",
  url: absoluteUrl(AI_INTERVIEW_COACH_PATH),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI interview coach that runs realistic spoken mock interviews for your target role, asks adaptive follow-up questions, and returns a scored report with a full transcript.",
  featureList: [
    "Live voice mock interviews",
    "Role and company specific question plans",
    "Adaptive follow-up questions",
    "Weighted five-dimension scoring",
    "Full transcript with highlights",
    "Personalized practice plan",
  ],
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  inLanguage: "en",
};

export default function AiInterviewCoach() {
  useEffect(() => {
    trackEvent("interview_coach_page_view", { path: AI_INTERVIEW_COACH_PATH });
  }, []);

  return (
    <PublicShell source="ai_interview_coach">
      <JsonLd
        nodes={[
          softwareLd,
          buildFaqLd(FAQS),
          buildHowToLd({
            name: "How to practice with the Gradr AI interview coach",
            description:
              "Run a realistic spoken mock interview for your target role and turn the scored report into a focused practice plan.",
            path: AI_INTERVIEW_COACH_PATH,
            steps: STEPS.map((s) => ({ name: s.name, text: s.text })),
          }),
        ]}

        label="ai-interview-coach"
      />
      <JsonLd
        nodes={[
          buildScoringTableLd({
            name: "Gradr AI mock interview scoring rubric",
            description:
              "The five weighted dimensions Gradr uses to score a mock interview answer, and the data signals behind each one.",
            path: AI_INTERVIEW_COACH_PATH,
            terms: SCORING.map((row) => ({
              name: row.dimension,
              description: `${row.measures} Weight: ${row.weight}. Signals: ${row.signals}`,
            })),
          }),
          buildBreadcrumbLd([
            { name: "Gradr", path: "/" },
            { name: "AI Interview Coach", path: AI_INTERVIEW_COACH_PATH },
          ]),
        ]}
        label="ai-interview-coach-rubric"
      />

      <ToolHero
        eyebrow="Live voice practice · Interview Engine"
        title="AI Interview Coach"
        lede="Practice a real spoken interview for the exact role you are chasing. Gradr's AI interviewer asks, listens, follows up on what you actually said, and hands back a scored report showing precisely which answers cost you the offer."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            Start a free mock interview
          </a>
          <Link
            to={ctaHref("/pricing", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/pricing")}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            See plans and limits
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Runs in your browser · Sessions stay private to your account
        </p>
      </ToolHero>

      <ToolSection id="how-it-works">
        <Reveal className="space-y-4">
          <ToolEyebrow>How it works</ToolEyebrow>
          <ToolHeading>How the AI interview coach works</ToolHeading>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <ToolStepCard
              key={step.name}
              icon={step.icon}
              index={i + 1}
              title={step.name}
              delay={i * 60}
            >
              {step.text}
            </ToolStepCard>
          ))}
        </div>
      </ToolSection>

      <ToolSection id="scoring" bg="card" sceneVariant="beams" sceneIntensity={0.35}>
        <Reveal className="space-y-4">
          <ToolEyebrow>Scoring</ToolEyebrow>
          <ToolHeading>
            <span className="inline-flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" aria-hidden="true" />
              How answers are scored
            </span>
          </ToolHeading>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nothing is a black box. Each dimension is weighted, reported separately, and traced
            back to the signals that produced it.
          </p>
        </Reveal>
        <div className="mt-8">
          <ToolTable
            caption="AI mock interview scoring dimensions, weights, what each measures, and the data signals used"
            headers={["Dimension", "Weight", "What it measures", "Signals used"]}
            rows={SCORING.map((row) => ({ cells: [row.dimension, row.weight, row.measures, row.signals] }))}
          />
        </div>
        <Reveal className="mt-10 space-y-4">
          <h3 className="type-h2">What your interview score means</h3>
        </Reveal>
        <div className="mt-4">
          <ToolTable
            caption="Interview score bands and what each range means"
            headers={["Score", "What it means"]}
            rows={BANDS.map((row) => ({ cells: [row.band, row.meaning] }))}
          />
        </div>
      </ToolSection>

      <ToolSection id="what-you-get">
        <Reveal className="space-y-4">
          <ToolEyebrow>After every session</ToolEyebrow>
          <ToolHeading>What you get after every session</ToolHeading>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "A scored report, not a vibe check",
              body: "Five weighted dimensions, each with the evidence behind the number and the single change that would move it most.",
            },
            {
              title: "A searchable transcript",
              body: "Every question and answer, timestamped, with your strongest lines and weakest moments marked so you can rehearse the exact sentences.",
            },
            {
              title: "Follow-up question patterns",
              body: "The follow-ups the interviewer chose, and why — so you learn which parts of your story invite pressure.",
            },
            {
              title: "A practice plan for the next session",
              body: "A short, ordered list of questions to redo and stories to rebuild, carried into your next session automatically.",
            },
          ].map((item, i) => (
            <ToolFeatureCard key={item.title} icon={CheckCircle2} title={item.title} delay={i * 50}>
              {item.body}
            </ToolFeatureCard>
          ))}
        </div>
      </ToolSection>

      <ToolSection id="faq" bg="card">
        <Reveal className="space-y-4">
          <ToolEyebrow>FAQ</ToolEyebrow>
          <ToolHeading>
            <span className="inline-flex items-center gap-2">
              <MessageSquareQuote className="h-6 w-6 text-primary" aria-hidden="true" />
              AI interview coach FAQ
            </span>
          </ToolHeading>
        </Reveal>
        <div className="mt-8 space-y-4">
          {FAQS.map((faq, i) => (
            <Reveal key={faq.question} delay={i * 40}>
              <Card variant="outline" padding="lg" className="card-glow">
                <Text variant="h6" as="dt">{faq.question}</Text>
                <Text variant="body-sm" tone="muted" as="dd" className="mt-2">{faq.answer}</Text>
              </Card>
            </Reveal>
          ))}
        </div>
      </ToolSection>

      <ToolRelatedLinks
        links={[
          {
            to: ctaHref("/ats-resume-checker", "related_ats"),
            title: "ATS Resume Checker",
            desc: "Get past the parser first — score your resume against the posting before you practice for the room.",
            onClick: trackCta("related_ats", "/ats-resume-checker"),
          },
          {
            to: ctaHref("/blog/ai-resume-optimization", "related_blog"),
            title: "AI Resume Builder & ATS Guide",
            desc: "How ATS parsing, scoring, and ranking actually work, and how to write for both machine and recruiter.",
            onClick: trackCta("related_blog", "/blog/ai-resume-optimization"),
          },
          {
            to: ctaHref("/career-advice", "related_advice"),
            title: "Career Advice Guides",
            desc: "Free guides on resumes, cover letters, outreach, and interview preparation.",
            onClick: trackCta("related_advice", "/career-advice"),
          },
          {
            to: ctaHref("/job-search", "related_job_search"),
            title: "Job Search by Role & Location",
            desc: "See what each role asks for so your interview stories match the requirements.",
            onClick: trackCta("related_job_search", "/job-search"),
          },
        ]}
      />

      <ToolCtaSection
        title="Walk in already having had the conversation"
        lede="Run your first spoken mock interview in a few minutes and see exactly where your answers hold up. Free to start — no credit card."
      >
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Start practicing free
        </a>
      </ToolCtaSection>
    </PublicShell>
  );
}
