import { useState } from 'react';
import { BookOpen, Copy, ExternalLink, Calendar, Eye, CheckCircle2, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { SendHomeworkEmailDialog } from '@/components/homework/SendHomeworkEmailDialog';
import type { HomeworkAssignment } from '@/hooks/useAllWorksheetHomework';

interface WorksheetHomeworkListProps {
  homework: HomeworkAssignment[];
  variant?: 'full' | 'simplified';
}

export const WorksheetHomeworkList = ({ homework, variant = 'full' }: WorksheetHomeworkListProps) => {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedHomeworkForEmail, setSelectedHomeworkForEmail] = useState<HomeworkAssignment | null>(null);

  const handleMarkDone = async (homeworkId: string, title: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('mark_homework_completed', {
        p_homework_id: homeworkId,
        p_user_id: user.id,
        p_is_teacher: true
      });

      if (error) throw error;

      toast.success(`Marked "${title}" as completed`);
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('homeworkCompleted', { detail: { homeworkId } }));
    } catch (error: any) {
      console.error('Error marking homework as done:', error);
      toast.error(error.message || 'Failed to mark homework as completed');
    }
  };

  const handleOpenEmailDialog = (hw: HomeworkAssignment) => {
    setSelectedHomeworkForEmail(hw);
    setEmailDialogOpen(true);
  };

  const handleCopyLink = (shareToken: string | null, title: string) => {
    if (!shareToken) {
      toast.error('Share link not available');
      return;
    }
    const url = `${window.location.origin}/homework/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success(`Link copied for "${title}"`);
  };

  const handleOpenHomework = (shareToken: string | null) => {
    if (!shareToken) {
      toast.error('Share link not available');
      return;
    }
    window.open(`/homework/${shareToken}`, '_blank');
  };

  if (homework.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-2">
        No homework assignments yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {homework.map((hw) => (
        <div
          key={hw.id}
          className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
        >
          {variant === 'full' ? (
            // FULL VARIANT - Original layout for Dashboard and Worksheets tab
            <>
              {/* Title with actions on same line */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {hw.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Student: {hw.student_name}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons - inline */}
                <div className="flex gap-1 flex-shrink-0">
                  {!hw.completed_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkDone(hw.id, hw.title)}
                      title="Mark as done"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEmailDialog(hw)}
                    title="Send email notification"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(hw.share_token, hw.title)}
                    title="Copy homework link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenHomework(hw.share_token)}
                    title="Open homework"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* All Badges below */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  Created: {format(new Date(hw.created_at), 'MMM dd, yyyy')}
                </Badge>
                {hw.completed_at && (
                  <Badge className="bg-green-500 text-white text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
                {hw.deadline && (
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    Due: {format(new Date(hw.deadline), 'MMM dd, yyyy')}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Viewed {hw.view_count}x
                </Badge>
                {hw.viewed_at && (
                  <Badge variant="outline" className="text-xs">
                    Last viewed: {format(new Date(hw.viewed_at), 'MMM dd, yyyy')}
                  </Badge>
                )}
              </div>
            </>
          ) : (
            // SIMPLIFIED VARIANT - For Overview tab only
            <>
              {/* Title */}
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {hw.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Student: {hw.student_name}
                  </p>
                </div>
              </div>

              {/* Action Buttons - above badges */}
              <div className="flex gap-1">
                {!hw.completed_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkDone(hw.id, hw.title)}
                    title="Mark as done"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEmailDialog(hw)}
                  title="Send email notification"
                >
                  <Mail className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyLink(hw.share_token, hw.title)}
                  title="Copy homework link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenHomework(hw.share_token)}
                  title="Open homework"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              {/* ONLY Created and Completed badges */}
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  Created: {format(new Date(hw.created_at), 'MMM dd, yyyy')}
                </Badge>
                {hw.completed_at && (
                  <Badge className="bg-green-500 text-white text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      {/* Email Dialog */}
      {selectedHomeworkForEmail && (
        <SendHomeworkEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          homeworkId={selectedHomeworkForEmail.id}
          homeworkTitle={selectedHomeworkForEmail.title}
          studentEmail={selectedHomeworkForEmail.student_email}
          studentId={selectedHomeworkForEmail.student_id}
          lastSentAt={selectedHomeworkForEmail.reminder_sent_at}
          currentReminderHours={selectedHomeworkForEmail.reminder_hours || 24}
          deadline={selectedHomeworkForEmail.deadline}
          reminderScheduledAt={selectedHomeworkForEmail.reminder_scheduled_at}
        />
      )}
    </div>
  );
};
