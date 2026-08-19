import { forwardRef, useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";

export interface FormFieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  invalid: boolean;
  required: boolean | undefined;
}

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode;
  /** Guidance shown under the control; hidden while an error is present. */
  help?: ReactNode;
  /** Error message. Its presence puts the field in the invalid state. */
  error?: ReactNode;
  required?: boolean;
  /** Render the control with the wiring this field owns (id, aria, state). */
  children: (control: FormFieldControlProps) => ReactNode;
}

/**
 * Wires a Label, a control (Input / Textarea / any control accepting the
 * same props), help text, and an error message into one accessible group.
 */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, help, error, required, children, ...props }, ref) => {
    const id = useId();
    const helpId = `${id}-help`;
    const errorId = `${id}-error`;
    const invalid = Boolean(error);
    const describedBy = invalid ? errorId : help ? helpId : undefined;

    return (
      <div ref={ref} className={cn("space-y-1.5", className)} {...props}>
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        {children({ id, "aria-describedby": describedBy, invalid, required })}
        {invalid ? (
          <p id={errorId} role="alert" className="text-caption text-destructive">
            {error}
          </p>
        ) : help ? (
          <p id={helpId} className="text-caption text-muted-foreground">
            {help}
          </p>
        ) : null}
      </div>
    );
  },
);
FormField.displayName = "FormField";