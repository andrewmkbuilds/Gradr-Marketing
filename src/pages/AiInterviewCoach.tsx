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

      <section className="mx-auto max-w-3xl text-center">
        <Text variant="overline" tone="primary">
          Live voice practice · Interview Engine
        </Text>
        <Text as="h1" variant="h1" className="mt-3">
          AI Interview Coach
        </Text>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
          Practice a real spoken interview for the exact role you are chasing. Gradr's AI
          interviewer asks, listens, follows up on what you actually said, and hands back a
          scored report showing precisely which answers cost you the offer.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className={buttonVariants({ size: "lg" })}
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
      </section>

      <section className="section-gap" aria-labelledby="how-it-works">
        <Text as="h2" variant="h3" id="how-it-works">
          How the AI interview coach works
        </Text>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.name} className={cardVariants({ variant: "raised" })}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <Text as="h3" variant="h6">
                  <span className="text-muted-foreground">{i + 1}.</span> {step.name}
                </Text>
              </div>
              <Text variant="body-sm" tone="muted" className="mt-3">
                {step.text}
              </Text>
            </li>
          ))}
        </ol>
      </section>

      <section className="section-gap" aria-labelledby="scoring">
        <Text as="h2" variant="h3" id="scoring" className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
          How answers are scored
        </Text>
        <Text variant="body-sm" tone="muted" className="mt-2 max-w-2xl">
          Nothing is a black box. Each dimension is weighted, reported separately, and traced
          back to the signals that produced it.
        </Text>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">
              AI mock interview scoring dimensions, weights, what each measures, and the data signals used
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Dimension</th>
                <th scope="col" className="py-2 pr-4 font-medium">Weight</th>
                <th scope="col" className="py-2 pr-4 font-medium">What it measures</th>
                <th scope="col" className="py-2 font-medium">Signals used</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {SCORING.map((row) => (
                <tr key={row.dimension} className="border-b border-border/50 align-top">
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
                    {row.dimension}
                  </th>
                  <td className="py-3 pr-4 tabular-nums text-foreground">{row.weight}</td>
                  <td className="py-3 pr-4">{row.measures}</td>
                  <td className="py-3">{row.signals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-10 text-lg font-semibold tracking-tight text-foreground">
          What your interview score means
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Interview score bands and what each range means</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                <th scope="col" className="py-2 font-medium">What it means</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {BANDS.map((row) => (
                <tr key={row.band} className="border-b border-border/50">
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
                    {row.band}
                  </th>
                  <td className="py-3">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-gap" aria-labelledby="what-you-get">
        <h2 id="what-you-get" className="text-2xl font-semibold tracking-tight text-foreground">
          What you get after every session
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
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
          ].map((item) => (
            <Card key={item.title}>
              <h3 className="flex items-start gap-2 font-medium text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-gap" aria-labelledby="faq">
        <h2 id="faq" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <MessageSquareQuote className="h-5 w-5 text-primary" aria-hidden="true" />
          AI interview coach FAQ
        </h2>
        <dl className="mt-6 space-y-5">
          {FAQS.map((faq) => (
            <Card key={faq.question}>
              <dt className="font-medium text-foreground">{faq.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section className="section-gap" aria-labelledby="keep-reading">
        <h2 id="keep-reading" className="text-2xl font-semibold tracking-tight text-foreground">
          Keep reading
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            {
              to: "/ats-resume-checker",
              title: "ATS Resume Checker",
              desc: "Get past the parser first — score your resume against the posting before you practice for the room.",
              location: "related_ats",
            },
            {
              to: "/blog/ai-resume-optimization",
              title: "AI Resume Builder & ATS Guide",
              desc: "How ATS parsing, scoring, and ranking actually work, and how to write for both machine and recruiter.",
              location: "related_blog",
            },
            {
              to: "/career-advice",
              title: "Career Advice Guides",
              desc: "Free guides on resumes, cover letters, outreach, and interview preparation.",
              location: "related_advice",
            },
            {
              to: "/job-search",
              title: "Job Search by Role & Location",
              desc: "See what each role asks for so your interview stories match the requirements.",
              location: "related_job_search",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={ctaHref(item.to, item.location)}
              onClick={trackCta(item.location, item.to)}
              className={cn(
                cardVariants(),
                "transition-colors hover:border-primary/50 hover:bg-surface-muted",
              )}
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-gap rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Walk in already having had the conversation
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground/80">
          Run your first spoken mock interview in a few minutes and see exactly where your
          answers hold up. Free to start — no credit card.
        </p>
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-6 gap-2 transition-transform hover:scale-[1.02] motion-reduce:transform-none",
          )}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Start practicing free
        </a>
      </section>
    </PublicShell>
  );
}
