import { appSignupHref } from "@/lib/appLinks";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  PenLine,
  Sparkles,
  Target,
} from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { trackEvent, withUtm } from "@/lib/analytics";
import {
  SITE_NAME,
  SITE_ORIGIN,
  absoluteUrl,
  buildBreadcrumbLd,
  buildFaqLd,
} from "@/lib/structuredData";
import {
  ToolHero, ToolSection, ToolEyebrow, ToolHeading,
  ToolStepCard, ToolFeatureCard, ToolCtaSection, ToolTable, ToolRelatedLinks,
} from "@/components/marketing/ToolPrimitives";
import { Reveal } from "@/components/landing/Reveal";
import { Card } from "@/design-system/gradr-9b9b95";
import { cn } from "@/lib/utils";

const PATH = "/ai-cover-letter-generator";

const UTM = {
  source: "ai_cover_letter_generator",
  medium: "landing",
  campaign: "ai_cover_letter_generator",
};

const ctaHref = (path: string, content: string) => withUtm(path, { ...UTM, content });

const trackCta = (location: string, destination: string) => () =>
  trackEvent("cover_letter_cta_click", { location, destination });

const STEPS = [
  {
    icon: FileText,
    title: "Start from your real resume",
    body: "Gradr reads the resume already in your workspace — roles, dates, tools, and measurable results — so every paragraph is grounded in work you actually did.",
  },
  {
    icon: ClipboardList,
    title: "Paste the job description",
    body: "The Application Engine extracts the responsibilities, required tools, and seniority signals from the posting and decides which parts of your history matter for this role.",
  },
  {
    icon: PenLine,
    title: "Generate a tailored draft",
    body: "You get a one-page letter with a specific opening, two evidence paragraphs tied to the posting's requirements, and a close that names the next step — not a template with your name pasted in.",
  },
  {
    icon: Target,
    title: "Edit, save, and reuse",
    body: "Adjust tone, length, and emphasis, then save the version against that application so follow-ups and interview prep stay consistent with what you sent.",
  },
];

const DIFFERENCES = [
  {
    title: "Written against one posting",
    body: "Generic letters restate the resume. Gradr maps each requirement in the job description to a concrete example from your experience, and tells you when there's no honest match to draw on.",
  },
  {
    title: "No invented experience",
    body: "The generator only uses claims that exist in your resume or profile. It will suggest reframing what you have rather than fabricating a title, metric, or employer.",
  },
  {
    title: "Keyword-aware, not keyword-stuffed",
    body: "The same terminology that drives ATS resume scoring shows up naturally in the letter, so recruiters and parsers read a consistent application.",
  },
  {
    title: "Attached to your pipeline",
    body: "Each letter is stored with the application it belongs to, next to the tailored resume version, match score, and follow-up reminders.",
  },
  {
    title: "Tone you control",
    body: "Choose direct, warm, or formal, and set length. Startup applications and public-sector applications should not sound identical.",
  },
  {
    title: "Fast enough to actually apply",
    body: "A tailored draft takes under a minute, which is the difference between applying to three roles a week and applying to fifteen.",
  },
];

const FAQS = [
  {
    question: "What is an AI cover letter generator?",
    answer:
      "An AI cover letter generator writes a job-specific cover letter from your resume and a job description. Gradr's version reads both, matches the posting's requirements to evidence in your own experience, and drafts a one-page letter you can edit before sending.",
  },
  {
    question: "Is the Gradr AI cover letter generator free?",
    answer:
      "You can create a free Gradr account and generate cover letters to try the workflow. Paid plans add higher generation limits, saved versions per application, tone controls, and the full Application Engine with tailored resumes and follow-up tracking.",
  },
  {
    question: "Will recruiters know a cover letter was AI-generated?",
    answer:
      "A generic AI letter is obvious because it restates the resume in bland language. Gradr avoids that by grounding every paragraph in specifics from your history and the posting. Always read the draft, cut anything that does not sound like you, and add a personal reason for applying.",
  },
  {
    question: "Does a cover letter still matter in 2026?",
    answer:
      "It matters most when the application is competitive, when you are changing industries, or when the posting explicitly asks for one. In those cases the letter is where you explain the transition or the gap that a resume cannot express on its own.",
  },
  {
    question: "How long should a cover letter be?",
    answer:
      "Around 250 to 350 words — an opening, two short evidence paragraphs, and a close. Gradr defaults to that length and lets you shorten it further for postings that ask for a brief note.",
  },
  {
    question: "Can I use the same cover letter for multiple jobs?",
    answer:
      "Reusing one letter is the fastest way to sound generic. Gradr keeps your saved letters so you can regenerate against a new posting in seconds instead of rewriting from scratch, which keeps every application specific without the time cost.",
  },
];

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gradr AI Cover Letter Generator",
  url: absoluteUrl(PATH),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI cover letter generator that writes a tailored, one-page cover letter from your resume and a specific job description, grounded in your real experience.",
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  inLanguage: "en",
};

