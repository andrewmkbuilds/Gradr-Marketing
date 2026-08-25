/**
 * Landing scroll progress rail.
 *
 * A spring-smoothed reading rail pinned to the top of the viewport, with tick
 * marks at each section boundary so the progress reads against the page
 * structure as sections move past. Decorative visually; the accessible value
 * is exposed through a single off-screen progressbar so screen readers can
 * query position without being spammed by scroll updates.
 *
 * Reduced motion: the spring is bypassed (the rail tracks scroll directly, no
 * overshoot or settle) — progress stays available, the motion does not.
 */
import { motion, useScroll, useSpring, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";

export function LandingScrollProgress({ sectionIds = [] as string[] }) {
  const reduced = useReducedMotionPref();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.35 });
  const scaleX = reduced ? scrollYProgress : smooth;

  const [ticks, setTicks] = useState<number[]>([]);
  const [percent, setPercent] = useState(0);
  const raf = useRef(0);

  // Section boundaries as a fraction of total scrollable distance.
  useEffect(() => {
    if (sectionIds.length === 0) return;
    const measure = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) return setTicks([]);
      setTicks(
        sectionIds
          .map((id) => document.getElementById(id))
          .filter((el): el is HTMLElement => Boolean(el))
          .map((el) => Math.min(1, Math.max(0, (el.offsetTop - 72) / total))),
      );
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    const t = window.setTimeout(measure, 600);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, [sectionIds]);

  // Coarse value for assistive tech — updated at most once per frame, in 5% steps.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const next = Math.round(v * 20) * 5;
      setPercent((prev) => (prev === next ? prev : next));
    });
  });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px">
        <motion.div
          className="h-px w-full origin-left bg-gradient-to-r from-primary via-brand-glow to-brand-secondary"
          style={{ scaleX }}
        />
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute top-0 h-px w-3 -translate-x-1/2 bg-border"
            style={{ left: `${t * 100}%` }}
          />
        ))}
      </div>
      <div
        className="sr-only"
        role="progressbar"
        aria-label="Page scroll progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% of the page scrolled`}
      />
    </>
  );
}

export default LandingScrollProgress;
