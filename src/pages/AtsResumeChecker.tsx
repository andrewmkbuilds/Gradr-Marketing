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

      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Free tool · Resume Intelligence
        </p>
        <Text variant="h1" as="h1" className="mt-3">
          ATS Resume Checker
        </Text>
        <Text variant="lead" className="mt-5">
          Score your resume against any job description in under a minute. Gradr reads your
          file the way an Applicant Tracking System does, shows the keywords you're missing,
          and rewrites the weak lines — so a parser never buries your application again.
        </Text>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ctaHref(appSignupHref(), "hero_primary")}
            onClick={trackCta("hero_primary", "/auth")}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Check my resume free
          </a>
          <Link
            to={ctaHref("/blog/ai-resume-optimization", "hero_secondary")}
            onClick={trackCta("hero_secondary", "/blog/ai-resume-optimization")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Read the ATS optimization guide
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · PDF and DOCX supported · Your resume stays private to your account
        </p>
      </section>

      <section className="section-gap" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight text-foreground">
          How the ATS resume checker works
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <Card
              key={step.title}
              className="bg-card/60 backdrop-blur transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
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

      <section className="section-gap" aria-labelledby="common-issues">
        <h2 id="common-issues" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
          Common ATS issues Gradr catches
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Most rejections aren't about your experience — they're about what the parser could and
          couldn't read. These are the failures the checker flags most often.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ISSUES.map((issue) => (
            <div key={issue.title} className="rounded-xl border border-border/70 p-5">
              <h3 className="flex items-start gap-2 font-medium text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {issue.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{issue.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-gap" aria-labelledby="score-bands">
        <h2 id="score-bands" className="text-2xl font-semibold tracking-tight text-foreground">
          What your ATS score means
        </h2>
        <div
          className="mt-6 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          role="group"
          aria-label="ATS score bands table, scrollable horizontally"
        >
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">ATS resume score bands and what each range means</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                <th scope="col" className="py-2 font-medium">What it means</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {SCORE_BANDS.map((row) => (
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

      <section className="section-gap" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-semibold tracking-tight text-foreground">
          ATS resume checker FAQ
        </h2>
        <dl className="mt-6 space-y-5">
          {FAQS.map((faq) => (
            <Card key={faq.question} variant="outline" padding="md">
              <Text variant="h6" as="dt">{faq.question}</Text>
              <Text variant="body-sm" tone="muted" as="dd" className="mt-2">{faq.answer}</Text>
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
              to: "/blog/ai-resume-optimization",
              title: "AI Resume Builder & ATS Guide",
              desc: "The full technical breakdown of how ATS parsing, scoring, and ranking works.",
              location: "related_blog",
            },
            {
              to: "/career-advice/resume-optimization-checklist",
              title: "Resume Optimization Checklist",
              desc: "A step-by-step pass over formatting, keywords, and impact language before you apply.",
              location: "related_checklist",
            },
            {
              to: "/job-search",
              title: "Job Search by Role & Location",
              desc: "See what each role actually asks for and tailor your resume to it.",
              location: "related_job_search",
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

      <section className="section-gap rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Find out what the ATS sees
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Upload your resume, paste a job description, and get your score plus the exact fixes.
          Free to start — no credit card.
        </p>
        <a
          href={ctaHref(appSignupHref(), "footer_cta")}
          onClick={trackCta("footer_cta", "/auth")}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
        >
          Run my free ATS check
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </section>
    </PublicShell>
  );
}
