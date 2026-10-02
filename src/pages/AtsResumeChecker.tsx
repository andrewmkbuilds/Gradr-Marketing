import { appSignupHref } from "@/lib/appLinks";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Gauge,
  ListChecks,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { Card, Text } from "@/design-system/gradr-9b9b95";
import { JsonLd } from "@/components/seo/JsonLd";
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
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { cn } from "@/lib/utils";

const PATH = "/ats-resume-checker";

const UTM = {
  source: "ats_resume_checker",
  medium: "landing",
  campaign: "ats_resume_checker",
};

const ctaHref = (path: string, content: string) => withUtm(path, { ...UTM, content });

const trackCta = (location: string, destination: string) => () =>
  trackEvent("ats_checker_cta_click", { location, destination });

const STEPS = [
  {
    icon: Upload,
    title: "Upload your resume",
    body: "Drop in a PDF or DOCX. Gradr parses it exactly the way an ATS does — plain text, section by section — so you see what the machine sees, not what your design tool shows you.",
  },
  {
    icon: FileSearch,
    title: "Paste the job description",
    body: "Scoring is always relative to one posting. Gradr extracts the required skills, tools, and seniority signals from the job description and maps them against your resume.",
  },
  {
    icon: Gauge,
    title: "Get a 0–100 ATS score",
    body: "A deterministic score broken down into keyword coverage, formatting parseability, impact language, and structure — with the exact terms you're missing.",
  },
  {
    icon: ListChecks,
    title: "Fix it line by line",
    body: "Every finding comes with a concrete rewrite you can accept or edit. No invented experience — just your real work in the language the parser scores.",
  },
];

const ISSUES = [
  {
    title: "Multi-column and table layouts",
    body: "Parsers read left to right across the whole page. A two-column template interleaves your job titles with your skills list, and the ATS stores unreadable fragments.",
  },
  {
    title: "Contact details in headers or footers",
    body: "Many ATS parsers drop header and footer regions entirely. Your email and phone number disappear, and recruiters can't contact you even if you rank.",
  },
  {
    title: "Missing exact-match keywords",
    body: "\"Managed cloud infrastructure\" doesn't match a posting asking for \"AWS\". Gradr flags each required term and shows where in your experience it honestly belongs.",
  },
  {
    title: "Non-standard section headings",
    body: "\"My Journey\" or \"What I Bring\" are invisible to field mapping. Standard headings — Experience, Education, Skills — let the parser assign your content correctly.",
  },
  {
    title: "Scanned PDFs and text-in-image resumes",
    body: "If the text isn't selectable, the ATS scores an empty document. Gradr detects unparseable files before you ever submit one.",
  },
  {
    title: "Inconsistent or missing dates",
    body: "Years-of-experience filters rely on parseable date ranges. Mixed formats or missing end dates can silently disqualify you from a requirement you actually meet.",
  },
];

const SCORE_BANDS = [
  { band: "90–100", meaning: "Top-tier for this specific posting. Submit it." },
  { band: "80–89", meaning: "Strong. Close one or two keyword gaps and resubmit." },
  { band: "60–79", meaning: "Parseable but under-targeted — missing required terms." },
  { band: "Below 60", meaning: "Formatting or keyword problems the ATS can't get past." },
];

const FAQS = [
  {
    question: "What is an ATS resume checker?",
    answer:
      "An ATS resume checker parses your resume the same way Applicant Tracking Systems such as Workday, Greenhouse, Lever, Taleo, and iCIMS do, then scores it against a specific job description. It reports keyword coverage, formatting problems, and structural issues that stop recruiters from ever seeing your application.",
  },
  {
    question: "Is the Gradr ATS resume checker free?",
    answer:
      "Yes. You can create a free Gradr account and run ATS resume checks with a full score breakdown and the list of missing keywords. Paid plans add unlimited checks, AI bullet rewrites, resume versioning, and job-matching across live postings.",
  },
  {
    question: "How accurate is an ATS resume score?",
    answer:
      "Gradr uses deterministic scoring rather than a black-box guess: keyword coverage, parseability, structure, and impact language are each measured and shown separately. The score reflects how a real parser handles your file, but no external tool can read a specific employer's private ranking configuration.",
  },
  {
    question: "What file format works best for an ATS?",
    answer:
      "A single-column PDF or DOCX with selectable text, standard section headings, plain bullets, and no tables or images. Avoid scanned documents, text inside graphics, and placing contact details inside a page header or footer.",
  },
  {
    question: "How many keywords should my resume include?",
    answer:
      "Cover every hard skill, tool, and requirement in the posting at least once, using the posting's exact phrasing. Coverage matters far more than repetition — keyword stuffing does not raise your ATS score and reads badly to the recruiter who eventually opens the file.",
  },
  {
    question: "Should I tailor my resume for every job application?",
    answer:
      "Yes. ATS scoring is always relative to one job description, so a resume that scores 92 for one posting can score 61 for another. Gradr keeps versioned resumes so you can tailor quickly for each role instead of rewriting from scratch every time.",
  },
];

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gradr ATS Resume Checker",
  url: absoluteUrl(PATH),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Free ATS resume checker that scores your resume against any job description, flags formatting the parser can't read, and lists the exact missing keywords.",
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  inLanguage: "en",
};

