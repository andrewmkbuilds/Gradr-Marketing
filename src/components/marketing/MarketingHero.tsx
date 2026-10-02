import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { duration, easeOut } from "@/lib/motion/tokens";
import { measure, typography } from "@/lib/design/typography";
import { cn } from "@/lib/utils";

export interface MarketingHeroProps {
  /** Small uppercase kicker — names the section of the site. */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons, search fields or badges under the copy. */
  actions?: ReactNode;
  /** Breadcrumb or supporting chips rendered above the eyebrow. */
  above?: ReactNode;
  className?: string;
}

/**
 * The opening statement on every public page. Same rhythm as the in-app
 * PageHeader — an Ocean Teal wash, a display-type headline that resolves on
 * mount — so marketing and product read as one product, not two websites.
 */
export function MarketingHero({
  eyebrow,
  title,
  description,
  actions,
  above,
  className,
}: MarketingHeroProps) {
  const reduced = useReducedMotionPref();

  return (
    <header className={cn("cta-glow relative isolate overflow-hidden pb-2", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 h-72 w-[42rem] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 68%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-20 h-56 w-96 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--brand-secondary)) 0%, transparent 68%)" }}
      />

      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0.14 } : { duration: duration.base, ease: easeOut }}
        className="space-y-4"
      >
        {above}
        {eyebrow && (
          <p className={cn(typography.eyebrow, "section-eyebrow tracking-[0.2em]")}>
            {eyebrow}
          </p>
        )}
        <h1 className={cn(typography.section, "text-foreground text-balance")}>{title}</h1>
        {description && (
          <p className={cn(typography.lede, measure.default)}>{description}</p>
        )}
        {actions && <div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div>}
      </motion.div>

      {/* Hairline that draws itself across the page. */}
      <motion.div
        aria-hidden="true"
        initial={reduced ? { opacity: 1 } : { scaleX: 0 }}
        animate={reduced ? { opacity: 1 } : { scaleX: 1 }}
        transition={{ duration: 0.7, ease: easeOut, delay: 0.1 }}
        style={{ transformOrigin: "left" }}
        className="section-divider mt-8"
      />
    </header>
  );
}
