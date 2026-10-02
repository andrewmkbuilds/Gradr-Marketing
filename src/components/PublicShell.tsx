import { appHref, appLoginHref, appSignupHref } from "@/lib/appLinks";
import { Link, useLocation } from "react-router-dom";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { ArrowRight, Instagram, Menu, X } from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { XIcon } from "@/components/icons/XIcon";
import { YouTubeIcon } from "@/components/icons/YouTubeIcon";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackSignupCta } from "@/lib/telemetry/events";
import { LEGAL_PAGES } from "@/content/legal";
import {
  DISCORD_URL,
  FACEBOOK_URL,
  INSTAGRAM_URL,
  X_URL,
  YOUTUBE_URL,
} from "@/config/social";
import { urlFor } from "@/config/domains";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { easeOut, springSnappy } from "@/lib/motion/tokens";

interface PublicShellProps {
  children: React.ReactNode;
  /** Identifier used for CTA analytics. */
  source: string;
}

const NAV = [
  { label: "Career advice", to: "/career-advice" },
  { label: "Job search", to: "/job-search" },
  { label: "ATS checker", to: "/ats-resume-checker" },
  { label: "Pricing", to: "/pricing" },
];

/**
 * Product destinations live on the app surface only — this project ships no
 * product routes, so these must be absolute app.gradr.me links.
 */
const PRODUCT_LINKS = [
  { label: "Resume Intelligence", path: "/resume" },
  { label: "AI Mock Interview", path: "/interview" },
  { label: "Job matching", path: "/match" },
  { label: "Application engine", path: "/apply" },
];

/** Public, indexable tool landing pages — kept crawlable from every footer. */
const TOOL_LINKS = [
  { label: "Job application tracker", to: "/job-application-tracker" },
  { label: "ATS resume checker", to: "/ats-resume-checker" },
  { label: "AI interview coach", to: "/ai-interview-coach" },
  { label: "AI cover letter generator", to: "/ai-cover-letter-generator" },
  { label: "Career advice hub", to: "/career-advice" },
];

