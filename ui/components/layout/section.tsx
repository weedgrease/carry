import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page-level grouping with an uppercase heading, optional description and action slot. */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-8 last:mb-0", className)}>
      <header className="mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider min-w-0 truncate" title={title}>{title}</h2>
          {action && <div className="sm:ml-auto">{action}</div>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}
