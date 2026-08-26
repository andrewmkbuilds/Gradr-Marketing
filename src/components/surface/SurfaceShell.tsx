import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { type Surface, urlFor } from "@/config/domains";
import { appLoginHref, appSignupHref } from "@/lib/appLinks";
import { CrossLink, SLink, useSurface, useSurfacePath } from "@/components/surface/SurfaceLink";

export interface SurfaceNavItem {
  label: string;
  to: string;
}

/** The Gradr ecosystem map, rendered identically on every public surface. */
const ECOSYSTEM: { label: string; surface: Surface; to?: string }[] = [
  { label: "Home", surface: "home" },
  { label: "Product", surface: "marketing" },
  { label: "News", surface: "news" },
  { label: "Docs", surface: "docs" },
  { label: "Affiliates", surface: "affiliates" },
  { label: "Status", surface: "status" },
  { label: "Support", surface: "support" },
];

interface SurfaceShellProps {
  /** In-surface navigation shown in the header. */
  nav?: SurfaceNavItem[];
  /** Short label describing this surface, shown next to the wordmark. */
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for every public Gradr subdomain.
 *
 * The header carries in-surface navigation plus the ecosystem switcher, so the
 * surfaces read as one product rather than five unrelated sites.
 */
export function SurfaceShell({ nav = [], eyebrow, children }: SurfaceShellProps) {
  const { surface } = useSurface();
  const path = useSurfacePath();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to: string) => {
    const full = path(to);
    return pathname === full || (to !== "/" && pathname.startsWith(`${full}/`));
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
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
          <div className="flex items-center gap-3">
            <CrossLink
              surface="home"
              className="flex items-center gap-2 rounded-lg font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandLogo size={24} />
              Gradr
            </CrossLink>
            {eyebrow && (
              <SLink
                to="/"
                className="hidden rounded-md border border-brand-secondary/40 px-2 py-0.5 text-xs font-medium text-brand-secondary sm:inline-block"
              >
                {eyebrow}
              </SLink>
            )}
          </div>

          <nav aria-label="Section" className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <SLink
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
              </SLink>
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
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
            >
              {menuOpen ? <Menu className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4 rotate-45" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border/60 bg-background lg:hidden">
            <div className="page-shell flex flex-col py-3">
              {nav.map((item) => (
                <SLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </SLink>
              ))}
              <div className="my-2 h-px bg-border" />
              {ECOSYSTEM.filter((e) => e.surface !== surface).map((item) => (
                <CrossLink
                  key={item.surface}
                  surface={item.surface}
                  to={item.to}
                  className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </CrossLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-border/60 bg-card/40">
        <div className="page-shell flex flex-col gap-6 py-10">
          <nav aria-label="Gradr ecosystem" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {ECOSYSTEM.map((item) => (
              <CrossLink
                key={item.surface}
                surface={item.surface}
                to={item.to}
                aria-current={item.surface === surface ? "page" : undefined}
                className={cn(
                  "link-tap text-sm transition-colors hover:text-foreground",
                  item.surface === surface ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </CrossLink>
            ))}
            <CrossLink
              surface="app"
              className="link-tap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Open the app
            </CrossLink>
          </nav>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <CrossLink surface="home" to="/privacy" className="link-tap text-xs text-muted-foreground hover:text-foreground">
              Privacy
            </CrossLink>
            <CrossLink surface="home" to="/terms" className="link-tap text-xs text-muted-foreground hover:text-foreground">
              Terms
            </CrossLink>
            <CrossLink surface="home" to="/cookie-policy" className="link-tap text-xs text-muted-foreground hover:text-foreground">
              Cookies
            </CrossLink>
            <CrossLink surface="home" to="/childrens-privacy" className="link-tap text-xs text-muted-foreground hover:text-foreground">
              Children's privacy
            </CrossLink>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Gradr
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