/** Chrome for public, indexable pages (guides + job landing pages). */
export function PublicShell({ children, source }: PublicShellProps) {
  const { pathname } = useLocation();
  const { open: menuOpen, setOpen: setMenuOpen, toggle: toggleMenu } = useMobileMenu();
  const [scrolled, setScrolled] = useState(false);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-dvh bg-background">
      {/* Ambient Ocean Teal wash — decorative, sits behind everything. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[32rem] opacity-[0.14]"
        style={{
          background:
            "radial-gradient(60rem 24rem at 20% -10%, hsl(var(--primary)) 0%, transparent 65%)",
        }}
      />

      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300",
          scrolled
            ? "depth-lit border-b border-border/60 bg-background/85 backdrop-blur-xl"
            : "border-b border-transparent bg-background/60 backdrop-blur-md",
        )}
      >
        <div className={cn(
          "page-shell flex items-center justify-between gap-4 transition-all duration-300",
          scrolled ? "h-14" : "h-16",
        )}>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <BrandLogo size={scrolled ? 22 : 24} />
            </motion.span>
            <span className={cn(
              "font-bold tracking-[0.2em] transition-all duration-300",
              scrolled ? "text-sm" : "text-base",
            )}>
              GRADR
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-0.5 xl:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.to) ? "page" : undefined}
                className={cn(
                  "relative z-10 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive(item.to)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {isActive(item.to) && (
                  <motion.span
                    layoutId="public-shell-nav-pill"
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-lg border border-primary/25 bg-primary/10"
                    transition={springSnappy}
                  />
                )}
              </Link>
            ))}
            <a
              href={urlFor("earn", "/")}
              className="relative z-10 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Earn
            </a>
            <a
              href={urlFor("earn", "/partner")}
              className="relative z-10 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Partner with Gradr
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href={appLoginHref()}
              className="hidden h-10 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </a>
            <a
              href={appSignupHref()}
              onClick={() => trackSignupCta({ location: "navbar", text: "Get started", authenticated: false, destination: appSignupHref() })}
              className={cn(buttonVariants({ size: "md" }), "btn-glow group")}
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted xl:hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              aria-label="Mobile"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="overflow-hidden border-t border-border/60 bg-background/95 backdrop-blur-xl xl:hidden"
            >
              <motion.ul
                className="page-shell py-3"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
              >
                {NAV.map((item) => (
                  <motion.li
                    key={item.to}
                    variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                    transition={{ duration: 0.25, ease: easeOut }}
                  >
                    <Link
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                        isActive(item.to) ? "text-foreground bg-primary/5" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
                <motion.li
                  variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.25, ease: easeOut }}
                >
                  <a
                    href={urlFor("earn", "/")}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Earn
                  </a>
                </motion.li>
                <motion.li
                  variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.25, ease: easeOut }}
                >
                  <a
                    href={urlFor("earn", "/partner")}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Partner with Gradr
                  </a>
                </motion.li>
              </motion.ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="page-shell section-y-sm page-enter">{children}</main>

      <footer className="relative mt-16 border-t border-border/60 bg-card/30 py-12">
        {/* Top accent line */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3) 50%, transparent)",
          }}
        />
        <div className="page-shell grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
              <BrandLogo size={22} />
              Gradr
            </Link>
            <p className="text-sm text-muted-foreground">
              The AI career command center — resumes, matching, applications and interview practice
              in one workflow.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on Instagram"
                className="link-tap inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Instagram
              </a>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on Facebook"
                className="link-tap inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <FacebookIcon className="h-4 w-4" />
                Facebook
              </a>
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on X"
                className="link-tap inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="h-4 w-4" />
                X
              </a>
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on YouTube"
                className="link-tap inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <YouTubeIcon className="h-4 w-4" />
                YouTube
              </a>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gradr on Discord"
                className="link-tap inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <DiscordIcon className="h-4 w-4" />
                Discord
              </a>
            </div>
          </div>

          <nav aria-label="Explore" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Explore</p>
            <ul className="space-y-2">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link-tap text-muted-foreground transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Product" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Product</p>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((item) => (
                <li key={item.path}>
                  <a
                    href={appHref(item.path)}
                    className="link-tap text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Free tools" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Free tools</p>
            <ul className="space-y-2">
              {TOOL_LINKS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link-tap text-muted-foreground transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>



          <nav aria-label="Earn" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Earn</p>
            <ul className="space-y-2">
              <li>
                <a
                  href={urlFor("earn", "/")}
                  className="link-tap text-muted-foreground transition-colors hover:text-primary"
                >
                  Earn with Gradr
                </a>
              </li>
              <li>
                <a
                  href={urlFor("earn", "/partner")}
                  className="link-tap text-muted-foreground transition-colors hover:text-primary"
                >
                  Partner with Gradr
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Legal</p>
            <ul className="space-y-2">
              {LEGAL_PAGES.map((page) => (
                <li key={page.path}>
                  <Link to={page.path} className="link-tap text-muted-foreground transition-colors hover:text-primary">
                    {page.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/legal" className="link-tap text-muted-foreground transition-colors hover:text-primary">
                  Legal &amp; contact
                </Link>
              </li>
              <li>
                <Link to="/connect" className="link-tap text-muted-foreground transition-colors hover:text-primary">
                  Connect an AI assistant
                </Link>
              </li>
              <li>
                <a href={appLoginHref()} className="link-tap text-muted-foreground transition-colors hover:text-primary">
                  Sign in
                </a>
              </li>


            </ul>
          </nav>
        </div>
        <div className="page-shell mt-10 border-t border-border/60 pt-6">
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} Gradr. All rights reserved.</p>
            <p className="text-xs">Designed for the modern job search.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
