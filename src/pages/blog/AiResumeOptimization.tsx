import { appHref, appLoginHref } from "@/lib/appLinks";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, CheckCircle2, Sparkles, BookOpen } from "lucide-react";
import { trackEvent, withUtm } from "@/lib/analytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { useReadTracking } from "@/hooks/useReadTracking";
import { getBlogPost } from "@/content/blogPosts";
import { blogPostJsonLd } from "@/lib/structuredData";

const UTM = {
  source: "blog",
  medium: "article",
  campaign: "ai_resume_optimization",
};

const ctaHref = (path: string, content: string) =>
  withUtm(path, { ...UTM, content });

const trackCta = (location: string, destination: string) => () =>
  trackEvent("blog_cta_click", {
    article: "ai-resume-optimization",
    location,
    destination,
    utm_source: UTM.source,
    utm_medium: UTM.medium,
    utm_campaign: UTM.campaign,
    utm_content: location,
  });



const URL = "https://gradr.me/blog/ai-resume-optimization";
const TITLE = "AI Resume Builder & ATS Guide";
const DESCRIPTION =
  "How AI resume builders help candidates beat Applicant Tracking Systems (ATS). A technical, plain-English guide to keyword matching, formatting rules, and AI-driven rewrites.";
const PUBLISHED = "2026-07-09";
const POST = getBlogPost("ai-resume-optimization")!;

