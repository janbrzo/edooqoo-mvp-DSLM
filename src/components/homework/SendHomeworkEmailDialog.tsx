import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SendHomeworkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeworkId: string;
  homeworkTitle: string;
  studentEmail?: string | null;
  studentId?: string | null;
  lastSentAt?: string | null;
  currentReminderHours?: number;
  deadline?: string | null;
  reminderScheduledAt?: string | null;
}

export function SendHomeworkEmailDialog({
  open,
  onOpenChange,
  homeworkId,
  homeworkTitle,
  studentEmail: initialStudentEmail,
  studentId,
  lastSentAt,
  currentReminderHours = 24,
  deadline,
  reminderScheduledAt
}: SendHomeworkEmailDialogProps) {
  const [studentEmailInput, setStudentEmailInput] = useState(initialStudentEmail || '');
  const [reminderHours, setReminderHours] = useState("0"); // Default to NOW for this dialog
  const [isSending, setIsSending] = useState(false);
  
  // Calculate hours until deadline for validation
  const deadlineDate = deadline ? new Date(deadline) : null;
  const now = new Date();
  const hoursUntilDeadline = deadlineDate 
    ? (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    : null;

  const handleSendEmail = async () => {
    if (!studentEmailInput.trim()) {
      toast.error('Please enter a student email address');
      return;
    }

    try {
      setIsSending(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Update reminder_hours in database only if not NOW
      if (reminderHours !== "0") {
        const { error: updateError } = await supabase
          .from('homework_assignments')
          .update({ reminder_hours: parseInt(reminderHours) })
          .eq('id', homeworkId);

        if (updateError) throw updateError;
        
        // Fetch updated reminder_scheduled_at to show user
        const { data: hwRow } = await supabase
          .from('homework_assignments')
          .select('reminder_scheduled_at')
          .eq('id', homeworkId)
          .maybeSingle();
        
        if (hwRow?.reminder_scheduled_at) {
          const scheduledDate = new Date(hwRow.reminder_scheduled_at);
          console.log('[SendHomeworkEmailDialog] Updated reminder_scheduled_at:', hwRow.reminder_scheduled_at);
          toast.success(`Reminder scheduled for: ${format(scheduledDate, 'MMM dd, yyyy HH:mm')}. Email will be sent automatically.`);
        }
      }

      // Send email ONLY if reminderHours === "0" (NOW)
      if (reminderHours === "0") {
        const { data, error } = await supabase.functions.invoke('send-homework-email', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            homeworkId,
            studentEmail: studentEmailInput,
            updateStudentEmail: !initialStudentEmail, // Update if email wasn't in DB
            isReminder: !!lastSentAt, // Use reminder template if email was sent before
          },
        });

        if (error) throw error;

        toast.success(`Homework notification sent to ${studentEmailInput}`);
      } else {
        // Only reminder scheduled, no immediate email
        toast.success(`Reminder scheduled. No email sent now.`);
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending homework email:', error);
      toast.error(error.message || 'Failed to send homework email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Send Homework Email
          </DialogTitle>
          <DialogDescription>
            {lastSentAt ? (
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Last sent: {format(new Date(lastSentAt), 'MMM dd, yyyy HH:mm')}
              </span>
            ) : (
              'Send homework notification email to student'
            )}
            {deadline && (
              <div className="text-sm mt-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <strong>Deadline:</strong> {format(new Date(deadline), 'MMM dd, yyyy HH:mm')}
              </div>
            )}
          {reminderScheduledAt && new Date() < new Date(reminderScheduledAt) && (
            <div className="text-sm mt-2 flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <strong>Reminder scheduled for:</strong> {format(new Date(reminderScheduledAt), 'MMM dd, yyyy HH:mm')}
            </div>
          )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {lastSentAt && (
            <Alert>
              <AlertDescription>
                This homework was already sent. Clicking "Send" will resend the notification.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="homework-title">Homework</Label>
            <Input
              id="homework-title"
              value={homeworkTitle}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-email">Student Email *</Label>
            <Input
              id="student-email"
              type="email"
              placeholder="student@example.com"
              value={studentEmailInput}
              onChange={(e) => setStudentEmailInput(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-hours" className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Send Reminder Before Deadline
            </Label>
            <Select value={reminderHours} onValueChange={setReminderHours}>
              <SelectTrigger id="reminder-hours">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Now (immediately)</SelectItem>
                <SelectItem value="6" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 6}>6 hours before</SelectItem>
                <SelectItem value="12" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 12}>12 hours before</SelectItem>
                <SelectItem value="23" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 23}>23 hours before (test)</SelectItem>
                <SelectItem value="24" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 24}>24 hours before (default)</SelectItem>
                <SelectItem value="48" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 48}>2 days before</SelectItem>
                <SelectItem value="72" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 72}>3 days before</SelectItem>
                <SelectItem value="96" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 96}>4 days before</SelectItem>
                <SelectItem value="120" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 120}>5 days before</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={isSending || !studentEmailInput.trim()}
          >
            {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {reminderHours === "0" 
              ? (lastSentAt ? 'Resend Email' : 'Send Email')
              : 'Schedule Reminder'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
