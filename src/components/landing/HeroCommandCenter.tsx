import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { useDepthCapability } from "@/hooks/useDepthCapability";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { forwardRef, useRef } from "react";
import { Activity, Bot, Check, FileText, Mic, Sparkles, Target } from "lucide-react";
import { CountUp } from "@/components/motion";
import { springPointer, springSoft, easeOut } from "@/lib/motion/tokens";

/* --------------------------- small building blocks -------------------------- */

function Bar({ label, value, delay }: { label: string; value: number; delay: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground/80">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-brand-glow"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value / 100 }}
          style={{ transformOrigin: "left" }}
          transition={{ duration: 1.1, ease: easeOut, delay }}
        />
      </div>
    </div>
  );
}

/**
 * Entrance animation props that collapse to the settled state when the visitor
 * (or the OS) asks for reduced motion — a fading element also fades its
 * contrast, so the settled state is the accessible one.
 */
function useEntrance(from: Record<string, number>, to: Record<string, number>, transition: object) {
  const reduced = useReducedMotionPref();
  if (reduced) return { initial: to, animate: to, transition: { duration: 0 } };
  return { initial: from, animate: to, transition };
}

function Waveform() {
  const reduced = useReducedMotionPref();
  const bars = Array.from({ length: 22 });
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden>
      {bars.map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-primary/70"
          initial={{ height: 6 }}
          animate={reduced ? { height: 12 } : { height: [6, 8 + ((i * 7) % 22), 6] }}
          transition={{
            duration: 1.1 + (i % 5) * 0.12,
            repeat: reduced ? 0 : Infinity,
            ease: "easeInOut",
            delay: i * 0.045,
          }}
        />
      ))}
    </div>
  );
}

/* --------------------------------- panels --------------------------------- */

const cardBase =
  "glass-panel depth-surface rounded-2xl p-4 will-change-transform";

