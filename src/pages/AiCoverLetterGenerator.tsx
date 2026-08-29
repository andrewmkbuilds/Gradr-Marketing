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

      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Free tool · Application Engine
        </p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          AI Cover Letter Generator
        </h1>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
          Turn your resume and any job description into a tailored, one-page cover letter in under
          a minute. Gradr matches the posting's requirements to your real experience — no templates,
          no invented achievements.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Write my cover letter free
          </a>
          <Link
            to={ctaHref("/ats-resume-checker", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/ats-resume-checker")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Check my resume first
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Editable drafts · Saved against each application
        </p>
      </section>

      <section className="section-gap" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight text-foreground">
          How the AI cover letter generator works
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
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
            </div>
          ))}
        </div>
      </section>

      <section className="section-gap" aria-labelledby="what-makes-it-different">
        <h2
          id="what-makes-it-different"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          What makes a Gradr letter different
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The problem with most AI cover letters is that they read like every other AI cover letter.
          These are the constraints Gradr writes under.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {DIFFERENCES.map((item) => (
            <div key={item.title} className="rounded-xl border border-border/70 p-5">
              <h3 className="flex items-start gap-2 font-medium text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-gap" aria-labelledby="structure">
        <h2 id="structure" className="text-2xl font-semibold tracking-tight text-foreground">
          The structure Gradr writes to
        </h2>
        <div
          className="mt-6 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          role="group"
          aria-label="Cover letter structure table, scrollable horizontally"
        >
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Cover letter sections and their purpose</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Section</th>
                <th scope="col" className="py-2 font-medium">What it does</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Opening", "Names the role and one specific reason you're a credible fit — never \"I am writing to apply\"."],
                ["Evidence 1", "The strongest requirement in the posting, answered with a measurable result from your resume."],
                ["Evidence 2", "A second requirement, usually the tooling or domain the posting repeats most."],
                ["Close", "A short, concrete next step and your availability."],
              ].map(([section, purpose]) => (
                <tr key={section} className="border-b border-border/50">
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
                    {section}
                  </th>
                  <td className="py-3">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-gap" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-semibold tracking-tight text-foreground">
          AI cover letter generator FAQ
        </h2>
        <dl className="mt-6 space-y-5">
          {FAQS.map((faq) => (
            <div key={faq.question} className="rounded-xl border border-border/70 p-5">
              <dt className="font-medium text-foreground">{faq.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
            </div>
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
              desc: "Score the resume your cover letter is built on against the same job description.",
              location: "related_ats",
            },
            {
              to: "/job-application-tracker",
              title: "Job Application Tracker",
              desc: "Keep every letter, resume version, and follow-up attached to the right application.",
              location: "related_tracker",
            },
            {
              to: "/blog/ai-resume-optimization",
              title: "AI Resume Builder & ATS Guide",
              desc: "How parsing, keywords, and AI rewrites actually affect whether you get read.",
              location: "related_blog",
            },
            {
              to: "/career-advice",
              title: "Career Advice Guides",
              desc: "Free guides on resumes, cover letters, and interview preparation.",
              location: "related_advice",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={ctaHref(item.to, item.location)}
              onClick={trackCta(item.location, item.to)}
              className="rounded-xl border border-border/70 p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-gap rounded-card border border-primary/25 bg-primary/5 p-8 text-center">
        <Text variant="h2" as="h2">
          Stop rewriting the same letter
        </Text>
        <Text variant="body" className="mx-auto mt-3 max-w-xl">
          Paste a job description, pick your resume, and get a tailored draft you can send today.
          Free to start — no credit card.
        </Text>
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className={`${buttonVariants({ size: "lg" })} mt-6 transition-transform hover:scale-[1.02] motion-reduce:transform-none`}
        >
          Generate my cover letter
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </section>
    </PublicShell>
  );
}
