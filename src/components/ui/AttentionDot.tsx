// v6.9.68 P4 — Subtle "needs review" indicator. Semantic-token only.
// Use next to a label/icon to flag pending teacher attention.
import React from 'react';
import { cn } from '@/lib/utils';

interface AttentionDotProps {
  show: boolean;
  className?: string;
  /** Optional accessible label, defaults to "Needs review". */
  label?: string;
}

export const AttentionDot: React.FC<AttentionDotProps> = ({ show, className, label = 'Needs review' }) => {
  if (!show) return null;
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block h-2 w-2 rounded-full bg-destructive shadow-[0_0_0_2px_hsl(var(--background))] ml-1.5',
        'animate-pulse',
        className,
      )}
    />
  );
};

export default AttentionDot;