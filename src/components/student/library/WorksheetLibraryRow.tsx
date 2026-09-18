/** WorksheetLibraryRow — dense worksheet row with one consolidated action menu. */
import React from 'react';
import { CopyPlus, ExternalLink, FileText, MoreHorizontal, Pencil, Share2 } from 'lucide-react';
import { EntityRow } from '@/components/student/EntityRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MediaBadges } from '@/components/worksheet/MediaBadges';
import {
  formatLibraryDate,
  type LibraryWorksheetItem,
} from '@/lib/students/libraryItems';

export interface WorksheetLibraryRowProps {
  item: LibraryWorksheetItem;
  onOpen: (id: string) => void;
  onReuse: (id: string) => void;
  onRename: (id: string, currentTitle: string) => void;
  onShare: (item: LibraryWorksheetItem) => void;
  worksheetActions?: React.ReactNode;
}

export const WorksheetLibraryRow: React.FC<WorksheetLibraryRowProps> = ({
  item,
  onOpen,
  onReuse,
  onRename,
  onShare,
  worksheetActions,
}) => {
  const subtitle = item.grammar ? `Grammar: ${item.grammar}` : 'Worksheet';

  return (
    <EntityRow
      dense
      icon={FileText}
      title={item.title}
      subtitle={subtitle}
      meta={formatLibraryDate(item.createdAt)}
      onClick={() => onOpen(item.id)}
      badges={(
        <>
          <MediaBadges hasImage={item.hasImage} hasAudio={item.hasAudio} size="sm" />
          {item.isShared && (
            <Badge variant="outline" className="border-success/40 text-success">
              Shared
            </Badge>
          )}
        </>
      )}
      menu={(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`More actions for ${item.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => onOpen(item.id)}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onReuse(item.id)}>
              <CopyPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Reuse in new worksheet
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(item.id, item.title)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onShare(item)}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Share
            </DropdownMenuItem>
            {worksheetActions && (
              <>
                <DropdownMenuSeparator />
                <div
                  className="flex items-center justify-end gap-1 px-1 py-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {worksheetActions}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      data-testid={`library-worksheet-${item.id}`}
    />
  );
};

export default WorksheetLibraryRow;
