import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageLoadingStateProps {
  /** Screen-reader announcement, e.g. "Loading student profile". */
  label?: string;
  /** Number of skeleton cards rendered below the header block. */
  cards?: number;
  /** Render inside an existing page shell instead of a full-height viewport. */
  inline?: boolean;
  className?: string;
}

/**
 * Shared skeleton placeholder for full-page data loads.
 * Replaces bare "Loading..." strings so the layout does not jump once data arrives.
 */
export const PageLoadingState = ({
  label = "Loading",
  cards = 3,
  inline = false,
  className,
}: PageLoadingStateProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "w-full",
        inline ? "py-6" : "min-h-screen bg-background px-4 py-8",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-border bg-card p-4"
            >
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageLoadingState;