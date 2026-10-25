import type { ReactNode } from "react";
import { FieldError } from "@/components/field-error";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Label + control + hint + translated error, wired for screen readers.
export function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} code={error} />
    </div>
  );
}

// aria props for the control inside a FormField
export const describedBy = (id: string, error?: string) => ({
  "aria-invalid": !!error,
  "aria-describedby": `${id}-hint ${id}-error`,
});

export function SwitchRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
