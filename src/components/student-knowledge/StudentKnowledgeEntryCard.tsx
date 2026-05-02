import { Eye, Pencil, Trash2, ExternalLink, Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { StudentKnowledgeEntry, getCategoryMetadata, formatTagForDisplay } from '@/types/studentKnowledge';
import { format } from 'date-fns';

interface StudentKnowledgeEntryCardProps {
  entry: StudentKnowledgeEntry;
  onView: (entry: StudentKnowledgeEntry) => void;
  onEdit: (entry: StudentKnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
  onMarkOutdated: (entryId: string) => void;
  onMarkCurrent: (entryId: string) => void;
  worksheetTitle?: string;
}

export const StudentKnowledgeEntryCard = ({
  entry,
  onView,
  onEdit,
  onDelete,
  onMarkOutdated,
  onMarkCurrent,
  worksheetTitle,
}: StudentKnowledgeEntryCardProps) => {
  const categoryMeta = getCategoryMetadata(entry.category);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if content has more than 4 lines (estimate: ~80 chars per line)
  const contentLength = entry.content.length;
  const estimatedLines = Math.ceil(contentLength / 80);
  const hasLongContent = estimatedLines > 4;

  const handleWorksheetClick = () => {
    if (entry.worksheet_id) {
      window.open(`/worksheet/${entry.worksheet_id}`, '_blank');
    }
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${entry.is_outdated ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        {/* Header: Category + Outdated Badge + Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`${categoryMeta?.color} border gap-1.5 px-2 py-1`}
            >
              <span className="text-sm">{categoryMeta?.icon}</span>
              <span className="text-xs font-medium">{categoryMeta?.label}</span>
            </Badge>
            
            {entry.is_outdated && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                Outdated
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(entry)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(entry)}
              className="h-8 w-8 p-0"
              disabled={entry.is_outdated}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {/* Archive/Restore Button */}
            {entry.is_outdated ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark as Current?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will restore the note as current and relevant again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onMarkCurrent(entry.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Mark as Current
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark as Outdated?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark the note as no longer relevant (e.g., student changed jobs, already mastered this skill). You can restore it later if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onMarkOutdated(entry.id)}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      Mark as Outdated
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this knowledge entry.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(entry.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Content */}
        <div className="mb-3">
          <p className={`text-sm text-foreground whitespace-pre-wrap ${!isExpanded && hasLongContent ? 'line-clamp-4' : ''}`}>
            {entry.content}
          </p>
          {hasLongContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 h-auto p-0 text-xs text-primary hover:text-primary/80"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Read full
                </>
              )}
            </Button>
          )}
        </div>

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {entry.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                {formatTagForDisplay(tag)}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer: Worksheet Link + Timestamp */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
          <div className="flex items-center gap-2">
            {entry.worksheet_id && (
              <button
                onClick={handleWorksheetClick}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <span>From: {worksheetTitle || 'Worksheet'}</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
          <span>{format(new Date(entry.created_at), 'MMM d, yyyy')}</span>
        </div>
      </CardContent>
    </Card>
  );
};
