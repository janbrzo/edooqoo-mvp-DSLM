import { useState } from 'react';
import { CheckCircle2, Clipboard, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendPlacementInvite } from '@/lib/welcomeTest/placementReportApi';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function copy(value: string) {
  await navigator.clipboard.writeText(value);
}

/** Lets a teacher without an account send the placement test; results come back by email. */
export function QuickSendPlacementForm({ onBack }: { onBack: () => void }) {
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ testUrl: string; studentSent: boolean } | null>(null);

  const submit = async () => {
    if (!studentName.trim()) { toast.error("Enter your student's first name."); return; }
    if (studentEmail.trim() && !emailPattern.test(studentEmail.trim())) { toast.error("Check the student's email or leave it empty."); return; }
    if (!emailPattern.test(teacherEmail.trim())) { toast.error('Enter your email so the results reach you.'); return; }
    setSending(true);
    try {
      const response = await sendPlacementInvite({ studentName: studentName.trim(), studentEmail: studentEmail.trim(), teacherEmail: teacherEmail.trim() });
      setSent(response);
      try { await copy(response.testUrl); toast.success('Test link copied.'); } catch { /* user can copy manually */ }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the test link.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="space-y-4 rounded-3xl border border-success/30 bg-success/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          <div className="space-y-1">
            <p className="font-semibold">{sent.studentSent ? `Test sent to ${studentName.trim()}.` : `Test link for ${studentName.trim()} is ready.`}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Share the link by WhatsApp or Messenger too. When {studentName.trim()} finishes, the full teaching profile arrives at {teacherEmail.trim()}.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={sent.testUrl} aria-label="Placement test link" onFocus={(event) => event.target.select()} className="text-xs" />
          <Button variant="outline" className="shrink-0 rounded-full" onClick={() => { copy(sent.testUrl).then(() => toast.success('Test link copied.'), () => toast.error('Select the link and copy it manually.')); }}>
            <Clipboard className="h-4 w-4" />Copy link
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">The link is valid for 7 days. No account needed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quick-send-student-name">Student's first name</Label>
          <Input id="quick-send-student-name" maxLength={80} value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Marta" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quick-send-student-email">Student's email (optional)</Label>
          <Input id="quick-send-student-email" type="email" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} placeholder="student@example.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quick-send-teacher-email">Your email (results arrive here)</Label>
        <Input id="quick-send-teacher-email" type="email" autoComplete="email" value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} placeholder="you@example.com" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" className="h-auto min-h-11 rounded-full" onClick={() => { void submit(); }} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send test and copy link
        </Button>
        <Button size="lg" variant="ghost" className="h-auto min-h-11 rounded-full" onClick={onBack}>Back</Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">No account needed. We use your email only to send you the results.</p>
    </div>
  );
}
