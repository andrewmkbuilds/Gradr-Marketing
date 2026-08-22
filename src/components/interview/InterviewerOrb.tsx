import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { springSmooth, springSoft } from "@/lib/motion/tokens";

export type InterviewerState = "connecting" | "speaking" | "listening" | "thinking" | "idle";

const STATE_COPY: Record<InterviewerState, string> = {
  connecting: "Connecting",
  speaking: "Speaking",
  listening: "Listening",
  thinking: "Thinking",
  idle: "Ready",
};

/** Per-state visual tuning: halo intensity, core scale, ring speed. */
const STATE_TUNING: Record<InterviewerState, { halo: number; scale: number; spin: number }> = {
  speaking: { halo: 0.85, scale: 1.04, spin: 9 },
  listening: { halo: 0.5, scale: 1.01, spin: 16 },
  thinking: { halo: 0.35, scale: 0.99, spin: 6 },
  connecting: { halo: 0.25, scale: 0.97, spin: 24 },
  idle: { halo: 0.22, scale: 1, spin: 30 },
};

/** Bar heights (0–1) per state, sampled to read like a real voice envelope. */
const ENVELOPE: Record<InterviewerState, number[]> = {
  speaking: [0.42, 0.78, 1, 0.66, 0.36],
  listening: [0.22, 0.34, 0.28, 0.4, 0.24],
  thinking: [0.16, 0.24, 0.34, 0.24, 0.16],
  connecting: [0.14, 0.14, 0.14, 0.14, 0.14],
  idle: [0.14, 0.18, 0.16, 0.18, 0.14],
};

interface Props {
  state: InterviewerState;
  name?: string;
  className?: string;
}

/**
 * Interviewer presence orb — the visual anchor of the interview studio.
 *
 * A layered, spring-driven presence: an atmospheric halo, a slowly rotating
 * conic aperture, a breathing core and a live voice envelope. Every loop is a
 * GPU transform or opacity, and all of it collapses to a static, colour-and-
 * label-legible state under `prefers-reduced-motion`.
 */
export function InterviewerOrb({ state, name = "AI Interviewer", className }: Props) {
  const reduced = useReducedMotionPref();
  const tuning = STATE_TUNING[state];
  const bars = ENVELOPE[state];
  const active = state === "speaking" || state === "listening";

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60" aria-hidden="true">
        {/* Atmospheric halo */}
        <motion.div
          className="absolute inset-4 rounded-full bg-primary blur-[42px]"
          animate={{ opacity: tuning.halo * 0.55, scale: reduced ? 1 : tuning.scale }}
          transition={springSoft}
        />

        {/* Rotating aperture — a thin conic sweep, not a glow */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)/0.55) 60deg, transparent 140deg, transparent 220deg, hsl(var(--brand-secondary,var(--primary))/0.35) 280deg, transparent 340deg)",
            maskImage: "radial-gradient(circle, transparent 61%, #000 62%, #000 66%, transparent 67%)", // theme-token-ok
            WebkitMaskImage:
              "radial-gradient(circle, transparent 61%, #000 62%, #000 66%, transparent 67%)", // theme-token-ok
          }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: tuning.spin, ease: "linear", repeat: Infinity }}
        />

        {/* Presence pulse — one clean expanding ring while the AI holds the floor */}
        {active && !reduced && (
          <motion.span
            className="absolute rounded-full border border-primary/40"
            style={{ height: "58%", width: "58%" }}
            animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
            transition={{ duration: state === "speaking" ? 1.9 : 2.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        {/* Static ring for structure */}
        <div className="absolute h-[58%] w-[58%] rounded-full border border-border/70" />

        {/* Core */}
        <motion.div
          className={cn(
            "relative flex h-[46%] w-[46%] items-center justify-center rounded-full border backdrop-blur-sm",
            "bg-[radial-gradient(circle_at_32%_24%,hsl(var(--primary)/0.38),hsl(var(--card))_72%)]",
            state === "speaking" ? "border-primary/70" : active ? "border-primary/40" : "border-border",
          )}
          animate={{
            scale: reduced ? 1 : tuning.scale,
            boxShadow:
              state === "speaking"
                ? "0 0 60px -14px hsl(var(--primary) / 0.85)"
                : "0 0 30px -18px hsl(var(--primary) / 0.5)",
          }}
          transition={springSmooth}
        >
          {/* Voice envelope */}
          <div className="flex h-10 items-end gap-1.5">
            {bars.map((h, i) => (
              <motion.span
                key={i}
                className="w-1.5 rounded-full bg-primary"
                style={{ transformOrigin: "bottom" }}
                animate={
                  reduced || !active
                    ? { height: `${h * 100}%`, opacity: active ? 1 : 0.45 }
                    : {
                        height: [`${h * 44}%`, `${h * 100}%`, `${h * 58}%`],
                        opacity: 1,
                      }
                }
                transition={
                  reduced || !active
                    ? springSmooth
                    : {
                        duration: state === "speaking" ? 0.72 : 1.4,
                        repeat: Infinity,
                        repeatType: "mirror",
                        ease: "easeInOut",
                        delay: i * 0.09,
                      }
                }
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="text-center">
        <p className="font-display text-sm font-semibold tracking-tight text-foreground">{name}</p>
        <p
          className={cn(
            "mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
            active ? "text-primary" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {STATE_COPY[state]}
          {state === "thinking" && <span className="motion-safe:animate-pulse">…</span>}
        </p>
      </div>
    </div>
  );
}
