/**
 * ParallaxLayers — multi-layer parallax for section backgrounds. Creates
 * cinematic depth by moving background, midground, and foreground layers at
 * different speeds as the user scrolls.
 *
 * Each layer is a slot that moves at a different rate. All movement is
 * transform-only (GPU) and collapses under reduced motion.
 */
import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";

export interface ParallaxLayersProps {
  /** Background layer — moves slowest. */
  background?: ReactNode;
  /** Midground layer — moves at medium speed. */
  midground?: ReactNode;
  /** Foreground content — moves at normal speed (slight parallax). */
  children?: ReactNode;
  className?: string;
  /** Background parallax distance in px. */
  bgDistance?: number;
  /** Midground parallax distance in px. */
  midDistance?: number;
}

export function ParallaxLayers({
  background,
  midground,
  children,
  className,
  bgDistance = 80,
  midDistance = 40,
}: ParallaxLayersProps) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [bgDistance, -bgDistance]);
  const midY = useTransform(scrollYProgress, [0, 1], [midDistance, -midDistance]);
  const fgY = useTransform(scrollYProgress, [0, 1], [12, -12]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Background layer */}
      {background && (
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10"
          style={reduced ? undefined : { y: bgY }}
        >
          {background}
        </motion.div>
      )}

      {/* Midground layer */}
      {midground && (
        <motion.div
          className="pointer-events-none absolute inset-0 -z-[5]"
          style={reduced ? undefined : { y: midY }}
        >
          {midground}
        </motion.div>
      )}

      {/* Foreground content */}
      <motion.div style={reduced ? undefined : { y: fgY }}>{children}</motion.div>
    </div>
  );
}
