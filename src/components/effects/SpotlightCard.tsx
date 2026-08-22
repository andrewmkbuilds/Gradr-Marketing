import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useSpatialPointer } from "@/hooks/useDepthCapability";
import { springPointer } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Adds a conic border highlight that tracks the cursor. */
  borderGlow?: boolean;
  /** Slight 3D tilt toward the pointer. Keep off for dense grids. */
  tilt?: boolean;
  /** Spotlight radius in pixels. */
  radius?: number;
  as?: "div" | "li" | "article";
}

/**
 * Surface that lights up under the cursor: a soft radial spotlight, an
 * optional tracking border highlight and a restrained tilt. Pointer work is
 * skipped entirely on touch, low-power devices and reduced motion, where the
 * card degrades to a normal bordered panel.
 */
export function SpotlightCard({
  children,
  className,
  borderGlow = true,
  tilt = false,
  radius = 320,
  as = "div",
}: SpotlightCardProps) {
  const active = useSpatialPointer();
  const ref = useRef<HTMLElement | null>(null);

  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);
  const opacity = useMotionValue(0);
  const rx = useSpring(useMotionValue(0), springPointer);
  const ry = useSpring(useMotionValue(0), springPointer);

  const spotlight = useMotionTemplate`radial-gradient(${radius}px circle at ${mx}px ${my}px, hsl(var(--primary) / 0.16), transparent 70%)`;
  const edge = useMotionTemplate`radial-gradient(${radius * 0.9}px circle at ${mx}px ${my}px, hsl(var(--primary) / 0.55), transparent 65%)`;

  const Tag = motion[as] as typeof motion.div;

  if (!active) {
    const Plain = as;
    return (
      <Plain className={cn("depth-surface depth-hover relative overflow-hidden rounded-2xl border border-border bg-card", className)}>
        {children}
      </Plain>
    );
  }

  return (
    <Tag
      ref={(node: HTMLDivElement | null) => { ref.current = node; }}
      className={cn(
        "depth-surface group relative overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
      style={{ rotateX: tilt ? rx : undefined, rotateY: tilt ? ry : undefined, transformPerspective: 1000 }}
      whileHover={{ y: -3 }}
      transition={springPointer}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        mx.set(px);
        my.set(py);
        opacity.set(1);
        if (tilt) {
          ry.set(((px / rect.width) * 2 - 1) * 5);
          rx.set(-((py / rect.height) * 2 - 1) * 5);
        }
      }}
      onPointerLeave={() => {
        opacity.set(0);
        rx.set(0);
        ry.set(0);
      }}
    >
      {borderGlow && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: edge,
            WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)", // theme-token-ok
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: 1,
          }}
        />
      )}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: spotlight, opacity }}
      />
      <span className="relative block">{children}</span>
    </Tag>
  );
}

export default SpotlightCard;
