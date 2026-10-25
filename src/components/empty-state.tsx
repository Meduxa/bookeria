import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center", className)}
    >
      {icon && <div className="rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-6">{icon}</div>}
      <h2 className="text-lg font-semibold text-balance">{title}</h2>
      {description && <p className="text-sm text-balance text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
