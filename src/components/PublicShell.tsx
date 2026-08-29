import { appHref, appLoginHref, appSignupHref } from "@/lib/appLinks";
import { Link, useLocation } from "react-router-dom";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { ArrowRight, Instagram, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackSignupCta } from "@/lib/telemetry/events";
import { LEGAL_PAGES } from "@/content/legal";
import { INSTAGRAM_URL } from "@/config/social";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { cn } from "@/lib/utils";

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

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

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

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="page-shell flex h-16 items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo size={24} />
            Gradr
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.to) ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive(item.to)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {isActive(item.to) && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-secondary"
                  />
                )}
              </Link>
            ))}
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
              className={buttonVariants({ size: "md" })}
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground md:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav aria-label="Mobile" className="border-t border-border/60 bg-background md:hidden">
            <ul className="page-shell py-2">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-2 py-3 text-sm text-foreground hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="page-shell section-y-sm">{children}</main>

      <footer className="border-t border-border/60 py-10">
        <div className="page-shell grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
              <BrandLogo size={22} />
              Gradr
            </Link>
            <p className="text-sm text-muted-foreground">
              The AI career command center — resumes, matching, applications and interview practice
              in one workflow.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Gradr on Instagram"
              className="link-tap inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
              Instagram
            </a>
          </div>

          <nav aria-label="Explore" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Explore</p>
            <ul className="space-y-2">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link-tap text-muted-foreground hover:text-foreground">
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
                    className="link-tap text-muted-foreground hover:text-foreground"
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
                  <Link to={item.to} className="link-tap text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>



          <nav aria-label="Legal" className="space-y-3 text-sm">
            <p className="type-overline text-muted-foreground">Legal</p>
            <ul className="space-y-2">
              {LEGAL_PAGES.map((page) => (
                <li key={page.path}>
                  <Link to={page.path} className="link-tap text-muted-foreground hover:text-foreground">
                    {page.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/legal" className="link-tap text-muted-foreground hover:text-foreground">
                  Legal &amp; contact
                </Link>
              </li>
              <li>
                <Link to="/connect" className="link-tap text-muted-foreground hover:text-foreground">
                  Connect an AI assistant
                </Link>
              </li>
              <li>
                <a href={appLoginHref()} className="link-tap text-muted-foreground hover:text-foreground">
                  Sign in
                </a>
              </li>


            </ul>
          </nav>
        </div>

        <div className="page-shell mt-10 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Gradr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
