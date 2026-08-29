import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "field-motion flex min-h-[96px] w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 aria-[invalid=true]:border-destructive/70 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
