import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";

/**
 * The custom cursor should appear on any device with a fine pointer (mouse or
 * trackpad) that hasn't opted into reduced motion. Unlike the 3D depth system
 * (which gates on CPU cores and memory), the cursor is lightweight enough to
 * run everywhere a mouse exists.
 */
function useCursorEnabled(): boolean {
  const reduced = useReducedMotionPref();
  const [finePointer, setFinePointer] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(pointer: fine)")?.matches ?? false;
  });

  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: fine)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return finePointer && !reduced;
}

/**
 * Selectors that trigger the "interactive" cursor state (ring expands, dot
 * fades). Covers semantic elements plus the premium utility classes.
 */
const INTERACTIVE =
  'a, button, [role="button"], [role="link"], summary, [data-cursor="interactive"], .card-glow, .btn-glow, .glow-ring, label[for], [tabindex]:not([tabindex="-1"])';

/**
 * Elements where the native text cursor should be restored and the custom
 * cursor hidden entirely, so users get the expected I-beam for editing.
 */
const TEXT_FIELDS =
  'input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="url"], input[type="tel"], input[type="number"], input:not([type]), textarea, [contenteditable="true"], [contenteditable=""]';

function isText(el: Element | null): boolean {
  return Boolean(el?.closest?.(TEXT_FIELDS));
}

function isHot(el: Element | null): boolean {
  return Boolean(el?.closest?.(INTERACTIVE));
}

/**
 * Premium custom cursor: a precise dot that tracks the pointer exactly, plus
 * an outer ring that lags behind with spring physics for an organic feel.
 *
 * - **Hover** over interactive elements → ring expands, dot fades.
 * - **Text fields** → custom cursor hides, native I-beam restored.
 * - **Click** → ring compresses + a subtle ripple expands and fades.
 * - **Touch / reduced motion** → disabled entirely; native cursor untouched.
 *
 * Purely decorative — `pointer-events-none`, `aria-hidden`, and never
 * interferes with clicking, scrolling, selection, or drag-and-drop.
 */
export function CursorEffects({ className }: { className?: string }) {
  const active = useCursorEnabled();
  const [visible, setVisible] = useState(false);
  const [hot, setHot] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = useRef(0);

  // Dot follows the pointer with zero lag; ring trails with spring physics.
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 350, damping: 32, mass: 0.4 });
  const ringY = useSpring(y, { stiffness: 350, damping: 32, mass: 0.4 });

  // Toggle the CSS class that hides the native cursor.
  useEffect(() => {
    const html = document.documentElement;
    if (active) html.classList.add("cc-active");
    else html.classList.remove("cc-active", "cc-text");
    return () => html.classList.remove("cc-active", "cc-text");
  }, [active]);

  // Toggle text mode to restore the native I-beam on form fields.
  useEffect(() => {
    document.documentElement.classList.toggle("cc-text", textMode);
  }, [textMode]);

  useEffect(() => {
    if (!active) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      const el = e.target as Element | null;
      const text = isText(el);
      setTextMode(text);
      setHot(text ? false : isHot(el));
    };
    const onLeave = () => setVisible(false);
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setPressed(true);
      const id = ++rippleId.current;
      setRipples((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 500);
    };
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

  const showCursor = visible && !textMode;

  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 z-[10000]", className)}>
      {/* Click ripples — thin ring expands and fades from the click point */}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="absolute left-0 top-0"
          style={{ x: r.x, y: r.y }}
          initial={{ opacity: 0.35, scale: 0 }}
          animate={{ opacity: 0, scale: 4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span className="block h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40" />
        </motion.span>
      ))}

      {/* Outer ring — lags behind the dot with spring physics, subtle glow */}
      <motion.span
        className="absolute left-0 top-0"
        style={{ x: ringX, y: ringY }}
        animate={{
          opacity: showCursor ? 1 : 0,
          scale: pressed ? 0.7 : hot ? 1.4 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <span
          className="block h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/50"
          style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.15)" }}
        />
      </motion.span>

      {/* Inner dot — tracks the pointer exactly, hides on interactive hover */}
      <motion.span
        className="absolute left-0 top-0"
        style={{ x, y }}
        animate={{
          opacity: showCursor ? (hot ? 0 : 1) : 0,
          scale: pressed ? 0.5 : 1,
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <span className="block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      </motion.span>
    </div>
  );
}
