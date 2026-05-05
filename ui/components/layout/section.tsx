import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <header className="flex items-baseline gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground flex-1">· {description}</p>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  );
}
