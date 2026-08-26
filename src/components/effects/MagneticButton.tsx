import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { forwardRef, useRef, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/design-system/gradr-9b9b95";
import { useSpatialPointer } from "@/hooks/useDepthCapability";
import { springPointer, springSnappy } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

export interface MagneticButtonProps extends Omit<ButtonProps, "asChild"> {
  children: ReactNode;
  /** Max pixels the button drifts toward the cursor. */
  strength?: number;
  /** Adds a specular highlight that follows the pointer across the surface. */
  specular?: boolean;
}

/**
 * Primary CTA treatment: magnetic drift toward the cursor, a specular
 * highlight that tracks the pointer, and a spring press. Falls back to a
 * plain button on touch and reduced motion.
 */
export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ children, className, strength = 9, specular = true, ...props }, forwardedRef) => {
    const active = useSpatialPointer();
    const wrapRef = useRef<HTMLSpanElement>(null);

    const x = useSpring(useMotionValue(0), springPointer);
    const y = useSpring(useMotionValue(0), springPointer);
    const gx = useMotionValue(50);
    const gy = useMotionValue(50);
    const sheen = useMotionTemplate`radial-gradient(120px circle at ${gx}% ${gy}%, hsl(0 0% 100% / 0.22), transparent 65%)`; // theme-token-ok

    const button = (
      <Button
        ref={forwardedRef}
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        {specular && active && (
          <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: sheen }} />
        )}
        <span className="relative inline-flex items-center">{children}</span>
      </Button>
    );

    if (!active) return button;

    return (
      <motion.span
        ref={wrapRef}
        className="inline-block"
        style={{ x, y }}
        whileTap={{ scale: 0.97 }}
        transition={springSnappy}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
          const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
          x.set(Math.max(-1, Math.min(1, dx)) * strength);
          y.set(Math.max(-1, Math.min(1, dy)) * strength);
          gx.set(((e.clientX - rect.left) / rect.width) * 100);
          gy.set(((e.clientY - rect.top) / rect.height) * 100);
        }}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {button}
      </motion.span>
    );
  },
);
MagneticButton.displayName = "MagneticButton";

export default MagneticButton;
