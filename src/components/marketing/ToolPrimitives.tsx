/**
 * Premium primitives for tool landing pages.
 *
 * These wrap the existing motion + effects libraries so every tool page
 * (ATS checker, cover letter, interview coach, job tracker) shares the
 * same scroll-reveal, scene-background, and depth-card language as the
 * main Landing page — without duplicating its one-off canvas effects.
 */
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { SceneBackground } from "@/components/effects";
import { SpotlightCard } from "@/components/effects";
import { GradientText } from "@/components/effects";
import { AnimatedHeading } from "@/components/effects";
import { easeOut, viewportOnce } from "@/components/motion";
import { cn } from "@/lib/utils";

/* ------------------------------ Hero ------------------------------ */

export function ToolHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cta-glow relative overflow-hidden pt-12 sm:pt-16">
      <SceneBackground variant="rays" intensity={0.4} fadeBottom />
      <div className="relative mx-auto max-w-3xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="type-eyebrow inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3 py-1.5 text-brand-secondary backdrop-blur"
        >
          <GradientText variant="shine">{eyebrow}</GradientText>
        </motion.span>

        <AnimatedHeading
          as="h1"
          variant="mask"
          text={title}
          className="type-section mt-5 text-balance"
          immediate
          delay={0.08}
        />

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.3 }}
          className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          {lede}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.45 }}
          className="mt-8"
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------ Section ------------------------------ */

export function ToolSection({
  id,
  children,
  className,
  bg = "default",
  sceneVariant,
  sceneIntensity = 0.35,
  ...rest
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  bg?: "default" | "card";
  sceneVariant?: "dots" | "threads" | "beams" | "gridscan" | "aurora" | "rays";
  sceneIntensity?: number;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      id={id}
      className={cn(
        "section-gap relative scroll-mt-24",
        bg === "card" && "bg-card/30",
        className,
      )}
      {...rest}
    >
      {sceneVariant && <SceneBackground variant={sceneVariant} intensity={sceneIntensity} />}
      <div className="relative">{children}</div>
    </section>
  );
}

/* ------------------------------ Eyebrow + Heading ------------------------------ */

export function ToolEyebrow({ children }: { children: React.ReactNode }) {
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

export function ToolHeading({ children }: { children: React.ReactNode }) {
  if (typeof children === "string") {
    return (
      <AnimatedHeading
        as="h2"
        variant="mask"
        text={children}
        className="type-h1 mt-4 text-balance"
      />
    );
  }
  return <h2 className="type-h1 mt-4 text-balance">{children}</h2>;
}

/* ------------------------------ Step Card ------------------------------ */

export function ToolStepCard({
  icon: Icon,
  index,
  title,
  children,
  delay = 0,
}: {
  icon: LucideIcon;
  index: number;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <SpotlightCard className="card-conic step-connector h-full rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className="icon-premium depth-press">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="font-display text-base font-semibold text-foreground">
            <span className="mr-1 text-muted-foreground">{index}.</span> {title}
          </h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </SpotlightCard>
    </Reveal>
  );
}

/* ------------------------------ Feature Card ------------------------------ */

export function ToolFeatureCard({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="card-conic h-full rounded-2xl p-5">
        {Icon && (
          <div className="icon-premium mb-3 depth-press">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        )}
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </Reveal>
  );
}

/* ------------------------------ CTA Section ------------------------------ */

export function ToolCtaSection({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className="cta-glow section-gap relative overflow-hidden rounded-3xl border border-primary/25 bg-primary/[0.04] p-8 text-center sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(40rem 20rem at 50% -20%, hsl(var(--primary) / 0.12), transparent 70%)",
          }}
        />
        {/* Top accent line */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4) 50%, transparent)",
          }}
        />
        <div className="relative">
          <h2 className="type-h1 text-balance">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">{lede}</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {children}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------ Premium Table ------------------------------ */

export function ToolTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: { cells: React.ReactNode[]; isHeader?: boolean }[];
}) {
  return (
    <Reveal>
      <div
        className="overflow-x-auto rounded-2xl border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="group"
        aria-label={caption}
      >
        <table className="table-premium w-full min-w-[420px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              {headers.map((h, i) => (
                <th key={i} scope="col" className={cn("py-3 font-medium", i < headers.length - 1 ? "pr-4" : "")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 transition-colors hover:bg-primary/[0.04]">
                {row.cells.map((cell, j) =>
                  j === 0 ? (
                    <th
                      key={j}
                      scope="row"
                      className="py-3 pr-4 text-left font-medium text-foreground"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td
                      key={j}
                      className={cn("py-3 text-muted-foreground", j < row.cells.length - 1 ? "pr-4" : "")}
                    >
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}

/* ------------------------------ Related Links ------------------------------ */

export function ToolRelatedLinks({
  title = "Keep reading",
  links,
}: {
  title?: string;
  links: { to: string; title: string; desc: string; onClick?: () => void }[];
}) {
  return (
    <ToolSection>
      <Reveal className="space-y-4">
        <ToolEyebrow>Resources</ToolEyebrow>
        <ToolHeading>{title}</ToolHeading>
      </Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {links.map((link, i) => (
          <Reveal key={link.to} delay={i * 50}>
            <a
              href={link.to}
              onClick={link.onClick}
              className="border-gradient-hover group block h-full rounded-2xl border border-border bg-card p-5"
            >
              <p className="flex items-center gap-1 font-medium text-foreground">
                {link.title}
                <span className="text-primary transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                  →
                </span>
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{link.desc}</p>
            </a>
          </Reveal>
        ))}
      </div>
    </ToolSection>
  );
}
