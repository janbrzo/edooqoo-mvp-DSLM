/**
 * ScrollableStepList — wraps children in a scroll container when count exceeds maxVisible.
 * Below the threshold it renders a plain spaced div.
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface ScrollableStepListProps {
  count: number;
  maxVisible?: number;
  className?: string;
  children: React.ReactNode;
}

export const ScrollableStepList: React.FC<ScrollableStepListProps> = ({
  count, maxVisible = 5, className, children,
}) => {
  const scroll = count > maxVisible;
  return (
    <div
      className={cn(
        'space-y-1.5',
        scroll && 'max-h-[320px] overflow-y-auto pr-1',
        className,
      )}
    >
      {children}
    </div>
  );
};
