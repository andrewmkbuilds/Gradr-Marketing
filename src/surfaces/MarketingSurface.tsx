import { appSignupHref } from "@/lib/appLinks";
import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SurfaceShell } from "@/components/surface/SurfaceShell";
import { CrossLink, SLink, SurfaceNotFound } from "@/components/surface/SurfaceLink";
import { RouteSkeleton } from "@/components/states/PageSkeletons";
import { Card, Text } from "@/design-system/gradr-9b9b95";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  FileText,
  Mic,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

// Checkout never runs on the marketing surface — /pricing hands off to the app.
import { AppPricingRedirect } from "@/components/surface/AppPricingRedirect";

const FEATURES = [
  {
    icon: FileText,
    title: "Resume Intelligence",
    body: "Deterministic ATS scoring, parse diagnostics, severity-ranked rewrite suggestions and version-to-version diffs.",
  },
  {
    icon: Target,
    title: "Job matching",
    body: "Score your resume against any live role, see the exact keyword and seniority gaps, and get a plan to close them.",
  },
  {
    icon: Briefcase,
    title: "Application strategy",
    body: "Tailored cover letters and recruiter outreach generated from your real experience, attached to every application.",
  },
  {
    icon: Mic,
    title: "AI Mock Interview",
    body: "Realtime voice interviews with natural speech, interruption support, live captions and a competency scorecard.",
  },
  {
    icon: Users,
    title: "Networking",
    body: "Warm-intro outreach drafts, follow-up reminders and a contact history tied to each role in your pipeline.",
  },
  {
    icon: BarChart3,
    title: "Career analytics",
    body: "Response rates, stage conversion, score trends and a single Career Readiness number to steer the week.",
  },
];

const USE_CASES = [
  {
    audience: "Students & new graduates",
    body: "Turn coursework and internships into quantified bullets, then rehearse the structured interviews entry-level loops now use.",
    outcomes: ["First ATS-clean resume", "Role-by-role tailoring", "Behavioural interview reps"],
  },
  {
    audience: "Career switchers",
    body: "Map transferable skills to the target role, find the true gaps, and build a narrative that survives a recruiter screen.",
    outcomes: ["Skill gap analysis", "Story framing", "Targeted pipeline"],
  },
  {
    audience: "Experienced professionals",
    body: "Run a tight, high-signal search: fewer applications, better matches, and interview prep tuned to seniority.",
    outcomes: ["Match scoring", "Executive-level prep", "Pipeline analytics"],
  },
  {
    audience: "Bootcamps & career services",
    body: "Give every cohort member the same objective feedback loop, with data protection terms your institution can sign.",
    outcomes: ["Consistent scoring", "DPA available", "Cohort-scale onboarding"],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The gap analysis told me exactly which three keywords were missing. Two applications later I had a first-round interview.",
    name: "Amara O.",
    role: "Data Analyst",
  },
  {
    quote:
      "The mock interview is the only practice tool that actually made me nervous. That is the point — the real one felt easier.",
    name: "Ben R.",
    role: "Product Manager",
  },
  {
    quote:
      "I stopped guessing. Response rate went from almost nothing to about one in five once I tailored per role.",
    name: "Priya S.",
    role: "Frontend Engineer",
  },
];

const DEMOS = [
  {
    title: "Score a resume in 30 seconds",
    body: "Upload, parse, score, and read the first three fixes ranked by impact.",
    step: "01",
  },
  {
    title: "Match against a live role",
    body: "Paste a job description and watch the match score, gaps and strategy appear.",
    step: "02",
  },
  {
    title: "Run a mock interview",
    body: "Pick a role and seniority, talk for ten minutes, and read the scorecard.",
    step: "03",
  },
];

function Hero() {
  return (
    <section className="page-shell section-y">
      <p className="inline-flex items-center gap-2 rounded-full border border-brand-secondary/40 px-3 py-1 text-xs font-medium text-brand-secondary">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        The Gradr product
      </p>
      <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-foreground">
        One workspace from first resume to signed offer
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Gradr replaces the spreadsheet, the resume templates, the cover letter blank page and the
        interview anxiety with a single AI career workspace.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={appSignupHref()}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Start free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
        <SLink
          to="/demos"
          className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-foreground"
        >
          See it in action
        </SLink>
      </div>
    </section>
  );
}

