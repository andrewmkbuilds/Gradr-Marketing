/**
 * DimensionalText — 3D typography for hero headlines and major section
 * headings. Combines layered text-shadows (extrusion), a gradient lighting
 * overlay, and an optional perspective transform so the text reads as a
 * physical object in the 3D environment.
 *
 * Collapses to flat text under reduced motion. Reserved for display type —
 * never use for body copy (the shadows reduce contrast at small sizes).
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DimensionalTextProps {
  children: ReactNode;
  className?: string;
  /** Visual depth: "subtle" for section headings, "strong" for hero. */
  depth?: "subtle" | "strong" | "glow";
  /** Subtle perspective tilt on the text block. */
  perspective?: boolean;
  /** Animate in with a spatial entrance. */
  animate?: boolean;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
}

export function DimensionalText({
  children,
  className,
  depth = "subtle",
  perspective = false,
  animate = true,
  as: Tag = "span",
}: DimensionalTextProps) {
  const depthClass =
    depth === "strong"
      ? "text-extrude"
      : depth === "glow"
        ? "text-3d-glow"
        : "text-dimensional";

  const style = perspective
    ? ({ transformStyle: "preserve-3d" as const, transform: "perspective(800px) rotateX(2deg)" })
    : undefined;

  return (
    <Tag
      className={cn(depthClass, animate && "spatial-in", perspective && "[transform-style:preserve-3d]", className)}
      style={style}
    >
      {children}
    </Tag>
  );
}
