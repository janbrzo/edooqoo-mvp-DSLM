import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Render without surrounding Card (use inside an existing card/panel) */
  bare?: boolean;
}

/**
 * P9 — Unified empty state for lists, tables, dashboards.
 * Replaces ad-hoc "No data" markup scattered across the app.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  bare = false,
}) => {
  const inner = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-6",
        className
      )}
      role="status"
    >
      {icon && (
        <div className="mb-4 text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

  if (bare) return inner;

  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  );
};