function Overview() {
  return (
    <>
      <Hero />
      <section className="page-shell pb-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} variant="raised" padding="md">
              <feature.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <Text variant="h6" as="h2" className="mt-3">{feature.title}</Text>
              <Text variant="body-sm" tone="muted" className="mt-1.5">{feature.body}</Text>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

function Features() {
  return (
    <div className="page-shell section-y-sm">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">Features</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every module shares the same data, so improving your resume immediately improves your match
        scores, your generated applications and your interview prep.
      </p>
      <div className="mt-10 space-y-4">
        {FEATURES.map((feature) => (
          <section
            key={feature.title}
            className="flex gap-4 rounded-xl border border-border/60 bg-card p-6 elev-1"
          >
            <feature.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-secondary" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">{feature.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="mt-10">
        <CrossLink
          surface="docs"
          className="text-sm text-brand-secondary underline underline-offset-4"
        >
          Read the documentation
        </CrossLink>
      </div>
    </div>
  );
}

function UseCases() {
  return (
    <div className="page-shell section-y-sm">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">Use cases</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The same workspace, tuned to where you are in your career.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {USE_CASES.map((useCase) => (
          <section key={useCase.audience} className="rounded-xl border border-border/60 bg-card p-6 elev-1">
            <h2 className="text-lg font-semibold text-foreground">{useCase.audience}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{useCase.body}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {useCase.outcomes.map((outcome) => (
                <li
                  key={outcome}
                  className="rounded-full border border-brand-secondary/40 px-3 py-1 text-xs text-brand-secondary"
                >
                  {outcome}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Testimonials() {
  return (
    <div className="page-shell section-y-sm">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">Testimonials</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        What changes when the feedback loop is objective and immediate.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <figure key={testimonial.name} className="rounded-xl border border-border/60 bg-card p-6 elev-1">
            <blockquote className="text-sm leading-relaxed text-foreground">
              “{testimonial.quote}”
            </blockquote>
            <figcaption className="mt-4 text-xs text-muted-foreground">
              {testimonial.name} · {testimonial.role}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Demos() {
  return (
    <div className="page-shell section-y-sm">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">Product demos</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Three short paths through the product. Each one works on the free plan.
      </p>
      <ol className="mt-10 space-y-4">
        {DEMOS.map((demo) => (
          <li key={demo.step} className="flex gap-5 rounded-xl border border-border/60 bg-card p-6 elev-1">
            <span className="text-2xl font-semibold text-brand-secondary">{demo.step}</span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{demo.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{demo.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <a
        href={appSignupHref()}
        className="mt-10 inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Run it on your resume
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

function About() {
  return (
    <div className="page-shell section-y-sm">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">About Gradr</h1>
      <div className="mt-6 max-w-2xl space-y-4 text-muted-foreground">
        <p>
          Gradr exists because the job search is an information problem dressed up as a motivation
          problem. Candidates rarely lack effort — they lack feedback.
        </p>
        <p>
          So we built the feedback loop: objective resume scoring, honest match analysis, generated
          materials grounded in real experience, and interview practice that feels like the real
          thing. Everything is measurable, and everything you produce stays yours.
        </p>
        <p>
          We do not train models on your documents, we do not sell your data, and we make export and
          deletion a first-class feature rather than a support ticket.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <CrossLink surface="news" className="text-sm text-brand-secondary underline underline-offset-4">
          Read the newsroom
        </CrossLink>
        <CrossLink
          surface="partners"
          className="text-sm text-brand-secondary underline underline-offset-4"
        >
          Partner with us
        </CrossLink>
      </div>
    </div>
  );
}

/** marketing.gradr.me — the dedicated marketing site. No app or admin routes. */
export default function MarketingSurface() {
  return (
    <SurfaceShell
      eyebrow="Product"
      nav={[
        { label: "Overview", to: "/" },
        { label: "Features", to: "/features" },
        { label: "Use cases", to: "/use-cases" },
        { label: "Pricing", to: "/pricing" },
        { label: "Testimonials", to: "/testimonials" },
        { label: "Demos", to: "/demos" },
        { label: "About", to: "/about" },
      ]}
    >
      <Suspense fallback={<RouteSkeleton pathname="/pricing" />}>
        <Routes>
          <Route path="" element={<Overview />} />
          <Route path="features" element={<Features />} />
          <Route path="use-cases" element={<UseCases />} />
          <Route path="pricing" element={<AppPricingRedirect />} />
          <Route path="testimonials" element={<Testimonials />} />
          <Route path="demos" element={<Demos />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<SurfaceNotFound label="the Gradr product site" />} />
        </Routes>
      </Suspense>
    </SurfaceShell>
  );
}
