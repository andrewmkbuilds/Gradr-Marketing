import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { useSpatialPointer } from "@/hooks/useDepthCapability";
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
  const active = useSpatialPointer();
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
      <AnimatePresence>
        {visible ? (
          <>
            <motion.span
              key="halo"
              className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
              style={{ x: haloX, y: haloY }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: hot ? 0.9 : 0.55, scale: hot ? 1.15 : 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springPointer}
            />
            <motion.span
              key="ring"
              className="absolute -left-5 -top-5 h-10 w-10 rounded-full border border-primary/60 mix-blend-normal"
              style={{ x: ringX, y: ringY }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: 1,
                scale: pressed ? 0.7 : hot ? 1.35 : 0.85,
                borderColor: hot ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)",
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={springSnappy}
            />
            <motion.span
              key="dot"
              className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full bg-primary"
              style={{ x, y }}
              initial={{ opacity: 0 }}
              animate={{ opacity: hot ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={springSnappy}
            />
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