export default function AiResumeOptimization() {
  useEffect(() => {
    trackEvent("blog_page_view", { article: "ai-resume-optimization" });
  }, []);

  useReadTracking("ai-resume-optimization");

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={PUBLISHED} />
      </Helmet>
      <JsonLd nodes={blogPostJsonLd(POST)} label="blog/ai-resume-optimization" />

      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Gradr
          </Link>
          <a
            href={ctaHref(appLoginHref(), "header")}
            onClick={trackCta("header", "/auth")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
          >
            <Sparkles className="h-3.5 w-3.5" /> Try the AI resume builder
          </a>

        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-wider text-primary font-medium mb-3">Guide · Resume Intelligence</p>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
          {TITLE}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          Applicant Tracking Systems (ATS) reject up to 75% of resumes before a human ever
          reads them. An AI resume builder isn't a gimmick — it's the fastest way to make
          sure your real experience gets past the parser and in front of a recruiter.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Published July 9, 2026 · 9 min read</p>

        <div className="prose prose-invert max-w-none mt-10 space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold tracking-tight">What is an AI resume builder?</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              An AI resume builder is software that uses large language models and job-market
              data to write, restructure, and optimize a resume for a specific role. The best
              ones do three things at once: (1) parse your existing experience, (2) compare it
              against the target job description, and (3) rewrite each bullet so the language,
              keywords, and structure match how the role is scored — both by ATS software and
              by a human recruiter skimming for 7 seconds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">How an ATS actually reads your resume</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Modern ATS platforms (Workday, Greenhouse, Lever, Taleo, iCIMS) all follow the
              same three-stage pipeline:
            </p>
            <ol className="mt-4 space-y-3 text-muted-foreground list-decimal pl-5">
              <li>
                <strong className="text-foreground">Parse.</strong> The file is converted to
                plain text and split into fields (name, contact, experience, education,
                skills). Tables, columns, images, and unusual fonts break this step.
              </li>
              <li>
                <strong className="text-foreground">Score.</strong> The parsed text is matched
                against the job posting's keywords, required skills, and years of experience.
                Each match adds to a relevance score.
              </li>
              <li>
                <strong className="text-foreground">Rank.</strong> Recruiters see candidates
                sorted by that score. Below a threshold, you're never surfaced.
              </li>
            </ol>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              A resume can be beautifully designed and still score zero if the parser can't
              read it. This is where AI resume optimization matters most.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">Where AI outperforms a template</h2>
            <div className="mt-4 grid gap-3">
              {[
                {
                  t: "Keyword extraction from the job description",
                  d: "AI reads the full posting and pulls the exact skills, tools, and phrases the hiring manager wrote — not a generic keyword list.",
                },
                {
                  t: "Bullet rewriting with measurable impact",
                  d: 'Turns "Responsible for managing the pipeline" into "Grew qualified pipeline 42% in two quarters by rebuilding the outbound sequence." Same job — scored differently.',
                },
                {
                  t: "Format sanitization",
                  d: "Strips ATS-hostile elements automatically: multi-column layouts, tables, text inside images, decorative headers, custom bullet glyphs.",
                },
                {
                  t: "Role-aware phrasing",
                  d: "A senior engineer, a junior PM, and a career-switcher need different tones and different keyword density. AI adapts to each without you rewriting from scratch.",
                },
                {
                  t: "Score before you submit",
                  d: "Instead of guessing, you see the match score — usually 0–100 — and specific gaps to close before the recruiter ever sees the file.",
                },
              ].map((row) => (
                <div key={row.t} className="elev-2 rounded-xl p-4 flex gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-1 shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">{row.t}</div>
                    <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{row.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">The 7-step AI resume optimization workflow</h2>
            <ol className="mt-4 space-y-4 text-muted-foreground list-decimal pl-5">
              <li>
                <strong className="text-foreground">Upload your current resume.</strong> Any
                PDF or DOCX. The AI extracts your experience into structured fields.
              </li>
              <li>
                <strong className="text-foreground">Paste the target job description.</strong>{" "}
                One posting at a time — general resumes score badly on all roles, targeted
                resumes score highly on one.
              </li>
              <li>
                <strong className="text-foreground">Review the match score and gap analysis.</strong>{" "}
                Missing keywords, weak verbs, and low-signal bullets are highlighted.
              </li>
              <li>
                <strong className="text-foreground">Accept AI rewrite suggestions.</strong> Per
                bullet, not the whole document — you keep control.
              </li>
              <li>
                <strong className="text-foreground">Add quantified outcomes.</strong> Numbers
                (%, $, users, throughput) score higher than adjectives. If the AI suggests a
                metric, only accept it if it's true.
              </li>
              <li>
                <strong className="text-foreground">Export as an ATS-safe PDF.</strong>{" "}
                Single column, selectable text, standard section headings.
              </li>
              <li>
                <strong className="text-foreground">Re-score before applying.</strong> A 90+
                match rarely happens on the first pass — it takes one iteration.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">ATS formatting rules the AI enforces for you</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Do</th>
                    <th className="py-2">Don't</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    ["Single-column layout", "Two-column or sidebar templates"],
                    ["Standard headings: Experience, Education, Skills", "Creative headings like 'My Journey'"],
                    ["Selectable text PDF or DOCX", "Scanned PDFs or images of a resume"],
                    ["Standard fonts (Inter, Arial, Calibri, Helvetica)", "Decorative or handwriting fonts"],
                    ["Consistent date format (MMM YYYY)", "Mixed date formats or ranges without years"],
                    ["Contact info as plain text", "Contact info inside a header or footer"],
                    ["Simple bullets (·, -)", "Emoji, icons, or custom glyphs as bullets"],
                  ].map(([yes, no]) => (
                    <tr key={yes} className="border-b border-border/50">
                      <td className="py-2 pr-4">{yes}</td>
                      <td className="py-2">{no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">What AI can't (and shouldn't) do</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              A good AI resume builder never invents jobs, titles, or metrics. It rewrites what
              you actually did in the language the ATS is scoring against. If a tool is padding
              your resume with skills you don't have, walk away — the interview will expose it.
              The right test: every bullet the AI wrote should be something you can defend for
              five minutes in a technical interview.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
            <div className="mt-4 space-y-4">
              {[
                {
                  q: "Does an AI resume builder actually help you beat the ATS?",
                  a: "Yes — a good one aligns your resume with the language, structure, and keywords a specific job description uses, which is exactly what ATS parsers score against.",
                },
                {
                  q: "Will an ATS reject me for using AI to write my resume?",
                  a: "No. ATS software scores structure and keyword match — it doesn't detect AI-written content. What matters is whether the resume is parseable, honest, and relevant.",
                },
                {
                  q: "What format should an AI-optimized resume use?",
                  a: "A single-column PDF or DOCX with standard section headings, no tables, no text inside images, and consistent date formatting.",
                },
                {
                  q: "What is ATS resume optimization?",
                  a: "Tailoring a resume's keywords, structure, and formatting so Applicant Tracking Systems (Workday, Greenhouse, Lever, Taleo, iCIMS) can parse it correctly and rank it highly against a specific job description.",
                },
                {
                  q: "What is a good AI resume ATS score?",
                  a: "80+ is strong; 90+ is top-tier for that specific posting. Anything under 60 means missing keywords, weak verbs, or formatting the parser can't read. Scores are always relative to one job description.",
                },
                {
                  q: "How do I check my resume's ATS score for free?",
                  a: "Upload your resume and paste the target job description into an AI resume scanner like the Gradr Resume Engine. You'll get a 0–100 match score plus the exact missing keywords and formatting fixes.",
                },
                {
                  q: "How many keywords should I add to my resume for ATS?",
                  a: "Cover every hard skill, tool, and requirement in the posting at least once using the posting's exact phrasing. Coverage beats frequency — keyword-stuffing doesn't raise your score and reads badly to recruiters.",
                },
                {
                  q: "Can AI tailor my resume for each job automatically?",
                  a: "Yes. An AI resume builder rewrites bullets, reorders sections, and adjusts keyword density per job description in seconds, so every application gets a targeted version instead of one generic resume.",
                },
                {
                  q: "Do ATS systems read PDFs or Word documents better?",
                  a: "Modern ATS platforms parse both reliably if the text is selectable. PDF is usually safer for formatting portability. Avoid image-based PDFs, multi-column templates, and DOCX files that rely on tables or text boxes.",
                },
              ].map((item) => (
                <div key={item.q}>
                  <h3 className="font-semibold text-foreground">{item.q}</h3>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Related guides
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep going with the Gradr Resume Intelligence and ATS optimization stack.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  to: "/ats-resume-checker",
                  title: "Free ATS Resume Checker",
                  desc: "Score your resume against any job description and get the exact missing keywords and formatting fixes.",
                  location: "related_ats_checker",
                },
                {
                  to: "/resume",
                  title: "Resume Intelligence Engine",
                  desc: "Upload your resume, score it against any job description, and get AI rewrites bullet-by-bullet.",
                  location: "related_resume_engine",
                },
                {
                  to: "/match",
                  title: "Job Matching Engine",
                  desc: "See your ATS match score for every open role and close the exact keyword gaps.",
                  location: "related_match_engine",
                },
                {
                  to: "/apply",
                  title: "Application Automation",
                  desc: "Generate tailored resumes and cover letters for each posting in one click.",
                  location: "related_apply_engine",
                },
                {
                  to: "/interview",
                  title: "AI Interview Coach",
                  desc: "Practice role-specific mock interviews with real-time streaming feedback.",
                  location: "related_interview_engine",
                },
                {
                  to: "/pricing",
                  title: "Pricing & plans",
                  desc: "Compare free and premium tiers for the full Gradr suite.",
                  location: "related_pricing",
                },
                {
                  to: "/jobs",
                  title: "Live jobs feed",
                  desc: "Browse curated roles matched to your resume and preferences.",
                  location: "related_jobs_feed",
                },
              ].map((g) => (
                <Link
                  key={g.to}
                  to={ctaHref(g.to, g.location)}
                  onClick={trackCta(g.location, g.to)}
                  className="elev-2 rounded-xl p-4 hover:border-primary/40 transition group"
                >
                  <div className="font-medium text-foreground group-hover:text-primary transition">
                    {g.title}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {g.desc}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="elev-2 rounded-xl p-6 mt-10">
            <h2 className="type-h2 text-foreground">
              Try the Gradr Resume Engine
            </h2>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Upload your resume, paste any job description, and see your ATS match score,
              missing keywords, and AI rewrite suggestions in seconds. Free to start.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={ctaHref(appLoginHref(), "footer_cta_auth")}
                onClick={trackCta("footer_cta", "/auth")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
              >
                <Sparkles className="h-3.5 w-3.5" /> Start free
              </a>
              <a
                href={ctaHref(appHref("/resume"), "footer_cta_resume")}
                onClick={trackCta("footer_cta", "/resume")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-secondary/80 transition"
              >
                Open Resume Engine
              </a>
              <Link
                to={ctaHref("/pricing", "footer_cta_pricing")}
                onClick={trackCta("footer_cta", "/pricing")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-secondary/80 transition"
              >
                See pricing
              </Link>
            </div>
          </section>

        </div>
      </article>

      <footer className="border-t border-border mt-8">
        <div className="max-w-4xl mx-auto px-6 py-6 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>© {new Date().getFullYear()} Gradr</span>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/affiliate" className="hover:text-foreground">Affiliate program</Link>
            <a href={appLoginHref()} className="hover:text-foreground">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
