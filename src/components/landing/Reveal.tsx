/**
 * Landing reveal — scroll-linked float.
 *
 * Same API as the shared `Reveal` primitive, but instead of firing once the
 * content is tied to the scroll position: it drifts in and settles into place
 * as its own box crosses the viewport, then holds. Collapses to a plain static
 * element when the user prefers reduced motion.
 */
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useRef, type ElementType } from "react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import type { RevealProps } from "@/components/motion/Reveal";

export type { RevealProps } from "@/components/motion/Reveal";

const offset: Record<NonNullable<RevealProps["direction"]>, { x: number; y: number }> = {
  up: { x: 0, y: 34 },
  down: { x: 0, y: -34 },
  left: { x: 34, y: 0 },
  right: { x: -34, y: 0 },
  none: { x: 0, y: 0 },
};

export function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  as = "div",
  lift = false,
}: RevealProps) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);
  const Tag = motion.create(as as ElementType);

  // Later "delay" values simply settle a little further up the scroll pass,
  // which reads as a stagger while staying fully scroll-linked.
  const stagger = Math.min(delay / 1000, 0.25);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 94%", `start ${Math.round(52 - stagger * 30)}%`],
  });
  const eased = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.7 });

  const from = offset[direction];
  const y = useTransform(eased, [0, 1], [from.y, 0]);
  const x = useTransform(eased, [0, 1], [from.x, 0]);
  const scale = useTransform(eased, [0, 1], [lift ? 0.975 : 1, 1]);
  const opacity = useTransform(eased, [0, 0.55], [0, 1]);

  if (reduced) {
    return (
      <Tag ref={ref} className={className}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={className}
      style={{ x, y, scale, opacity } as { x: MotionValue<number> }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
