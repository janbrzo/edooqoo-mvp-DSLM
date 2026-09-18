/** DeletedWorksheetsSection — collapsible restore-only list for soft-deleted worksheets. */
import React from 'react';
import { ChevronDown, FileText, RotateCcw } from 'lucide-react';
import { EntityRow } from '@/components/student/EntityRow';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatLibraryDate } from '@/lib/students/libraryItems';

export interface LibraryDeletedItem {
  id: string;
  title?: string | null;
  deletedAt: string;
}

export interface DeletedWorksheetsSectionProps {
  items: readonly LibraryDeletedItem[];
  totalCount: number;
  isLoading?: boolean;
  onRestore: (id: string) => void;
}

export const DeletedWorksheetsSection: React.FC<DeletedWorksheetsSectionProps> = ({
  items,
  totalCount,
  isLoading,
  onRestore,
}) => {
  const [open, setOpen] = React.useState(false);

  if (totalCount === 0 && !isLoading) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between px-2 text-muted-foreground"
          aria-label={`${open ? 'Collapse' : 'Expand'} deleted worksheets`}
        >
          <span>Deleted ({totalCount})</span>
          <ChevronDown
            className={cn('transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const title = item.title?.trim() || 'Untitled worksheet';
              return (
                <EntityRow
                  key={item.id}
                  dense
                  tone="destructive"
                  icon={FileText}
                  title={title}
                  subtitle={`Deleted ${formatLibraryDate(item.deletedAt)}`}
                  actions={(
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore(item.id)}
                      aria-label={`Restore ${title}`}
                    >
                      <RotateCcw aria-hidden="true" />
                      Restore
                    </Button>
                  )}
                  data-testid={`library-deleted-${item.id}`}
                />
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DeletedWorksheetsSection;
