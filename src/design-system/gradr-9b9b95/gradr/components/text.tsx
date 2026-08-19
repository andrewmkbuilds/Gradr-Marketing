import { forwardRef, type ElementType, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const textVariants = cva("", {
  variants: {
    variant: {
      h1: "font-display text-h1 text-foreground",
      h2: "font-display text-h2 text-foreground",
      h3: "font-display text-h3 text-foreground",
      h4: "font-display text-h4 text-foreground",
      h5: "font-display text-h5 text-foreground",
      h6: "font-display text-h6 text-foreground",
      lead: "font-sans text-body-lg text-muted-foreground",
      body: "font-sans text-body text-foreground",
      "body-sm": "font-sans text-body-sm text-foreground",
      caption: "font-sans text-caption text-muted-foreground",
      overline: "font-sans text-overline uppercase text-muted-foreground",
      button: "font-sans text-button text-foreground",
      code: "font-mono text-code text-foreground",
    },
    tone: {
      default: "",
      muted: "text-muted-foreground",
      primary: "text-primary",
      accent: "text-accent",
      destructive: "text-destructive",
    },
  },
  defaultVariants: { variant: "body", tone: "default" },
});

/** Default element for each role, so the semantic tag follows the style. */
const defaultTag: Record<string, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  lead: "p",
  body: "p",
  "body-sm": "p",
  caption: "p",
  overline: "p",
  button: "span",
  code: "code",
};

export interface TextProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  /** Override the rendered element when the heading level and the visual
   *  scale need to differ (keep the document outline correct). */
  as?: ElementType;
}

export const Text = forwardRef<HTMLElement, TextProps>(
  ({ className, variant, tone, as, ...props }, ref) => {
    const Comp = (as ?? defaultTag[variant ?? "body"] ?? "p") as ElementType;
    return (
      <Comp ref={ref} className={cn(textVariants({ variant, tone }), className)} {...props} />
    );
  },
);
Text.displayName = "Text";

export { textVariants };