export default function AiCoverLetterGenerator() {
  useEffect(() => {
    trackEvent("cover_letter_page_view", { path: PATH });
  }, []);

  return (
    <PublicShell source="ai_cover_letter_generator">
      <JsonLd
        nodes={[
          softwareLd,
          buildFaqLd(FAQS),
          buildBreadcrumbLd([
            { name: "Gradr", path: "/" },
            { name: "AI Cover Letter Generator", path: PATH },
          ]),
        ]}
        label="ai-cover-letter-generator"
      />

      <ToolHero
        eyebrow="Free tool · Application Engine"
        title="AI Cover Letter Generator"
        lede="Turn your resume and any job description into a tailored, one-page cover letter in under a minute. Gradr matches the posting's requirements to your real experience — no templates, no invented achievements."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Write my cover letter free
          </a>
          <Link
            to={ctaHref("/ats-resume-checker", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/ats-resume-checker")}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Check my resume first
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Editable drafts · Saved against each application
        </p>
      </ToolHero>

      <ToolSection id="how-it-works">
        <Reveal className="space-y-4">
          <ToolEyebrow>How it works</ToolEyebrow>
          <ToolHeading>How the AI cover letter generator works</ToolHeading>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
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

      <ToolSection id="what-makes-it-different" bg="card" sceneVariant="threads" sceneIntensity={0.3}>
        <Reveal className="space-y-4">
          <ToolEyebrow>What makes it different</ToolEyebrow>
          <ToolHeading>What makes a Gradr letter different</ToolHeading>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The problem with most AI cover letters is that they read like every other AI cover letter.
            These are the constraints Gradr writes under.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {DIFFERENCES.map((item, i) => (
            <ToolFeatureCard key={item.title} icon={CheckCircle2} title={item.title} delay={i * 50}>
              {item.body}
            </ToolFeatureCard>
          ))}
        </div>
      </ToolSection>

      <ToolSection id="structure">
        <Reveal className="space-y-4">
          <ToolEyebrow>Structure</ToolEyebrow>
          <ToolHeading>The structure Gradr writes to</ToolHeading>
        </Reveal>
        <div className="mt-8">
          <ToolTable
            caption="Cover letter sections and their purpose"
            headers={["Section", "What it does"]}
            rows={[
              ["Opening", "Names the role and one specific reason you're a credible fit — never \"I am writing to apply\"."],
              ["Evidence 1", "The strongest requirement in the posting, answered with a measurable result from your resume."],
              ["Evidence 2", "A second requirement, usually the tooling or domain the posting repeats most."],
              ["Close", "A short, concrete next step and your availability."],
            ].map(([section, purpose]) => ({ cells: [section, purpose] }))}
          />
        </div>
      </ToolSection>

      <ToolSection id="faq" bg="card">
        <Reveal className="space-y-4">
          <ToolEyebrow>FAQ</ToolEyebrow>
          <ToolHeading>AI cover letter generator FAQ</ToolHeading>
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
            desc: "Score the resume your cover letter is built on against the same job description.",
            onClick: trackCta("related_ats", "/ats-resume-checker"),
          },
          {
            to: ctaHref("/job-application-tracker", "related_tracker"),
            title: "Job Application Tracker",
            desc: "Keep every letter, resume version, and follow-up attached to the right application.",
            onClick: trackCta("related_tracker", "/job-application-tracker"),
          },
          {
            to: ctaHref("/blog/ai-resume-optimization", "related_blog"),
            title: "AI Resume Builder & ATS Guide",
            desc: "How parsing, keywords, and AI rewrites actually affect whether you get read.",
            onClick: trackCta("related_blog", "/blog/ai-resume-optimization"),
          },
          {
            to: ctaHref("/career-advice", "related_advice"),
            title: "Career Advice Guides",
            desc: "Free guides on resumes, cover letters, and interview preparation.",
            onClick: trackCta("related_advice", "/career-advice"),
          },
        ]}
      />

      <ToolCtaSection
        title="Stop rewriting the same letter"
        lede="Paste a job description, pick your resume, and get a tailored draft you can send today. Free to start — no credit card."
      >
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
        >
          Generate my cover letter
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </ToolCtaSection>
    </PublicShell>
  );
}
