import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const pill = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success-soft text-success-ink",
        warning: "bg-warning-soft text-warning-ink",
        info: "bg-info-soft text-info-ink",
        danger: "bg-destructive-soft text-destructive-ink",
        arrived: "bg-status-arrived-soft text-status-arrived-ink",
        progress: "bg-status-in-progress-soft text-status-in-progress-ink",
        brand: "bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type PillTone = NonNullable<VariantProps<typeof pill>["tone"]>;

// Coloured status label (Flup-style). The dot repeats the meaning for users
// who can't tell colours apart only together with the text, never alone.
export function StatusPill({
  tone,
  dot = false,
  className,
  children,
}: VariantProps<typeof pill> & { dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn(pill({ tone }), className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
