/**
 * Glass3D — enhanced glass surface with multi-layer transparency, inner
 * highlight, outer reflection, and depth shadow. Sits inside the 3D
 * environment with a consistent key light from the top-left.
 *
 * Use for floating panels, navigation bars, and overlay surfaces where
 * glass is appropriate. Do NOT make everything glass — create hierarchy
 * between solid, glass, and floating surfaces.
 */
import { type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface Glass3DProps {
  children: ReactNode;
  className?: string;
  /** Shadow intensity. */
  shadow?: "sm" | "md" | "lg" | "hero";
  /** Add a rim light along the top edge. */
  rimLight?: boolean;
  /** Add a key light from the top-left. */
  keyLight?: boolean;
  /** Add a reflection sweep on hover. */
  reflection?: boolean;
  style?: CSSProperties;
}

const SHADOW_CLASS = {
  sm: "shadow-3d-glass",
  md: "shadow-3d-md",
  lg: "shadow-3d-lg",
  hero: "shadow-3d-hero",
} as const;

export function Glass3D({
  children,
  className,
  shadow = "md",
  rimLight = true,
  keyLight = true,
  reflection = false,
  style,
}: Glass3DProps) {
  return (
    <div
      className={cn(
        "glass-3d relative rounded-2xl",
        SHADOW_CLASS[shadow],
        rimLight && "light-rim",
        keyLight && "light-key",
        reflection && "reflection-sweep",
        className,
      )}
      style={style}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
