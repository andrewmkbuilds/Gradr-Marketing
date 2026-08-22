import { motion } from "motion/react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";

export type SceneVariant = "aurora" | "beams" | "rays" | "dots" | "gridscan" | "threads";

export interface SceneBackgroundProps {
  variant?: SceneVariant;
  className?: string;
  /** 0–1 overall strength. Keep low enough that body copy stays high contrast. */
  intensity?: number;
  /** Fades the bottom edge into the page background for seamless section handoff. */
  fadeBottom?: boolean;
}

/**
 * Section atmosphere. One variant per section, never stacked — every layer is
 * transform/opacity only (no canvas, no WebGL, no per-frame JS), so the whole
 * set stays cheap on mobile and disappears under reduced motion.
 */
export function SceneBackground({
  variant = "aurora",
  className,
  intensity = 0.5,
  fadeBottom = true,
}: SceneBackgroundProps) {
  const reduced = useReducedMotionPref();
  const o = Math.max(0, Math.min(1, intensity));

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
      style={{ opacity: 0.35 + o * 0.65 }}
    >
      {variant === "aurora" && (
        <>
          <motion.div
            className="absolute -left-1/4 top-[-30%] h-[46rem] w-[46rem] rounded-full bg-primary/15 blur-[150px]"
            animate={reduced ? undefined : { x: [0, 70, 0], y: [0, 40, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-1/4 top-[10%] h-[34rem] w-[34rem] rounded-full bg-brand-secondary/12 blur-[160px]"
            animate={reduced ? undefined : { x: [0, -60, 0], y: [0, 50, 0] }}
            transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {variant === "beams" && (
        <div className="absolute inset-0">
          {[18, 38, 58, 78].map((left, i) => (
            <motion.span
              key={left}
              className="absolute top-[-20%] h-[140%] w-px bg-gradient-to-b from-transparent via-primary/25 to-transparent"
              style={{ left: `${left}%`, rotate: "8deg" }}
              animate={reduced ? undefined : { opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 7 + i * 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
            />
          ))}
        </div>
      )}

      {variant === "rays" && (
        <div
          className="absolute inset-x-0 top-0 h-[60%]"
          style={{
            background:
              "conic-gradient(from 180deg at 50% -10%, transparent 0deg, hsl(var(--primary) / 0.14) 20deg, transparent 40deg, hsl(var(--brand-secondary) / 0.10) 62deg, transparent 90deg)",
            maskImage: "radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)", // theme-token-ok
            WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)", // theme-token-ok
          }}
        />
      )}

      {variant === "dots" && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.16) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse at 50% 30%, #000, transparent 72%)", // theme-token-ok
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, #000, transparent 72%)", // theme-token-ok
          }}
        />
      )}

      {variant === "gridscan" && (
        <>
          <div className="absolute inset-0 grid-lines opacity-40" />
          {!reduced && (
            <motion.div
              className="absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-primary/10 to-transparent"
              animate={{ y: ["-20%", "120%"] }}
              transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
            />
          )}
        </>
      )}

      {variant === "threads" && (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {[22, 40, 58, 76].map((y, i) => (
            <motion.path
              key={y}
              d={`M0 ${y} C 25 ${y - 8}, 50 ${y + 9}, 75 ${y - 5} S 100 ${y + 4}, 100 ${y}`}
              fill="none"
              stroke="hsl(var(--primary) / 0.22)"
              strokeWidth={0.22}
              vectorEffect="non-scaling-stroke"
              animate={reduced ? undefined : { opacity: [0.25, 0.65, 0.25] }}
              transition={{ duration: 9 + i * 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
            />
          ))}
        </svg>
      )}

      {fadeBottom && <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />}
    </div>
  );
}

export default SceneBackground;
