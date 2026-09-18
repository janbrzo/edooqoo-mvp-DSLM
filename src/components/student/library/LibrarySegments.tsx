/**
 * LibrarySegments — stable section switcher for the Student Library (M6 step 2).
 * All sections remain visible, including sections whose count is zero or not loaded.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LIBRARY_SECTIONS,
  LIBRARY_SECTION_LABELS,
  type LibrarySection,
} from '@/lib/students/libraryItems';

export type LibrarySectionCounts = Partial<Record<LibrarySection, number>>;

export interface LibrarySegmentsProps {
  value: LibrarySection;
  counts: LibrarySectionCounts;
  onChange: (section: LibrarySection) => void;
  className?: string;
}

export const LibrarySegments: React.FC<LibrarySegmentsProps> = ({
  value,
  counts,
  onChange,
  className,
}) => (
  <div
    role="tablist"
    aria-label="Library sections"
    className={cn('flex w-full flex-wrap gap-1 rounded-lg bg-muted/40 p-1 sm:w-fit', className)}
  >
    {LIBRARY_SECTIONS.map((section) => {
      const active = value === section;
      const count = counts[section];
      const empty = count === 0;

      return (
        <Button
          key={section}
          type="button"
          role="tab"
          aria-selected={active}
          variant={active ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onChange(section)}
          className={cn(
            'h-8 flex-1 px-3 text-xs sm:flex-none',
            !active && empty && 'text-muted-foreground/60',
          )}
          data-testid={`library-section-${section}`}
        >
          {LIBRARY_SECTION_LABELS[section]}
          {count !== undefined && (
            <span className="tabular-nums text-muted-foreground">{count}</span>
          )}
        </Button>
      );
    })}
  </div>
);

export default LibrarySegments;
