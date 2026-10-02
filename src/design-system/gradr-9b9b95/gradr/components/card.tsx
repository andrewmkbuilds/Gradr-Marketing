import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const cardVariants = cva(
  "relative rounded-card bg-surface text-foreground transition-all duration-300",
  {
    variants: {
      variant: {
        outline: "border border-border",
        raised: "border border-border shadow-raise hover:shadow-float hover:border-primary/20 hover:-translate-y-0.5",
        float: "shadow-float hover:shadow-float hover:-translate-y-0.5",
        premium:
          "border border-border/80 shadow-raise hover:shadow-float hover:-translate-y-1 hover:border-primary/25",
      },
      padding: { none: "p-0", md: "p-5", lg: "p-8" },
    },
    defaultVariants: { variant: "outline", padding: "md" },
  },
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-lg font-semibold", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export { cardVariants };
