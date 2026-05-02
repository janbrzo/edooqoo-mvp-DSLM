import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

/**
 * P7 — Standardised loading state for any async action button.
 * Disables the button while loading and shows a spinner + optional label.
 * Uses semantic tokens via the underlying Button component.
 */
export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, loadingText, disabled, children, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        className={cn(className)}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading && loadingText ? loadingText : children}
      </Button>
    );
  }
);
LoadingButton.displayName = "LoadingButton";
