import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  ),
);
Label.displayName = "Label";