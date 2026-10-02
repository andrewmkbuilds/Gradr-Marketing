/**
 * TiltCard — a physical 3D card that tilts toward the cursor with spring
 * physics, casts a dynamic shadow that shifts with the tilt direction, and
 * carries a cursor-tracking radial highlight. Internal elements can parallax
 * at different depths via the `TiltLayer` companion.
 *
 * Falls back to a plain bordered card on touch devices and reduced motion.
 */
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { forwardRef, useRef, type CSSProperties, type ReactNode } from "react";
import { useSpatialPointer } from "@/hooks/useDepthCapability";
import { springPointer } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

export interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees at the edges. */
  maxTilt?: number;
  /** Shadow intensity: sm = subtle, md = floating, lg = elevated, hero = atmospheric. */
  shadow?: "sm" | "md" | "lg" | "hero";
  /** Glass surface instead of solid. */
  glass?: boolean;
  /** Cursor-tracking radial highlight. */
  spotlight?: boolean;
  /** Border glow that tracks the cursor. */
  borderGlow?: boolean;
  /** Reflection sweep on hover. */
  reflection?: boolean;
  /** Inner content depth in px (translateZ). */
  contentDepth?: number;
  style?: CSSProperties;
  as?: "div" | "article" | "li";
}

const SHADOW_CLASS: Record<NonNullable<TiltCardProps["shadow"]>, string> = {
  sm: "shadow-3d-sm",
  md: "shadow-3d-md",
  lg: "shadow-3d-lg",
  hero: "shadow-3d-hero",
};

export const TiltCard = forwardRef<HTMLElement, TiltCardProps>(
  (
    {
      children,
      className,
      maxTilt = 8,
      shadow = "md",
      glass = false,
      spotlight = true,
      borderGlow = true,
      reflection = false,
      contentDepth = 32,
      style,
      as = "div",
    },
    _forwardedRef,
  ) => {
    const active = useSpatialPointer();
    const ref = useRef<HTMLElement | null>(null);

    // Normalised pointer position [-1, 1]
    const px = useMotionValue(0);
    const py = useMotionValue(0);

    // Spring-smoothed tilt
    const rx = useSpring(useMotionValue(0), springPointer);
    const ry = useSpring(useMotionValue(0), springPointer);

    // Cursor position for spotlight (px)
    const mx = useMotionValue(-9999);
    const my = useMotionValue(-9999);

    // Dynamic shadow offset that follows the tilt
    const shadowX = useTransform(ry, [-maxTilt, maxTilt], [20, -20]);
    const shadowY = useTransform(rx, [-maxTilt, maxTilt], [-6, 24]);
    const dynamicShadow = useMotionTemplate`${shadowX}px ${shadowY}px 40px -12px hsl(var(--foreground) / 0.25)`;

    // Spotlight gradient
    const spotlightBg = useMotionTemplate`radial-gradient(280px circle at ${mx}px ${my}px, hsl(var(--primary) / 0.14), transparent 65%)`;
    const edgeBg = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, hsl(var(--primary) / 0.5), transparent 60%)`;

    const Tag = motion[as] as typeof motion.div;

    // Fallback: plain card
    if (!active) {
      const Plain = as;
      return (
        <Plain
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border",
            glass ? "glass-3d" : "bg-card",
            SHADOW_CLASS[shadow],
            className,
          )}
          style={style}
        >
          {children}
        </Plain>
      );
    }

    return (
      <Tag
        ref={(node: HTMLElement | null) => {
          ref.current = node;
        }}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border",
          glass ? "glass-3d" : "bg-card",
          reflection && "reflection-sweep",
          className,
        )}
        style={{
          ...style,
          rotateX: rx,
          rotateY: ry,
          transformPerspective: 1000,
          transformStyle: "preserve-3d",
          boxShadow: dynamicShadow,
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          px.set(nx);
          py.set(ny);
          ry.set(nx * maxTilt);
          rx.set(-ny * maxTilt * 0.8);
          mx.set(e.clientX - rect.left);
          my.set(e.clientY - rect.top);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
          rx.set(0);
          ry.set(0);
          mx.set(-9999);
          my.set(-9999);
        }}
      >
        {/* Cursor-tracking spotlight */}
        {spotlight && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: spotlightBg }}
          />
        )}

        {/* Border glow */}
        {borderGlow && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: edgeBg,
              WebkitMask:
                "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              padding: 1,
            }}
          />
        )}

        {/* Content lifted forward in 3D space */}
        <span
          className="relative block"
          style={{ transform: `translateZ(${contentDepth}px)`, transformStyle: "preserve-3d" }}
        >
          {children}
        </span>
      </Tag>
    );
  },
);
TiltCard.displayName = "TiltCard";

/**
 * A layer inside a TiltCard that sits at a different Z depth for internal
 * parallax. Use sparingly — one or two per card.
 */
export function TiltLayer({
  children,
  className,
  depth = 16,
}: {
  children: ReactNode;
  className?: string;
  depth?: number;
}) {
  return (
    <span
      className={cn("relative block", className)}
      style={{ transform: `translateZ(${depth}px)`, transformStyle: "preserve-3d" }}
    >
      {children}
    </span>
  );
}