function ScorePanel() {
  return (
    <div className={`${cardBase} w-full`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
          Resume Intelligence
        </span>
        <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
          Parsed
        </span>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <span className="type-hero leading-none text-foreground">
          <CountUp to={92} duration={1.8} immediate />
        </span>
        <span className="pb-2 text-xs text-muted-foreground">ATS score</span>
      </div>

      <div className="mt-4 space-y-3">
        <Bar label="Keyword coverage" value={88} delay={0.5} />
        <Bar label="Impact language" value={76} delay={0.65} />
        <Bar label="Structure" value={95} delay={0.8} />
      </div>
    </div>
  );
}

const MATCHES = [
  { role: "Product Analyst", company: "Northwind", score: 94 },
  { role: "Data Associate", company: "Helio Labs", score: 88 },
  { role: "Strategy Intern", company: "Meridian", score: 81 },
];

const MatchPanel = forwardRef<HTMLDivElement>(function MatchPanel(_props, ref) {
  const reduced = useReducedMotionPref();
  const entrance = (i: number) =>
    reduced
      ? { initial: { opacity: 1, x: 0 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, x: 14 },
          animate: { opacity: 1, x: 0 },
          transition: { ...springSoft, delay: 0.8 + i * 0.14 },
        };
  return (
    <div ref={ref} className={`${cardBase} w-full`}>
      <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Target className="h-3.5 w-3.5 text-primary" aria-hidden />
        Live job matches
      </span>
      <ul className="mt-3 space-y-2">
        {MATCHES.map((m, i) => (
          <motion.li
            key={m.role}
            {...entrance(i)}
            className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/60 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">{m.role}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{m.company}</span>
            </span>
            <span className="ml-3 shrink-0 text-xs font-semibold tabular-nums text-primary">
              <CountUp to={m.score} duration={1.2} suffix="%" immediate />
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
});

const InterviewPanel = forwardRef<HTMLDivElement>(function InterviewPanel(_props, ref) {
  const caption = useEntrance({ opacity: 0, y: 6 }, { opacity: 1, y: 0 }, { delay: 1.2, duration: 0.6, ease: easeOut });
  return (
    <div ref={ref} className={`${cardBase} w-full`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <Mic className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
          AI mock interview
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-destructive"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Live
        </span>
      </div>
      <Waveform />
      <motion.p
        {...caption}
        className="text-[11px] leading-relaxed text-muted-foreground"
      >
        <span className="text-foreground/80">Interviewer:</span> Walk me through a project where
        you changed the outcome with data.
      </motion.p>
    </div>
  );
});

function InsightChip() {
  return (
    <motion.div
      className="glass-panel flex items-center gap-2 rounded-full px-3 py-2"

      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springSoft, delay: 1.1 }}
    >
      <Sparkles className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
      <span className="text-[11px] font-medium text-foreground">
        3 skills away from Senior Analyst
      </span>
    </motion.div>
  );
}

/* ------------------------------- composition ------------------------------- */

/**
 * The hero product visualization: a stack of live Gradr surfaces floating in
 * depth. The whole composition tilts toward the pointer, and each layer moves
 * at a different rate so it reads as a real 3D command center.
 */
export function HeroCommandCenter() {
  // Depth manager decides how much 3D this device can afford; `off` also
  // covers reduced motion, so both switches flatten the composition.
  const depth = useDepthCapability();
  const spatial = depth === "full";
  const reduced = depth === "off";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useSpring(useMotionValue(0), springPointer);
  const my = useSpring(useMotionValue(0), springPointer);

  const rotateY = useTransform(mx, [-1, 1], [8, -8]);
  const rotateX = useTransform(my, [-1, 1], [-6, 6]);
  // Three parallax depths. Hooks are declared flat so the order never varies.
  const near = {
    x: useTransform(mx, [-1, 1], [-22, 22]),
    y: useTransform(my, [-1, 1], [-13, 13]),
    z: 90,
  };
  const mid = {
    x: useTransform(mx, [-1, 1], [-12, 12]),
    y: useTransform(my, [-1, 1], [-7, 7]),
    z: 55,
  };
  const far = {
    x: useTransform(mx, [-1, 1], [-4, 4]),
    y: useTransform(my, [-1, 1], [-2.5, 2.5]),
    z: 0,
  };
  // Cast shadow follows the tilt so the stack looks physically lit.
  const shadowX = useTransform(mx, [-1, 1], [34, -34]);
  const shadowY = useTransform(my, [-1, 1], [-10, 40]);
  const frameShadow = useMotionTemplate`${shadowX}px ${shadowY}px 90px -40px hsl(var(--foreground) / 0.55)`;

  const frameEntrance = useEntrance(
    { opacity: 0, y: 26, scale: 0.97 },
    { opacity: 1, y: 0, scale: 1 },
    { ...springSoft, delay: 0.15 },
  );
  const noteEntrance = useEntrance({ opacity: 0 }, { opacity: 1 }, { delay: 1.5, duration: 0.6 });
  const panelEntrance = useEntrance(
    { opacity: 0, x: 30, y: 10 },
    { opacity: 1, x: 0, y: 0 },
    { ...springSoft, delay: 0.45 },
  );



  return (
    <div
      ref={ref}
      data-depth-stage={depth}
      data-hero-stage="true"
      className="relative mx-auto w-full max-w-[560px] [perspective:1400px] [perspective-origin:50%_40%]"
      onPointerMove={(e) => {
        if (!spatial || e.pointerType !== "mouse") return;
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
        my.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {/* atmospheric bloom behind the stack */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-primary/12 blur-[80px]"
        animate={reduced ? undefined : { opacity: [0.55, 0.9, 0.55], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        style={spatial ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
        className="relative"
      >
        {/* main frame */}
        <motion.div
          {...frameEntrance}
          style={spatial ? { ...far, boxShadow: frameShadow, transformStyle: "preserve-3d" } : undefined}
          className="depth-surface overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/80 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
              <Bot className="h-3.5 w-3.5 text-primary" aria-hidden />
              CAREER COMMAND CENTER
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Activity className="h-3 w-3 text-success" aria-hidden />
              synced
            </span>
          </div>

          <div className="mt-4 grid gap-3 [transform-style:preserve-3d]">
            <div className="depth-content-sm">
              <ScorePanel />
            </div>
            <div className="depth-content">
              <InterviewPanel />
            </div>
          </div>

          <motion.div
            {...noteEntrance}
            className="mt-3 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-2"
          >
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="text-[11px] text-foreground/85">
              Applied to 4 matched roles this week — 2 moved to interview.
            </span>
          </motion.div>
        </motion.div>

        {/* floating match panel */}
        <motion.div
          className="absolute right-0 -top-16 hidden w-[228px] max-w-[70%] lg:block lg:-right-8"
          {...panelEntrance}
          style={spatial ? near : undefined}
        >
          <motion.div
            animate={reduced ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <MatchPanel />
          </motion.div>
        </motion.div>

        {/* floating insight chip */}
        <motion.div
          className="absolute left-0 -bottom-6 hidden max-w-[70%] lg:block lg:-left-8"
          style={spatial ? mid : undefined}
        >
          <motion.div
            animate={reduced ? undefined : { y: [0, 9, 0] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <InsightChip />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default HeroCommandCenter;
