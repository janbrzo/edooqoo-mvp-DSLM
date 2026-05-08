import { Eye, Pencil, Trash2, ExternalLink, Archive, ArchiveRestore, ChevronDown, ChevronUp, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { format, differenceInDays } from 'date-fns';

interface StudentKnowledgeEntryCardProps {
  entry: StudentKnowledgeEntry;
  onView: (entry: StudentKnowledgeEntry) => void;
  onEdit: (entry: StudentKnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
  onMarkOutdated: (entryId: string) => void;
  onMarkCurrent: (entryId: string) => void;
  onArchive?: (entryId: string) => void;
  onConfirmCurrent?: (entryId: string) => void;
  worksheetTitle?: string;
}

export const StudentKnowledgeEntryCard = ({
  entry,
  onView,
  onEdit,
  onDelete,
  onMarkOutdated,
  onMarkCurrent,
  onArchive,
  onConfirmCurrent,
  worksheetTitle,
}: StudentKnowledgeEntryCardProps) => {
  const categoryMeta = getCategoryMetadata(entry.category);
  const [isExpanded, setIsExpanded] = useState(false);

  // v6.9.10 — Stale freshness check (client-side only, zero infra).
  // Uses max(created_at, metadata.last_confirmed_at) as the "freshness anchor".
  const STALE_AFTER_DAYS = 90;
  const STALE_CATEGORIES: ReadonlyArray<string> = ['Personal', 'Skill Assessment', 'Goals'];
  const lastConfirmedAt = (entry.metadata as any)?.last_confirmed_at as string | undefined;
  const freshnessAnchor = lastConfirmedAt
    ? new Date(Math.max(new Date(entry.created_at).getTime(), new Date(lastConfirmedAt).getTime()))
    : new Date(entry.created_at);
  const ageDays = differenceInDays(new Date(), freshnessAnchor);
  const isStale =
    !entry.is_outdated &&
    !entry.archived_at &&
    STALE_CATEGORIES.includes(entry.category) &&
    ageDays >= STALE_AFTER_DAYS;

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

            {entry.ai_classified && typeof entry.ai_confidence === 'number' && entry.ai_confidence >= 0.6 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-[10px]">
                      <Sparkles className="h-3 w-3 text-primary" />
                      AI organized
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="text-xs">Auto-classified · confidence {(entry.ai_confidence * 100).toFixed(0)}%</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {entry.archived_at && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">Used</Badge>
            )}

            {entry.is_outdated && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                Outdated
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onArchive && entry.category === 'Next Lesson Ideas' && !entry.archived_at && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                      onClick={() => onArchive(entry.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><span className="text-xs">Mark as used in worksheet</span></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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

        {/* v6.9.10 — Stale freshness prompt */}
        {isStale && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200">
              <Clock className="h-3.5 w-3.5" />
              <span>Stale ({ageDays}d old) — still true?</span>
            </div>
            <div className="flex items-center gap-1">
              {onConfirmCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
                  onClick={() => onConfirmCurrent(entry.id)}
                >
                  Yes, still current
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-orange-700 hover:text-orange-800 dark:text-orange-300"
                onClick={() => onMarkOutdated(entry.id)}
              >
                Mark outdated
              </Button>
            </div>
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
