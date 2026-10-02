/**
 * SpatialLoader — branded 3D loading experience. A morphing geometric shape
 * that rotates in 3D space with a brand-colored gradient. Replaces generic
 * spinners with something that feels like part of the product's visual
 * language.
 *
 * Falls back to a simple pulse under reduced motion.
 */
import { motion } from "motion/react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";

export interface SpatialLoaderProps {
  className?: string;
  size?: number;
  label?: string;
}

export function SpatialLoader({ className, size = 48, label }: SpatialLoaderProps) {
  const reduced = useReducedMotionPref();

  if (reduced) {
    return (
      <div className={cn("flex items-center gap-3", className)} role="status" aria-label={label ?? "Loading"}>
        <span
          className="animate-pulse rounded-full bg-primary/20"
          style={{ width: size, height: size }}
        />
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <div
        className="relative [perspective:200px]"
        style={{ width: size, height: size }}
      >
        <motion.div
          className="absolute inset-0 [transform-style:preserve-3d]"
          animate={{
            rotateX: [0, 180, 360],
            rotateY: [0, 180, 360],
            rotateZ: [0, 90, 180],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Outer ring */}
          <motion.span
            className="absolute inset-0 rounded-xl border-2 border-primary/30"
            style={{ transform: "rotateX(60deg)" }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Inner ring */}
          <motion.span
            className="absolute inset-2 rounded-lg border-2 border-brand-secondary/40"
            style={{ transform: "rotateY(60deg)" }}
            animate={{ opacity: [0.8, 0.3, 0.8] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          {/* Core dot */}
          <motion.span
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

/** Full-screen branded loading overlay. */
export function SpatialLoaderOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <SpatialLoader size={56} label={label} />
    </div>
  );
}
