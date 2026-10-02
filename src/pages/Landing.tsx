import { scrollIntoViewSafely } from "@/lib/motion/scroll";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { forwardRef, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, FileText, Target, Mic, LineChart, Briefcase, Users,
  GraduationCap, Rocket, Compass, Award, Menu, X, Sparkles, ShieldCheck,
  Layers, Bot, Search, Send, RefreshCw, BarChart3, Minus, Coins, Handshake,
} from "lucide-react";
import { urlFor } from "@/config/domains";
import {
  ANNUAL_SAVINGS_MESSAGE,
  annualListPrice,
  annualSavingsPercent,
  formatUsd,
  planPriceLabel,
} from "@/config/pricing";
import { Button, Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";

import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { useAuth } from "@/hooks/useAuth";
import { NewsletterSignup } from "@/components/marketing/NewsletterSignup";
import { BrandLogo } from "@/components/BrandLogo";
import { Instagram } from "lucide-react";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { XIcon } from "@/components/icons/XIcon";
import { YouTubeIcon } from "@/components/icons/YouTubeIcon";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import {
  INSTAGRAM_URL,
  X_URL,
  FACEBOOK_URL,
  YOUTUBE_URL,
  DISCORD_URL,
} from "@/config/social";
import { Reveal } from "@/components/landing/Reveal";
import { LandingScrollProgress } from "@/components/landing/LandingScrollProgress";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Atmosphere, CountUp, Magnetic, Parallax,
  DepthStage, DepthLayer, ScrollDepth, FloatPanel, SpatialCard, SpatialCta, ScrollCue,
  easeOut, viewportOnce, springSnappy,
} from "@/components/motion";
import {
  AnimatedHeading, BlurText, GradientText, TextLoop, SpotlightCard,
  SceneBackground, ScrollFloat, MagicBento,
} from "@/components/effects";
import { HeroCommandCenter } from "@/components/landing/HeroCommandCenter";
import { HexFloatFx, ParticleScrollFx } from "@/components/canvasui/CanvasFx";
import { CanvasFxFrame } from "@/components/canvasui/CanvasFxFrame";
import { ResumeTransform } from "@/components/landing/ResumeTransform";
import { trackSignupCta, trackUpgradeCta, type CtaLocation } from "@/lib/telemetry/events";
import { appPricingHref, goToApp } from "@/lib/appLinks";
import { appSignInHref, goToAppAuth } from "@/lib/authHandoff";
import { DepthShowcase } from "@/components/landing/DepthShowcase";
import {
  ApplicationVisual, AssistantVisual,
} from "@/components/landing/visuals";
import {
  ResumeIntelligenceDemo, JobMatchingDemo, InterviewCoachDemo, CareerIntelligenceDemo,
} from "@/components/landing/demos";
import { DimensionalText, TiltCard } from "@/components/three-d";

/* ---------------------------------- data ---------------------------------- */

/**
 * Auth CTAs are real links, not bare buttons: a visitor can middle-click or
 * ⌘-click them into a new tab, and crawlers see the destination. A plain left
 * click still goes through the instrumented hand-off (telemetry + failure
 * recovery) rather than the browser's default navigation.
 *
 * Declared at module scope and ref-forwarding so wrappers like `Magnetic` can
 * attach to the underlying anchor without React warning about refs on a
 * function component (and without remounting on every Landing render).
 */
const AuthCta = forwardRef<
  HTMLAnchorElement,
  {
    href: string;
    onActivate: () => void;
    variant?: "primary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
    className?: string;
    children: React.ReactNode;
  }
>(({ href, onActivate, variant, size = "md", className = "", children, ...rest }, ref) => (
  <a
    ref={ref}
    href={href}
    className={`${buttonVariants({ variant, size })} ${className}`}
    onClick={(e) => {
      // Let the browser handle new-tab / new-window intents natively.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onActivate();
    }}
    {...rest}
  >
    {children}
  </a>
));
AuthCta.displayName = "AuthCta";

const NAV = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "AI Interview", href: "#interview" },
  { label: "Pricing", href: "#pricing" },
  { label: "For Students", href: "#students" },
  { label: "For Professionals", href: "#professionals" },
];

/** Section boundaries the scroll rail ticks against. */
const SECTION_IDS = [
  "product", "resume", "matching", "applications", "interview",
  "assistant", "how-it-works", "transformation", "pricing", "faq",
];


const FRAGMENTS = [
  "Resume builders", "Job boards", "Spreadsheets", "Interview prep tools",
  "LinkedIn", "Scattered notes", "AI chatbots", "Email threads", "Calendars",
];

const SYSTEM = [
  { n: "01", title: "Resume Intelligence", copy: "Parse your resume and score what recruiters and parsers actually read.", icon: FileText },
  { n: "02", title: "ATS Optimization", copy: "Fix keywords, structure, and impact language before you apply.", icon: ShieldCheck },
  { n: "03", title: "Job Matching", copy: "Score live roles against your real skills, not a keyword blob.", icon: Target },
  { n: "04", title: "Application Strategy", copy: "Turn one job description into a complete application package.", icon: Send },
  { n: "05", title: "Networking", copy: "Draft outreach that references the role and the company, not a template.", icon: Users },
  { n: "06", title: "AI Mock Interview", copy: "Hold a real spoken interview with an adaptive AI interviewer.", icon: Mic },
  { n: "07", title: "Career Analytics", copy: "See what's improving — and what's blocking your pipeline.", icon: BarChart3 },
  { n: "08", title: "Continuous Improvement", copy: "Every session feeds the next practice plan and resume pass.", icon: RefreshCw },
];

