/**
 * Inline date metadata shown on test cards and the test details header.
 * Renders "Created: dd MMM yyyy · Completed: dd MMM yyyy" with em-dash fallback.
 */
import { format } from "date-fns";

interface Props {
  createdAt?: string | null;
  completedAt?: string | null;
  reviewedAt?: string | null;
  className?: string;
}

const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd MMM yyyy"); } catch { return "—"; }
};

export function TestDates({ createdAt, completedAt, reviewedAt, className }: Props) {
  const done = completedAt ?? reviewedAt ?? null;
  return (
    <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
      Created: {fmt(createdAt)} · Completed: {fmt(done)}
    </p>
  );
}