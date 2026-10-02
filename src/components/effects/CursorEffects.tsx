import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { springPointer, springSnappy } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

const INTERACTIVE = 'a, button, [role="button"], [role="link"], input, select, textarea, summary, [data-cursor="interactive"]';

/**
 * Pointer atmosphere for the marketing surface: a soft ambient halo that trails
 * the cursor, plus a precise ring that snaps to interactive elements.
 *
 * Purely decorative — `pointer-events-none`, hidden from assistive tech, and
 * disabled entirely on touch devices and whenever motion is reduced (the
 * native cursor is never replaced, only accompanied).
 */
export function CursorEffects({ className }: { className?: string }) {
  const reducedMotion = useReducedMotionPref();
  const active = !reducedMotion;
  const [visible, setVisible] = useState(false);
  const [hot, setHot] = useState(false);
  const [pressed, setPressed] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, springSnappy);
  const ringY = useSpring(y, springSnappy);
  const haloX = useSpring(x, springPointer);
  const haloY = useSpring(y, springPointer);

  useEffect(() => {
    if (!active) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
      const target = event.target as Element | null;
      setHot(Boolean(target?.closest?.(INTERACTIVE)));
    };
    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [active, x, y]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-50 hidden md:block", className)}
    >
      {/* Each layer is its own AnimatePresence child — a Fragment cannot hold
          the ref AnimatePresence attaches, which React warns about on every
          pointer move. */}
      <AnimatePresence>
        {visible ? (
          <motion.span
            key="halo"
            className="absolute left-0 top-0 block"
            style={{ x: haloX, y: haloY }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: hot ? 0.9 : 0.55, scale: hot ? 1.15 : 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springPointer}
          >
            <span className="block size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {visible ? (
          <motion.span
            key="ring"
            className="absolute left-0 top-0 block"
            style={{ x: ringX, y: ringY }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: pressed ? 0.7 : hot ? 1.35 : 0.85,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={springSnappy}
          >
            <span className="block size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {visible ? (
          <motion.span
            key="dot"
            className="absolute left-0 top-0 block"
            style={{ x, y }}
            initial={{ opacity: 0 }}
            animate={{ opacity: hot ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={springSnappy}
          >
            <span className="block size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          </motion.span>
        ) : null}
      </AnimatePresence>

    </div>
  );
}