const AUDIENCE = [
  { icon: GraduationCap, title: "Students", copy: "Build your first serious career profile before recruiting season starts.", id: "students" },
  { icon: Award, title: "New graduates", copy: "Move from graduation to your first offer with a system, not a spreadsheet." },
  { icon: Compass, title: "Career changers", copy: "Translate the experience you already have into the language of a new field." },
  { icon: Rocket, title: "Early-career professionals", copy: "Sharpen your positioning and stop losing offers at the interview stage.", id: "professionals" },
  { icon: Briefcase, title: "Experienced professionals", copy: "Make deliberate moves: target better roles and prepare for harder rooms." },
];

const HOW = [
  "Build your profile",
  "Upload your resume",
  "Set your career goals",
  "Find matching opportunities",
  "Prepare your applications",
  "Practice interviews",
  "Improve continuously",
];

const OLD_WAY = [
  "A resume you edit blind",
  "Five job boards, no signal",
  "A spreadsheet you stop updating",
  "Interview prep from a blog post",
  "A chatbot with no memory of you",
];

const NEW_WAY = [
  "A resume scored against real roles",
  "Matches ranked by actual fit",
  "A pipeline that updates as you apply",
  "Spoken interviews with a scored report",
  "One system that remembers your history",
];

/** Prices are read from the single source of truth in @/config/pricing. */
const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    tagline: "Enough to feel the whole system.",
    features: [
      "Resume upload and ATS scoring",
      "Job discovery and matching",
      "Application tracking",
      "Guided AI interview preview",
      "Basic career analytics",
    ],
    cta: "Get started free",
  },
  {
    id: "starter" as const,
    name: "Starter",
    tagline: "For an active job search.",
    features: [
      "Everything in Free",
      "Expanded resume and ATS passes",
      "Full AI mock interview sessions",
      "Application packages and outreach drafts",
      "Selected interviewer personas",
      "Interview reports and transcripts",
    ],
    cta: "Start with Starter",
  },
  {
    id: "pro" as const,
    name: "Pro",
    tagline: "The complete Gradr experience.",
    highlight: true,
    features: [
      "Everything in Starter",
      "Unlimited live interview sessions",
      "Company and role-specific simulations",
      "Advanced personas and difficulty control",
      "Deep transcript analysis and coaching plans",
      "Long-term analytics and readiness tracking",
      "PDF exports and mentor sharing",
    ],
    cta: "Go Pro",
  },
  {
    id: "advanced" as const,
    name: "Advanced",
    tagline: "Maximum firepower for a high-stakes search.",
    features: [
      "Everything in Pro",
      "Extended realtime interview sessions",
      "Deep company and interviewer research",
      "Personalized practice plans",
      "Priority AI queue",
      "Concierge onboarding",
    ],
    cta: "Go Advanced",
  },
];


const FAQS: [string, string][] = [
  ["What is Gradr?", "Gradr is an AI career operating system. It connects resume intelligence, ATS optimization, job matching, application generation, networking outreach, AI mock interviews, and career analytics in a single workspace — so each step feeds the next instead of living in a different tool."],
  ["Who is Gradr for?", "People actively moving toward a job: students preparing for recruiting, new graduates chasing a first offer, career changers repositioning existing experience, and early-career or experienced professionals who want a more deliberate search."],
  ["Can I use Gradr for free?", "Yes. The Free plan includes resume upload with ATS scoring, job matching, application tracking, and a guided preview of the AI Mock Interview. No card required to start."],
  ["What does Pro include?", "Unlimited live interview sessions, company and role-specific simulations, advanced interviewer personas and difficulty control, deep transcript analysis, personalized practice plans, long-term analytics, and PDF exports you can share with a mentor."],
  ["Does Gradr analyze my resume?", "It parses your PDF or DOCX, extracts the real text a parser would see, and scores ATS compatibility, keyword coverage, impact language, and structure — then gives specific line-level changes rather than generic advice."],
  ["How does the AI Mock Interview work?", "You pick a role, seniority, and difficulty, optionally attaching a job description. The interviewer speaks with you in real time, asks follow-ups based on what you actually said, and produces a scored report with a transcript and a recommended practice plan afterwards."],
  ["Does Gradr store interview recordings?", "No. Raw video is never uploaded — camera analysis for framing and attention runs on your device. Transcripts and scores are saved to your account so you can track progress, and you can delete any session at any time."],
  ["How does Gradr protect my data?", "Your data is scoped to your account with row-level access rules in the database. Resume files live in a private bucket only you can read. Interview keys never reach the browser — realtime sessions use short-lived tokens minted by our backend."],
  ["Can I cancel?", "Yes. Upgrade, downgrade, or cancel any time from the billing portal in your account. Cancelling keeps access until the end of the period you already paid for."],
];

const FOOTER = [
  {
    title: "Product",
    links: [
      ["Resume Intelligence", "#resume"],
      ["Job Matching", "#matching"],
      ["Applications", "#applications"],
      ["AI Interview", "#interview"],
      ["Career Assistant", "#assistant"],
      ["Pricing", "#pricing"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "#product"],
      ["Contact", "mailto:hello@gradr.me"],
      ["Careers", "#product"],
    ],
  },
  {
    title: "Earn",
    links: [
      // External destinations — resolved per-host via urlFor("earn", …) at render.
      ["Earn with Gradr", "earn:/"],
      ["Partner with Gradr", "earn:/partner"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Help Center", "#faq"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Refund Policy", "/refund-policy"],
      ["Cookie Policy", "/cookie-policy"],
      ["DPA", "/dpa"],
    ],
  },
];

/* ------------------------------- primitives -------------------------------- */

function Section({
  id, className = "", children,
}: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`section-y relative w-full scroll-mt-24 ${className}`}>
      <div className="page-shell">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.5, ease: easeOut }}
      className="type-eyebrow inline-flex items-center gap-2 text-brand-secondary"
    >
      <motion.span
        className="h-px w-6 origin-left bg-brand-secondary/70"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={viewportOnce}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.1 }}
        aria-hidden
      />
      {children}
    </motion.span>
  );
}