export default function AtsResumeChecker() {
  useEffect(() => {
    trackEvent("ats_checker_page_view", { path: PATH });
  }, []);

  return (
    <PublicShell source="ats_resume_checker">
      <JsonLd
        nodes={[
          softwareLd,
          buildFaqLd(FAQS),
          buildBreadcrumbLd([
            { name: "Gradr", path: "/" },
            { name: "ATS Resume Checker", path: PATH },
          ]),
        ]}
        label="ats-resume-checker"
      />

      <ToolHero
        eyebrow="Free tool · Resume Intelligence"
        title="ATS Resume Checker"
        lede="Score your resume against any job description in under a minute. Gradr reads your file the way an Applicant Tracking System does, shows the keywords you're missing, and rewrites the weak lines — so a parser never buries your application again."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Check my resume free
          </a>
          <Link
            to={ctaHref("/blog/ai-resume-optimization", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/blog/ai-resume-optimization")}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Read the ATS optimization guide
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · PDF and DOCX supported · Your resume stays private to your account
        </p>
      </ToolHero>

      <ToolSection id="how-it-works" aria-labelledby="how-it-works">
        <Reveal className="space-y-4">
          <ToolEyebrow>How it works</ToolEyebrow>
          <ToolHeading>How the ATS resume checker works</ToolHeading>
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

      <ToolSection id="common-issues" bg="card" sceneVariant="dots" sceneIntensity={0.3}>
        <Reveal className="space-y-4">
          <ToolEyebrow>Common issues</ToolEyebrow>
          <ToolHeading>
            <span className="inline-flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" aria-hidden="true" />
              Common ATS issues Gradr catches
            </span>
          </ToolHeading>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Most rejections aren't about your experience — they're about what the parser could and
            couldn't read. These are the failures the checker flags most often.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {ISSUES.map((issue, i) => (
            <ToolFeatureCard key={issue.title} icon={CheckCircle2} title={issue.title} delay={i * 50}>
              {issue.body}
            </ToolFeatureCard>
          ))}
        </div>
      </ToolSection>

      <ToolSection id="score-bands">
        <Reveal className="space-y-4">
          <ToolEyebrow>Score meaning</ToolEyebrow>
          <ToolHeading>What your ATS score means</ToolHeading>
        </Reveal>
        <div className="mt-8">
          <ToolTable
            caption="ATS resume score bands and what each range means"
            headers={["Score", "What it means"]}
            rows={SCORE_BANDS.map((row) => ({ cells: [row.band, row.meaning] }))}
          />
        </div>
      </ToolSection>

      <ToolSection id="faq" bg="card">
        <Reveal className="space-y-4">
          <ToolEyebrow>FAQ</ToolEyebrow>
          <ToolHeading>ATS resume checker FAQ</ToolHeading>
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
            to: ctaHref("/blog/ai-resume-optimization", "related_blog"),
            title: "AI Resume Builder & ATS Guide",
            desc: "The full technical breakdown of how ATS parsing, scoring, and ranking works.",
            onClick: trackCta("related_blog", "/blog/ai-resume-optimization"),
          },
          {
            to: ctaHref("/career-advice/resume-optimization-checklist", "related_checklist"),
            title: "Resume Optimization Checklist",
            desc: "A step-by-step pass over formatting, keywords, and impact language before you apply.",
            onClick: trackCta("related_checklist", "/career-advice/resume-optimization-checklist"),
          },
          {
            to: ctaHref("/job-search", "related_job_search"),
            title: "Job Search by Role & Location",
            desc: "See what each role actually asks for and tailor your resume to it.",
            onClick: trackCta("related_job_search", "/job-search"),
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
        title="Find out what the ATS sees"
        lede="Upload your resume, paste a job description, and get your score plus the exact fixes. Free to start — no credit card."
      >
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className={cn(buttonVariants({ size: "lg" }), "btn-glow")}
        >
          Run my free ATS check
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </ToolCtaSection>
    </PublicShell>
  );
}
