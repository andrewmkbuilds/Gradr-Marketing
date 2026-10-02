import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/70",
        "hover:border-border-strong",
        "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
