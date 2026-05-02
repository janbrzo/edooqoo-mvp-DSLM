import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Loader2, Presentation, X, ArrowLeft, Home, User, FileText } from 'lucide-react';
import { HomeworkProgress } from '@/types/interactiveHomework';
import { Link, useNavigate } from 'react-router-dom';

interface HomeworkProgressBarProps {
  progress: HomeworkProgress;
  isSaving: boolean;
  lastSavedAt: Date | null;
  isSubmitted: boolean;
  isTeacher?: boolean;
  presentationMode?: boolean;
  onStartPresentation?: () => void;
  onEndPresentation?: () => void;
  studentName?: string;
  studentId?: string;
}

export const HomeworkProgressBar = ({
  progress,
  isSaving,
  lastSavedAt,
  isSubmitted,
  isTeacher = false,
  presentationMode = false,
  onStartPresentation,
  onEndPresentation,
  studentName,
  studentId
}: HomeworkProgressBarProps) => {
  const navigate = useNavigate();
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Label + Progress info */}
          <div className="flex items-center gap-3">
            {/* Sticky label */}
            <div className="flex items-center gap-1.5 mr-2">
              <FileText className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">
                Homework
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

          {/* Teacher Navigation Buttons */}
          {isTeacher && (
            <div className="flex items-center gap-2 mr-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">
                  <Home className="h-4 w-4 mr-1" />
                  Dashboard
                </Link>
              </Button>
              {studentId && studentName && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/student/${studentId}`}>
                    <User className="h-4 w-4 mr-1" />
                    {studentName}
                  </Link>
                </Button>
              )}
            </div>
          )}

          {/* Teacher Presentation Mode Button */}
          {isTeacher && (
            <div className="flex items-center gap-2">
              {!presentationMode ? (
                <Button 
                  onClick={onStartPresentation}
                  variant="outline"
                  size="sm"
                  className="border-purple-500 text-purple-600 hover:bg-purple-50"
                >
                  <Presentation className="h-3 w-3 mr-1" />
                  Start Presentation
                </Button>
              ) : (
                <Button 
                  onClick={onEndPresentation}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <X className="h-3 w-3 mr-1" />
                  End Presentation
                </Button>
              )}
            </div>
          )}

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {presentationMode && (
              <Badge className="bg-purple-500 text-white">
                <Presentation className="h-3 w-3 mr-1" />
                Presentation Mode
              </Badge>
            )}
            {isSubmitted ? (
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Submitted
              </Badge>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
