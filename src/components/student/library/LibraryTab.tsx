/**
 * LibraryTab — the Library tab composition (v6.9.111, M6 step 3).
 *
 * Answers one question: "where is the material I already used, and how do I
 * reuse it fast?". The tab owns no data and no rules — it receives already
 * built, filtered and sorted items from the page and renders the section
 * switcher, the toolbar, worksheet rows, server pagination and the collapsed
 * Deleted section.
 *
 * Loading shows five skeleton rows (never a spinner) so the layout stays
 * stable while the page fetches.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LibrarySegments, type LibrarySectionCounts } from './LibrarySegments';
import { LibraryToolbar } from './LibraryToolbar';
import { WorksheetLibraryRow } from './WorksheetLibraryRow';
import {
  DeletedWorksheetsSection,
  type LibraryDeletedItem,
} from './DeletedWorksheetsSection';
import {
  LIBRARY_SECTION_LABELS,
  type LibrarySection,
  type LibrarySort,
  type LibraryWorksheetItem,
} from '@/lib/students/libraryItems';

export interface LibraryTabProps {
  section: LibrarySection;
  counts: LibrarySectionCounts;
  onSectionChange: (section: LibrarySection) => void;

  /** Worksheets section */
  items: readonly LibraryWorksheetItem[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (value: LibrarySort) => void;
  onGenerate: () => void;
  onOpen: (id: string) => void;
  onReuse: (id: string) => void;
  onRename: (id: string, currentTitle: string) => void;
  onShare: (item: LibraryWorksheetItem) => void;
  renderWorksheetActions?: (item: LibraryWorksheetItem) => React.ReactNode;

  /** Server pagination (worksheets only) */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;

  /** Deleted worksheets */
  deletedItems: readonly LibraryDeletedItem[];
  deletedTotalCount: number;
  isDeletedLoading?: boolean;
  onRestore: (id: string) => void;

  /** Other sections are mounted only while active. */
  flashcardsSlot?: React.ReactNode;
  homeworkSlot?: React.ReactNode;
}

const SkeletonRows: React.FC = () => (
  <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
        <Skeleton className="h-4 w-4 rounded" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    ))}
  </div>
);

export const LibraryTab: React.FC<LibraryTabProps> = ({
  section,
  counts,
  onSectionChange,
  items,
  isLoading,
  search,
  onSearchChange,
  sort,
  onSortChange,
  onGenerate,
  onOpen,
  onReuse,
  onRename,
  onShare,
  renderWorksheetActions,
  page,
  pageCount,
  onPageChange,
  deletedItems,
  deletedTotalCount,
  isDeletedLoading,
  onRestore,
  flashcardsSlot,
  homeworkSlot,
}) => {
  const hasSearch = search.trim().length > 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <LibrarySegments value={section} counts={counts} onChange={onSectionChange} />

        {section === 'worksheets' && (
          <div className="space-y-4">
            <LibraryToolbar
              search={search}
              onSearchChange={onSearchChange}
              sort={sort}
              onSortChange={onSortChange}
              onGenerate={onGenerate}
            />

            {isLoading ? (
              <SkeletonRows />
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {hasSearch ? 'No materials match this search' : 'No materials yet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasSearch
                      ? 'Try a different title or grammar point.'
                      : 'Generated worksheets for this student will appear here.'}
                  </p>
                </div>
                {!hasSearch && (
                  <Button variant="outline" size="sm" onClick={onGenerate}>
                    Generate worksheet
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <WorksheetLibraryRow
                    key={item.id}
                    item={item}
                    onOpen={onOpen}
                    onReuse={onReuse}
                    onRename={onRename}
                    onShare={onShare}
                    worksheetActions={renderWorksheetActions?.(item)}
                  />
                ))}
              </div>
            )}

            {!isLoading && pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => onPageChange(page + 1)}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}

            <DeletedWorksheetsSection
              items={deletedItems}
              totalCount={deletedTotalCount}
              isLoading={isDeletedLoading}
              onRestore={onRestore}
            />
          </div>
        )}

        {section === 'flashcards' && (
          <div>
            {flashcardsSlot ?? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {LIBRARY_SECTION_LABELS.flashcards} are not available yet.
              </p>
            )}
          </div>
        )}

        {section === 'homework' && (
          <div>
            {homeworkSlot ?? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {LIBRARY_SECTION_LABELS.homework} is not available yet.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LibraryTab;
