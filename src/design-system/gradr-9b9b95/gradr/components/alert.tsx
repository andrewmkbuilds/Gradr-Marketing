import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const alertVariants = cva("rounded-card border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-surface-muted text-foreground",
      primary: "border-primary/30 bg-primary/10 text-foreground",
      danger: "border-destructive/40 bg-destructive/10 text-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, children, ...props }, ref) => (
    <div role="status" ref={ref} className={cn(alertVariants({ variant }), className)} {...props}>
      {title ? <p className="font-display font-semibold">{title}</p> : null}
      {children ? <div className="text-muted-foreground">{children}</div> : null}
    </div>
  ),
);
Alert.displayName = "Alert";

export { alertVariants };