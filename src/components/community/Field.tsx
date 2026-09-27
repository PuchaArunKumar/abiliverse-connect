import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Props to spread onto the input a Field labels. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  /** Standing guidance, such as the length limit. */
  hint?: string;
  /** Shown after a failed submit; read out with the field when it gets focus. */
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label, control, hint and error, wired together: the hint and the error are
 * both referenced by aria-describedby and the control is marked invalid, so a
 * screen reader user hears what went wrong when focus lands on the field.
 */
const Field = ({ id, label, hint, error, className, children }: FieldProps) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })}
      </div>
      {error && (
        <p
          id={errorId}
          className={cn(
            "mt-1 text-sm font-medium [overflow-wrap:anywhere]",
            // The theme's destructive red is too dark to read on the dark
            // background (about 2.4:1), so dark mode uses a lighter red.
            "text-destructive dark:text-red-300",
          )}
        >
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};

export default Field;