function Heading({
  children, className = "",
}: { children: React.ReactNode; className?: string }) {
  if (typeof children === "string") {
    return (
      <AnimatedHeading
        as="h2"
        variant="mask"
        text={children}
        className={`type-section text-dimensional text-balance ${className}`}
      />
    );
  }
  return <h2 className={`type-section text-dimensional text-balance ${className}`}>{children}</h2>;
}

function Lede({ children }: { children: React.ReactNode }) {
  return <BlurText className="max-w-2xl text-body-lg text-muted-foreground">{children}</BlurText>;
}


/* ---------------------------------- page ----------------------------------- */

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { open: menuOpen, setOpen: setMenuOpen, toggle: toggleMenu } = useMobileMenu();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  // Hero scroll choreography: the composition lifts and dissolves as you scroll away.
  const heroReduced = useReducedMotionPref();
  // Entrance fades settle instantly under reduced motion: a half-faded element
  // also has half the text contrast, which fails WCAG for anyone who paused motion.
  const heroFade = (from: Record<string, number>, transition: object) =>
    heroReduced
      ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : { initial: from, animate: { opacity: 1, y: 0 }, transition };
  const { scrollY } = useScroll();
  const heroLift = useTransform(scrollY, [0, 600], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 520], [1, 0.35]);

  // Scroll spy drives the animated nav indicator (click = instant active state).
  const { activeHash, onNavClick } = useScrollSpy(NAV.map((n) => n.href), 72);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  /**
   * Primary "create account" CTA. Every call site names where it sits and what
   * it says, so `homepage_viewed → signup_cta_clicked` stays a real intent
   * signal instead of counting generic navigation.
   */
  const start = (location: CtaLocation, text: string, next?: string) => () => {
    const href = appSignInHref(next);
    trackSignupCta({ location, text, authenticated: Boolean(user), destination: href });
    goToAppAuth({ location, next, authenticated: Boolean(user) }, navigate);
  };
  const login = () => goToAppAuth({ location: "navbar", authenticated: Boolean(user) }, navigate);
  const openApp = () => goToAppAuth({ location: "navbar", next: "/", authenticated: Boolean(user) }, navigate);

  /** External Earn destinations — always the Earn surface, never the app. */
  const earnHome = urlFor("earn", "/");
  const earnPartner = urlFor("earn", "/partner");





  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">


      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* --------------------------------- nav -------------------------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-3d light-rim border-b border-border/60" : "border-b border-transparent"
        }`}
      >
        <nav
          aria-label="Main"
          className={`page-shell flex items-center justify-between gap-4 transition-all ${scrolled ? "h-14" : "h-16"}`}
        >
          <a href="#hero" className="flex shrink-0 items-center gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandLogo size={28} />
            <span className="text-base font-bold tracking-[0.24em]">GRADR</span>
          </a>

          <ul className="hidden items-center gap-1 xl:flex">
            {NAV.map((n) => {
              const active = activeHash === n.href;
              return (
                <li key={n.label} className="relative">
                  <a
                    href={n.href}
                    onClick={onNavClick(n.href)}
                    aria-current={active ? "true" : undefined}
                    className={`relative z-10 inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n.label}
                  </a>
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      aria-hidden
                      className="absolute inset-0 rounded-full border border-primary/25 bg-primary/10"
                      transition={springSnappy}
                    />
                  )}
                </li>
              );
            })}
            <li>
              <a
                href={earnHome}
                className="relative z-10 inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Earn
              </a>
            </li>
            <li>
              <a
                href={earnPartner}
                className="relative z-10 inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Partner with Gradr
              </a>
            </li>
          </ul>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <ThemeToggle className="min-h-9 min-w-9" />
            {user ? (
              <AuthCta href={appSignInHref("/")} onActivate={openApp} size="sm">Open Gradr</AuthCta>
            ) : (
              <>
                <AuthCta href={appSignInHref()} onActivate={login} variant="ghost" size="sm">Log in</AuthCta>
                <AuthCta href={appSignInHref()} onActivate={start("navbar", "Get started")} size="sm">
                  Get started
                </AuthCta>
              </>

            )}
          </div>

          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {menuOpen && (
          <motion.div
            initial={heroReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: easeOut }}
            className="page-shell max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-border bg-background/98 py-4 backdrop-blur-xl xl:hidden"
          >
            <motion.ul
              className="space-y-1"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: heroReduced ? 0 : 0.045 } } }}
            >
              {NAV.map((n) => (
                <motion.li
                  key={n.label}
                  variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.3, ease: easeOut }}
                >
                  <a
                    href={n.href}
                    onClick={(e) => { setMenuOpen(false); onNavClick(n.href)(e); }}
                    className={`flex min-h-11 items-center rounded-lg px-2 text-sm transition-colors hover:bg-secondary/50 hover:text-foreground ${
                      activeHash === n.href ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {n.label}
                  </a>
                </motion.li>
              ))}
              {[
                { label: "Earn", href: earnHome },
                { label: "Partner with Gradr", href: earnPartner },
              ].map((n) => (
                <motion.li
                  key={n.label}
                  variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.3, ease: easeOut }}
                >
                  <a
                    href={n.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    {n.label}
                  </a>
                </motion.li>
              ))}
            </motion.ul>
            <div className="mt-3 flex gap-2">
              {user ? (
                <AuthCta href={appSignInHref("/")} onActivate={openApp} className="flex-1">Open Gradr</AuthCta>
              ) : (
                <>
                  <AuthCta href={appSignInHref()} onActivate={login} variant="outline" className="flex-1">Log in</AuthCta>
                  <AuthCta href={appSignInHref()} onActivate={start("mobile_menu", "Get started")} className="flex-1">
                    Get started
                  </AuthCta>
                </>
              )}

            </div>
          </motion.div>
        )}
      </header>

      <LandingScrollProgress sectionIds={SECTION_IDS} />

      {/* -------------------------------- hero -------------------------------- */}
      <main id="hero">
        <ScrollDepth rotate={4} scale={0.96} fade={0.45}>
        <motion.div className="relative pt-20 sm:pt-24" style={heroReduced ? undefined : { opacity: heroOpacity }}>
          <Atmosphere />
          <SceneBackground variant="rays" intensity={0.5} fadeBottom={false} />

          <Section className="!pb-0 !pt-0">
            <motion.div
              className="grid items-center gap-12 lg:grid-cols-[1.02fr_1.05fr] lg:gap-14"
              style={heroReduced ? undefined : { y: heroLift }}
            >
              <div className="space-y-7">
                <motion.span
                  {...heroFade({ opacity: 0, y: 10 }, { duration: 0.6, ease: easeOut })}
                  className="type-eyebrow inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3 py-1.5 text-brand-secondary backdrop-blur"
                >
                  <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                  <GradientText variant="shine">AI career operating system</GradientText>
                </motion.span>

                <h1 className="type-hero text-balance">
                  <DimensionalText as="span" depth="strong" perspective className="block">
                    <AnimatedHeading as="span" variant="mask" text="Your AI career" className="block" immediate delay={0.08} />
                  </DimensionalText>
                  <DimensionalText as="span" depth="glow" perspective className="block animated-gradient-text">
                    <AnimatedHeading
                      as="span"
                      variant="split"
                      text="command center."
                      className="block"
                      immediate
                      delay={0.26}
                    />
                  </DimensionalText>
                </h1>

                <motion.p
                  {...heroFade({ opacity: 0, y: 10 }, { duration: 0.6, ease: easeOut, delay: 0.42 })}
                  className="flex items-baseline gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-xs uppercase tracking-[0.22em] text-brand-secondary">Running now</span>
                  <TextLoop
                    className="font-medium text-foreground"
                    items={["Resume Intelligence", "Job Matching", "Interview Coaching", "Career Intelligence"]}
                  />
                </motion.p>

                <motion.p
                  {...heroFade({ opacity: 0, y: 14 }, { duration: 0.7, ease: easeOut, delay: 0.5 })}
                  className="max-w-xl text-body-lg text-muted-foreground"
                >
                  Gradr scores your resume, ranks live roles against your real skills, runs spoken mock
                  interviews and tracks every application — one intelligent system that remembers your
                  whole search.
                </motion.p>

                <motion.div
                  {...heroFade({ opacity: 0, y: 14 }, { duration: 0.7, ease: easeOut, delay: 0.62 })}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <Magnetic strength={6}>
                    <AuthCta
                      href={appSignInHref()}
                      onActivate={start("hero", "Get started free")}
                      size="lg"
                      className="btn-glow group"
                    >
                      Get started free
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden
                      />
                    </AuthCta>
                  </Magnetic>

                  <Magnetic strength={6}>
                    <Button
                      size="lg"
                      variant="outline"
                      type="button"
                      onClick={() => scrollIntoViewSafely("how-it-works")}
                    >
                      See how Gradr works
                    </Button>
                  </Magnetic>
                </motion.div>

                <motion.dl
                  {...heroFade({ opacity: 0, y: 0 }, { duration: 0.6, delay: 0.8 })}
                  className="grid max-w-lg grid-cols-3 gap-4 border-t border-border/60 pt-6"
                >
                  {[
                    { label: "Modules in the loop", value: 8, suffix: "" },
                    { label: "ATS signals checked", value: 40, suffix: "+" },
                    { label: "Interview personas", value: 12, suffix: "" },
                  ].map((s) => (
                    <div key={s.label}>
                      {/* dd first visually via order so the label stays the
                          dt element — a <dl> group may only contain dt/dd. */}
                      <dd className="font-display text-2xl font-bold tracking-tight text-foreground">
                        <CountUp to={s.value} suffix={s.suffix} duration={1.6} immediate />
                      </dd>
                      <dt className="mt-1 text-[11px] leading-tight text-muted-foreground">{s.label}</dt>
                    </div>

                  ))}
                </motion.dl>
              </div>

              <div className="lg:pl-4">
                {/* Hex Float renders the live command centre onto a floor of
                    beveled tiles that lean into perspective and rise toward
                    the cursor. The headline column beside it stays flat DOM so
                    the copy and CTAs are never rendered through a shader. */}
                <CanvasFxFrame glow="strong" marks={false} clip={false}>
                  <HexFloatFx
                    className="w-full"
                    activeClassName="h-[520px] overflow-hidden lg:h-[560px]"
                    options={{
                      size: 150,
                      gap: 1,
                      bevel: 1.5,
                      tilt: 16,
                      perspective: 0.42,
                      float: 0.22,
                      speed: 0.55,
                      shine: 0.5,
                      lift: 0.35,
                      radius: 620,
                      flow: 0.9,
                      swirl: 3,
                      trail: 0.55,
                      iridescence: 0.5,
                      bloom: 0.25,
                      grain: 0.25,
                    }}
                    liteOptions={{
                      size: 190,
                      float: 0.12,
                      flow: 0.5,
                      swirl: 0,
                      bloom: 0,
                      grain: 0,
                    }}
                  >
                    <HeroCommandCenter />
                  </HexFloatFx>
                </CanvasFxFrame>
                <div className="mt-10 flex justify-center lg:justify-start">
                  <ScrollCue targetId="product" label="Continue" />
                </div>
              </div>
            </motion.div>
          </Section>
        </motion.div>
        </ScrollDepth>


        {/* ------------------------------- problem ------------------------------ */}
        <Section id="product" className="border-t border-border/60">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <Reveal className="space-y-5">
              <Eyebrow>The problem</Eyebrow>
              <Heading>Job searching is fragmented.</Heading>
              <Lede>
                Your resume lives in one tool, your applications in a spreadsheet, your interview prep in a browser tab,
                and your decisions in your head. Nothing knows what anything else learned about you.
              </Lede>
            </Reveal>

            <Reveal delay={100} className="space-y-6">
              <ul className="flex flex-wrap gap-2">
                {FRAGMENTS.map((f) => (
                  <li
                    key={f}
                    className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground"
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gradr brings it together</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-4">
                <Layers className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <p className="text-sm leading-relaxed text-foreground">
                  One profile. One resume model. One pipeline. Every module reads the same context about you.
                </p>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ---------------------------- the gradr system ------------------------ */}
        <Section className="relative border-t border-border/60 bg-card/30">
          <SceneBackground variant="dots" intensity={0.35} />
          <Reveal className="space-y-5">
            <Eyebrow>The Gradr system</Eyebrow>
            <Heading>Eight modules. One continuous loop.</Heading>
            <Lede>
              Gradr doesn't treat each career task as a separate tool. Your resume informs your matches, your matches
              shape your applications, your applications set up your interviews, and every interview improves the next pass.
            </Lede>
          </Reveal>

          <MagicBento
            className="mt-12"
            columns={4}
            items={SYSTEM.map((sItem) => ({
              key: sItem.n,
              marker: sItem.n,
              title: sItem.title,
              copy: sItem.copy,
              icon: sItem.icon,
            }))}
          />
        </Section>

        {/* --------------------------- resume intelligence ---------------------- */}
        <Section id="resume" className="border-t border-border/60">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal className="space-y-5">
              <Eyebrow>01 — Resume intelligence</Eyebrow>
              <Heading>Know exactly what your resume is doing wrong.</Heading>
              <Lede>
                Upload a PDF or DOCX. Gradr reads the text a parser actually extracts — not what the layout looks like —
                then scores it and tells you which lines to change.
              </Lede>
              <ul className="grid gap-2 sm:grid-cols-2">
                {["ATS compatibility", "Keyword coverage", "Impact language", "Structure", "Clarity", "Role alignment"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button size="lg" onClick={start("feature_section", "Optimize my resume", "/resume")}>
                Optimize my resume
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Reveal>
            <Reveal delay={100} hoverLift>
              {/* Particle Scroll: the analysis arrives as drifting sand and
                  condenses into the real report as the section scrolls up —
                  the transformation the section is describing, made literal. */}
              <ParticleScrollFx
                className="w-full"
                activeClassName="h-[560px]"
                options={{
                  point: 0.62,
                  band: 380,
                  density: 2,
                  size: 1.2,
                  spread: 190,
                  gravity: 0.28,
                  drift: 0.5,
                  swirl: 48,
                  stagger: 0.65,
                  fade: 0.8,
                  settle: 1,
                  smoothing: 0.55,
                }}
                liteOptions={{ density: 3, spread: 120, swirl: 24, drift: 0.3 }}
              >
                <DepthShowcase
                  highlights={[
                    { icon: Check, label: "ATS score 92", at: "tl" },
                    { icon: Sparkles, label: "6 rewrites suggested", at: "br" },
                  ]}
                >
                  <ResumeIntelligenceDemo />
                </DepthShowcase>
              </ParticleScrollFx>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------ job matching -------------------------- */}
        <Section id="matching" className="relative border-t border-border/60 bg-card/30">
          <SceneBackground variant="threads" intensity={0.4} />
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal delay={100} hoverLift className="lg:order-2 lg:pl-4">
              <Parallax distance={-72}>
              <DepthShowcase
                highlights={[
                  { icon: Target, label: "94% role fit", at: "tr" },
                  { icon: Search, label: "Live listings", at: "bl" },
                ]}
              >
                <JobMatchingDemo />
              </DepthShowcase>
              </Parallax>
            </Reveal>
            <Reveal className="lg:order-1">
              <Parallax distance={34} className="space-y-5">
              <Eyebrow>02 — Job matching</Eyebrow>
              <Heading>Stop applying everywhere. Apply where you actually fit.</Heading>
              <Lede>
                Gradr scores live listings against your resume and goals, and shows you the skills you already match
                alongside the ones you're missing — before you spend an hour on the application.
              </Lede>
              <ul className="grid gap-2 sm:grid-cols-2">
                {["Match score", "Matched skills", "Missing skills", "Salary where listed", "Location and work mode", "Role alignment"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button size="lg" variant="outline" onClick={start("feature_section", "Find my matches", "/match")}>
                <Search className="mr-2 h-4 w-4" aria-hidden />
                Find my matches
              </Button>
              </Parallax>
            </Reveal>
          </div>
        </Section>

        {/* --------------------------- application engine ----------------------- */}
        <Section id="applications" className="border-t border-border/60">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal className="space-y-5">
              <Eyebrow>03 — Application engine</Eyebrow>
              <Heading>One job description in. A full application out.</Heading>
              <Lede>
                Paste a link or a description. Gradr produces tailored resume bullets, a cover letter written for that
                specific role, a short recruiter message, and a tracked entry in your pipeline.
              </Lede>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Everything stays editable. Gradr drafts the first version so you spend your time on judgment, not
                formatting.
              </p>
              <Button size="lg" onClick={start("feature_section", "Build an application", "/applications")}>
                Build an application
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Reveal>
            <Reveal delay={100} hoverLift><ScrollFloat><ApplicationVisual /></ScrollFloat></Reveal>
          </div>
        </Section>

        {/* -------------------------- flagship: interview ----------------------- */}
        <Section id="interview" className="relative border-t border-border/60 bg-card/40">
          <SceneBackground variant="beams" intensity={0.45} />
          <Reveal className="max-w-3xl space-y-5">
            <Eyebrow>Flagship — AI mock interview</Eyebrow>
            <Heading>Practice the interview before the interview.</Heading>
            <Lede>
              A spoken, real-time interview with an AI interviewer that listens, interrupts naturally, and asks follow-ups
              based on what you actually said. Not a chatbot with a question list.
            </Lede>
          </Reveal>

          <Reveal delay={100} hoverLift className="mt-10">
            <Parallax distance={-56}>
            <DepthShowcase
              tilt={5}
              highlights={[
                { icon: Mic, label: "Real-time voice", at: "tl" },
                { icon: LineChart, label: "Scored debrief", at: "br" },
              ]}
            >
              <InterviewCoachDemo />
            </DepthShowcase>
            </Parallax>
          </Reveal>

          <MagicBento
            className="mt-10"
            columns={3}
            items={[
              { key: "adaptive", icon: Bot, title: "Adaptive interviewer", copy: "The session adapts to role, company, industry, seniority, difficulty, and how you're performing in the moment." },
              { key: "real", icon: Mic, title: "Real conversation", copy: "Speak naturally, interrupt mid-question, and get a contextual follow-up instead of a scripted next prompt." },
              { key: "scored", icon: LineChart, title: "Scored report", copy: "Every session ends with strengths, specific improvements, a full transcript, and the questions to practice next." },
            ]}
          />

          <Reveal delay={80} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SpatialCta>
              <Button size="lg" onClick={start("feature_section", "Run a mock interview", "/interview")}>
                Run a mock interview
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </SpatialCta>
            <Button size="lg" variant="outline" onClick={() => goToApp(appPricingHref(), navigate)}>
              See interview plans
            </Button>
          </Reveal>
        </Section>

        {/* ---------------------------- career assistant ------------------------ */}
        <Section id="assistant" className="border-t border-border/60">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal delay={100} className="lg:order-2"><ScrollFloat><AssistantVisual /></ScrollFloat></Reveal>
            <Reveal className="space-y-5 lg:order-1">
              <Eyebrow>04 — Career assistant</Eyebrow>
              <Heading>Your career strategist, whenever you need it.</Heading>
              <Lede>
                The assistant sees your resume, your matches, your pipeline, and your interview history — so its answers
                are about your search, not job-hunting in general.
              </Lede>
              <ul className="space-y-2">
                {[
                  "What jobs should I apply to?",
                  "Why am I getting rejected?",
                  "How should I improve my resume?",
                  "What should I practice before my interview?",
                  "Which skills should I learn next?",
                ].map((q) => (
                  <li key={q} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm text-muted-foreground">
                    “{q}”
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Section>

        {/* -------------------------------- analytics --------------------------- */}
        <Section className="border-t border-border/60 bg-card/30">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal className="space-y-5">
              <Eyebrow>05 — Career analytics</Eyebrow>
              <Heading>A command center for your search.</Heading>
              <Lede>
                Track what's moving and what's stuck: ATS health, pipeline stages, interview performance over time,
                competency trends, and how ready you are for the roles you're targeting.
              </Lede>
              <ul className="grid gap-2 sm:grid-cols-2">
                {["ATS health", "Application pipeline", "Interview performance", "Competency trends", "Job readiness", "Practice progress"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={100}>
              <DepthShowcase
                highlights={[
                  { icon: LineChart, label: "Readiness trend", at: "tr" },
                  { icon: Layers, label: "Pipeline health", at: "bl" },
                ]}
              >
                <CareerIntelligenceDemo />
              </DepthShowcase>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------- audience ----------------------------- */}
        <Section className="border-t border-border/60">
          <Reveal className="space-y-5">
            <Eyebrow>Who it's for</Eyebrow>
            <Heading>Built for people actively moving toward a job.</Heading>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map((a, i) => (
              <Reveal key={a.title} delay={i * 50}>
                <SpatialCard className="group/spatial h-full rounded-2xl" tilt={3} lift={5}>
                <SpotlightCard className="h-full p-6">
                  <div id={a.id} className="scroll-mt-28" />
                  <a.icon className="h-5 w-5 text-primary" aria-hidden />
                  <Text variant="h6" as="h3" className="mt-4">{a.title}</Text>
                  <Text variant="body-sm" tone="muted" className="mt-1.5">{a.copy}</Text>
                </SpotlightCard>
                </SpatialCard>
              </Reveal>
            ))}
            <Reveal delay={250}>
              <SpotlightCard className="flex h-full flex-col justify-center p-lg">
              <Text variant="body-sm" tone="muted">
                Not sure where you fit? Start free — Gradr adapts to the stage you're actually at.
              </Text>
              <Button variant="outline" className="mt-4 w-full sm:w-auto" onClick={start("pricing", "Get started free")}>
                Get started free
              </Button>
              </SpotlightCard>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------ how it works -------------------------- */}
        <Section id="how-it-works" className="relative border-t border-border/60 bg-card/30">
          <SceneBackground variant="gridscan" intensity={0.35} />
          <Reveal className="space-y-5">
            <Eyebrow>How it works</Eyebrow>
            <Heading>Seven steps, one system.</Heading>
          </Reveal>

          <ol className="mt-10 space-y-px overflow-hidden rounded-2xl border border-border bg-border">
            {HOW.map((step, i) => (
              <Reveal as="li" key={step} delay={i * 40} className="step-connector flex items-center gap-4 bg-card px-5 py-4 sm:px-6">
                <span className="w-8 shrink-0 text-sm font-semibold tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-foreground sm:text-base">{step}</span>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={80} className="mt-8">
            <Button size="lg" onClick={start("feature_section", "Start building your career system", "/")}>
              Start building your career system
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </Reveal>
        </Section>

        {/* -------------------------------- why gradr --------------------------- */}
        <Section className="border-t border-border/60">
          <Reveal className="space-y-5">
            <Eyebrow>Why Gradr</Eyebrow>
            <Heading>Same job search. Different workflow.</Heading>
          </Reveal>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Reveal>
              <SpotlightCard tilt className="h-full p-lg">
              <Text variant="overline" as="h3">The usual setup</Text>
              <ul className="mt-5 space-y-3">
                {OLD_WAY.map((t) => (
                  <li key={t} className="flex gap-3 text-sm text-muted-foreground">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Text variant="caption" className="mt-5">Five tools that never talk to each other.</Text>
              </SpotlightCard>
            </Reveal>

            <Reveal delay={100}>
              <SpotlightCard tilt className="h-full p-lg">
              <Text variant="overline" as="h3" tone="primary">Gradr</Text>
              <ul className="mt-5 space-y-3">
                {NEW_WAY.map((t) => (
                  <li key={t} className="flex gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Text variant="caption" className="mt-5">One connected career system.</Text>
              </SpotlightCard>
            </Reveal>
          </div>
        </Section>

        {/* --------------------------------- pricing ---------------------------- */}
        {/* --------------------------- the transformation ----------------------- */}
        <Section id="transformation" className="relative border-t border-border/60">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <Reveal className="space-y-5">
              <Eyebrow>The difference</Eyebrow>
              <Heading>Same experience. Rewritten so a machine can read it.</Heading>
              <Lede>
                Most resumes get filtered before a person ever opens them. Gradr keeps your history
                honest and rewrites how it is stated — measurable outcomes, active verbs, the
                keywords the posting actually uses.
              </Lede>
              <ul className="grid gap-2 sm:grid-cols-2">
                {["Quantified impact", "Active phrasing", "Keyword coverage", "Parser-safe structure"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button size="lg" onClick={start("feature_section", "Rewrite my resume", "/resume")}>
                Rewrite my resume
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Reveal>
            <Reveal delay={100}>
              <ScrollFloat distance={64}>
                <ResumeTransform />
              </ScrollFloat>
            </Reveal>
          </div>
        </Section>

        <Section id="pricing" className="relative border-t border-border/60 bg-card/30">
          <SceneBackground variant="aurora" intensity={0.35} />
          <Reveal className="space-y-5">
            <Eyebrow>Pricing</Eyebrow>
            <Heading>Start free. Upgrade when it's working.</Heading>
            <Lede>No trials that expire without warning, no countdown timers. Cancel any time.</Lede>
          </Reveal>

          <Reveal delay={60} className="mt-8">
            <div
              role="group"
              aria-label="Billing interval"
              className="interactive inline-flex rounded-xl border border-border bg-secondary/40 p-1"
            >
              {(["monthly", "annual"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={billing === k}
                  onClick={() => setBilling(k)}
                  className={`relative min-h-10 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    billing === k ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {billing === k && (
                    <motion.span
                      layoutId="billing-pill"
                      aria-hidden
                      className="absolute inset-0 rounded-lg bg-primary"
                      transition={springSnappy}
                    />
                  )}
                  <span className="relative z-10">{k === "monthly" ? "Monthly" : "Yearly"}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-mahogany-border bg-mahogany/10 px-3 py-1 text-xs font-medium text-mahogany">
              {ANNUAL_SAVINGS_MESSAGE}
            </p>
          </Reveal>

          <ScrollFloat distance={40} className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p, i) => {
              const priceLabel = planPriceLabel(p.id, billing);
              const periodNote =
                p.id === "free" ? "forever" : billing === "annual" ? "per year" : "per month";
              const savings = billing === "annual" ? annualSavingsPercent(p.id) : 0;
              return (
                <Reveal key={p.name} delay={i * 70} className="h-full">
                <TiltCard
                  maxTilt={6}
                  shadow="md"
                  glass={false}
                  className={`flex h-full flex-col rounded-card p-6 ${
                    p.highlight
                      ? "border-primary/40 bg-primary/[0.05] shadow-float ring-1 ring-primary/20"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Text variant="overline" as="h3" className="text-foreground">{p.name}</Text>
                    {p.highlight && (
                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        <GradientText variant="shine">Most complete</GradientText>
                      </span>
                    )}
                  </div>
                  <Text variant="body-sm" tone="muted" className="mt-2">{p.tagline}</Text>

                  <div className="mt-6 flex items-baseline gap-2">
                    <Text variant="h3" as="span" className="tabular-nums">{priceLabel}</Text>
                    <Text variant="body-sm" as="span" tone="muted">{periodNote}</Text>
                  </div>
                  {savings > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="tabular-nums text-muted-foreground line-through">
                        {formatUsd(annualListPrice(p.id))}
                      </span>
                      <span className="rounded-full bg-mahogany px-2 py-0.5 font-semibold text-mahogany-foreground">
                        Save {savings}%
                      </span>
                    </div>
                  )}

                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-6 w-full"
                    variant={p.highlight ? "primary" : "outline"}
                    onClick={() => {
                      if (p.name === "Free") {
                        start("pricing", p.cta)();
                        return;
                      }
                      trackUpgradeCta({
                        location: "pricing",
                        text: p.cta,
                        plan: p.name.toLowerCase(),
                        billingPeriod: "annual",
                      });
                      goToApp(user ? appPricingHref() : appSignInHref("/pricing"), navigate);
                    }}
                  >
                    {p.cta}
                  </Button>
                </TiltCard>
                </Reveal>
              );
            })}
          </ScrollFloat>
        </Section>

        {/* ----------------------------------- faq ------------------------------ */}
        <Section id="faq" className="border-t border-border/60">
          <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            {/* Sticky so the short heading column tracks the accordion instead
                of leaving a tall dead area beside it on wide screens. */}
            <Reveal className="space-y-5 lg:sticky lg:top-28">
              <Eyebrow>FAQ</Eyebrow>
              <Heading>Questions, answered directly.</Heading>
            </Reveal>

            <Reveal delay={80}>
              <Accordion type="single" collapsible className="accordion-premium flex w-full flex-col gap-3">
                {FAQS.map(([q, a], i) => (
                  <AccordionItem key={q} value={`faq-${i}`} className="overflow-hidden rounded-card border border-border transition-colors hover:border-primary/20 data-[state=open]:border-primary/25 data-[state=open]:bg-primary/[0.02]">
                    <AccordionTrigger className="px-5 py-4 text-left text-sm font-medium hover:no-underline sm:text-base">
                      {q}
                    </AccordionTrigger>
                    <AccordionContent className="px-5 text-sm leading-relaxed text-muted-foreground">
                      {a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </Section>

        {/* --------------------------- earn & partner --------------------------- */}
        <Section id="earn" className="border-t border-border/60">
          <Reveal className="mx-auto max-w-2xl space-y-5 text-center">
            <Eyebrow>Earn &amp; Partner</Eyebrow>
            <Heading>More ways to get more from Gradr</Heading>
            <Text variant="lead">
              Beyond the product, Gradr runs an earning ecosystem and a partner program —
              two distinct ways to benefit from the platform.
            </Text>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            <Reveal>
              <TiltCard maxTilt={5} shadow="lg" className="flex h-full flex-col rounded-card border border-border bg-card p-6 sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-primary/10 text-primary">
                  <Coins className="h-5 w-5" aria-hidden />
                </div>
                <Text variant="h5" as="h3" className="mt-5">Earn with Gradr</Text>
                <Text variant="body-sm" className="mt-2 flex-1">
                  Gradr Earn lets you earn reward credits through Trust, Bounties and other
                  verified opportunities — a broader ecosystem built around real career activity.
                </Text>
                <a
                  href={earnHome}
                  className={`${buttonVariants({ variant: "outline", size: "md" })} mt-6 w-full sm:w-auto`}
                >
                  Explore Gradr Earn
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </TiltCard>
            </Reveal>

            <Reveal delay={80}>
              <TiltCard maxTilt={5} shadow="lg" className="flex h-full flex-col rounded-card border border-border bg-card p-6 sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-primary/10 text-primary">
                  <Handshake className="h-5 w-5" aria-hidden />
                </div>
                <Text variant="h5" as="h3" className="mt-5">Partner with Gradr</Text>
                <Text variant="body-sm" className="mt-2 flex-1">
                  Share Gradr with your audience and potentially earn affiliate commissions from
                  eligible referrals — with clear attribution, qualification and payout rules.
                </Text>
                <a
                  href={earnPartner}
                  className={`${buttonVariants({ variant: "outline", size: "md" })} mt-6 w-full sm:w-auto`}
                >
                  Become a Partner
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </TiltCard>
            </Reveal>
          </div>
        </Section>

        {/* -------------------------------- final CTA --------------------------- */}
        <Section className="border-t border-border/60">
          <ScrollFloat distance={56}>
          <Reveal className="light-rim light-key relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card to-brand-secondary/[0.04] px-6 py-14 text-center shadow-3d-hero sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/12 to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-secondary/[0.04] to-transparent" aria-hidden />
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <Text variant="h2" className="relative mx-auto max-w-3xl text-balance">
              Your next opportunity deserves more than another resume.
            </Text>
            <Text variant="lead" className="relative mx-auto mt-4 max-w-xl">
              Build a smarter career system with Gradr.
            </Text>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <AuthCta href={appSignInHref()} onActivate={start("final_cta", "Get started free")} size="lg" className="btn-glow">
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </AuthCta>

              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollIntoViewSafely("product")}
              >
                Explore Gradr
              </Button>
            </div>
          </Reveal>
          </ScrollFloat>
        </Section>
      </main>

      {/* --------------------------------- footer ------------------------------ */}
      <footer className="relative border-t border-border bg-card/30 py-14">
        <div className="page-shell grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <BrandLogo size={28} />
              <span className="text-base font-bold tracking-[0.24em]">GRADR</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              An AI career operating system for the whole path from resume to offer.
            </p>
            <NewsletterSignup source="landing-footer" topic="career guides" />
            <div className="flex items-center gap-4">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on Instagram"
                className="link-tap inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-control"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on Facebook"
                className="link-tap inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-control"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on X"
                className="link-tap inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-control"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on YouTube"
                className="link-tap inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-control"
              >
                <YouTubeIcon className="h-4 w-4" />
              </a>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on Discord"
                className="link-tap inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-control"
              >
                <DiscordIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(([label, href]) => {
                  const linkClass =
                    "link-tap rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
                  // In-app routes stay client-side; hashes and mailto links do not.
                  // "earn:<path>" resolves to the Earn surface for the current host.
                  const internal = href.startsWith("/");
                  const resolved = href.startsWith("earn:") ? urlFor("earn", href.slice(5)) : href;
                  return (
                    <li key={label}>
                      {internal ? (
                        <Link to={href} className={linkClass}>
                          {label}
                        </Link>
                      ) : (
                        <a href={resolved} className={linkClass}>
                          {label}
                        </a>
                      )}
                    </li>
                  );
                })}

              </ul>
            </nav>
          ))}
        </div>

        <div className="page-shell mt-12 flex flex-col gap-2 border-t border-border/60 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Gradr. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">Built for people actively looking for their next role.</p>
        </div>
      </footer>
    </div>
  );
}
