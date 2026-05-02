// ============================================
// FAZA 3: Progress Bar for Shared Worksheet Study Mode
// ============================================

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, FileText, Clock } from 'lucide-react';
import { SharedWorksheetProgress } from '@/types/interactiveSharedWorksheet';

interface SharedWorksheetProgressBarProps {
  progress: SharedWorksheetProgress;
  isSaving: boolean;
  lastSavedAt: Date | null;
}

export const SharedWorksheetProgressBar = ({
  progress,
  isSaving,
  lastSavedAt
}: SharedWorksheetProgressBarProps) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Label + Progress info */}
          <div className="flex items-center gap-3">
            {/* Sticky label */}
            <div className="flex items-center gap-1.5 mr-2">
              <FileText className="h-3.5 w-3.5 text-worksheet-purple" />
              <span className="text-xs font-semibold uppercase tracking-wider text-worksheet-purple">
                Shared Worksheet
              </span>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Progress: {progress.answeredExercises}/{progress.totalExercises} exercises
                  </span>
                  {progress.totalTasks > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-muted-foreground">
                        {progress.answeredTasks}/{progress.totalTasks} tasks
                      </span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-sm font-semibold text-primary">
                    {progress.percentageComplete}%
                  </span>
                </div>
              </div>
              <Progress value={progress.percentageComplete} className="h-2" />
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {isSaving ? (
              <Badge variant="secondary" className="animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Saving...
              </Badge>
            ) : lastSavedAt ? (
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                Saved at {formatTime(lastSavedAt)}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};