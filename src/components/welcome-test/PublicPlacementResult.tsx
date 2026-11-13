import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clipboard, Loader2, RotateCcw, Send, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PlacementReportBody } from '@/components/welcome-test/PlacementReportBody';
import { clearPlacementInviteToken, getPlacementInvite, submitPlacementReport } from '@/lib/welcomeTest/placementReportApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type PublicPlacementResult as PublicPlacementResultData,
  type SharedPublicPlacementResult,
} from '@/lib/welcomeTest/publicPlacementTest';

interface PublicPlacementResultProps {
  result: PublicPlacementResultData | null;
  shareStatus: SharedPublicPlacementResult['status'];
  storageError: string | null;
  onReset: () => Promise<void>;
  inviteToken?: string | null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy was not available');
}

export function PublicPlacementResult({ result, shareStatus, storageError, onReset, inviteToken = null }: PublicPlacementResultProps) {
  const [invite, setInvite] = useState<{ studentName: string; completed: boolean } | null>(null);
  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    getPlacementInvite(inviteToken)
      .then((data) => { if (!cancelled) { setInvite(data); setStudentName((name) => name || data.studentName); } })
      .catch(() => { if (!cancelled) setInvite(null); });
    return () => { cancelled = true; };
  }, [inviteToken]);
  const invited = !!invite && !invite.completed;
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ studentUrl: string; studentSent: boolean } | null>(null);
  const [teacherEmail, setTeacherEmail] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const isShared = shareStatus === 'valid';

  // Invited tests: the server already knows the teacher, so results go out automatically.
  const autoSent = useRef(false);
  useEffect(() => {
    if (!invited || !result || isShared || sent || autoSent.current) return;
    autoSent.current = true;
    void sendReport(invite.studentName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invited, result, isShared]);

  const reset = async () => {
    setResetting(true);
    try { await onReset(); } finally { setResetting(false); setConfirmReset(false); }
  };

  const copyLink = async (url: string) => {
    try {
      await copyText(url);
      toast.success('Results link copied. It is valid for 7 days after completion.');
    } catch {
      toast.error('Could not copy automatically. Please try again.');
    }
  };

  const sendReport = async (nameOverride?: string) => {
    if (!result) return;
    const name = (nameOverride ?? studentName).trim();
    if (!name) { toast.error('Enter your first name.'); return; }
    if (!invited && !emailPattern.test(teacherEmail.trim())) { toast.error("Enter your teacher's email."); return; }
    if (studentEmail.trim() && !emailPattern.test(studentEmail.trim())) { toast.error('Check your email address or leave it empty.'); return; }
    setSending(true);
    try {
      const response = await submitPlacementReport({ result, studentName: name, studentEmail: studentEmail.trim(), teacherEmail: invited ? '' : teacherEmail.trim(), inviteToken: invited ? inviteToken : null });
      if (invited) clearPlacementInviteToken();
      setSent({ studentUrl: response.studentUrl, studentSent: response.studentSent });
      if (!invited) toast.success('Report sent to your teacher.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!result) {
    const expired = shareStatus === 'expired';
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4 flex items-center justify-center">
        <Card className="w-full max-w-lg rounded-3xl">
          <CardContent className="py-8 text-center space-y-4">
            <TriangleAlert className="h-10 w-10 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">{expired ? 'This results link has expired' : 'This results link is not available'}</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {expired
                ? 'Placement preview links are available for 7 days. Take the interactive test to create a fresh local result.'
                : 'The summary is incomplete or invalid. You can still take the full interactive placement test.'}
            </p>
            <Button className="rounded-full" onClick={() => { void reset(); }} disabled={resetting}>
              Try Placement Test<ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiry = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.expiresAt));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 px-3 py-6 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="text-center space-y-2">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Interactive placement preview</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{isShared ? 'Shared placement summary' : 'Your placement preview is ready'}</h1>
          <p className="text-sm leading-6 text-muted-foreground max-w-xl mx-auto">
            Here is a first look at your English. Your teacher receives the full analysis.
          </p>
        </div>

        {storageError && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{storageError}</div>
        )}

        <PlacementReportBody result={result} audience={isShared ? 'student' : 'teaser'} />

        {!isShared && invite?.completed && !sent && (
          <div role="status" className="rounded-2xl bg-muted/40 border border-border p-4 text-sm">Results for this invitation were already sent to your teacher.</div>
        )}

        {!isShared && invited && (
          <Card className="rounded-3xl border-success/30">
            <CardContent className="p-5 space-y-3" role="status">
              {sent ? (
                <>
                  <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" />Your results have been sent to your teacher</p>
                  <p className="text-sm leading-6 text-muted-foreground">Nothing else to do. Your teacher now has your full report and will use it to prepare your first lesson.{sent.studentSent ? ' A copy of your results is in your inbox.' : ''}</p>
                  <Button variant="outline" className="rounded-full" onClick={() => { void copyLink(sent.studentUrl); }}><Clipboard className="h-4 w-4" />Copy my results link</Button>
                </>
              ) : sending ? (
                <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sending your results to your teacher...</p>
              ) : (
                <>
                  <p className="text-sm">We could not send your results automatically.</p>
                  <Button className="rounded-full" onClick={() => { void sendReport(invite.studentName); }}><Send className="h-4 w-4" />Try again</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isShared && !invited && !invite?.completed && (
          <Card className="rounded-3xl border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg">{invited ? 'Send your results to your teacher' : 'Learning with a private teacher? Send them this report'}</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Your teacher gets the full analysis by email and will know exactly what to work on from your first lesson. With Edooqoo they can prepare your materials in about a minute.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {sent ? (
                <div role="status" className="rounded-2xl bg-success/10 border border-success/30 p-4 space-y-3">
                  <p className="text-sm font-medium">Report sent to {invited || !teacherEmail.trim() ? 'your teacher' : teacherEmail.trim()}.{sent.studentSent ? ' A copy of your results is in your inbox.' : ''}</p>
                  <p className="text-xs leading-5 text-muted-foreground">Want to message your teacher too? Copy your results link for WhatsApp or Messenger.</p>
                  <Button variant="outline" className="rounded-full" onClick={() => { void copyLink(sent.studentUrl); }}><Clipboard className="h-4 w-4" />Copy results link</Button>
                </div>
              ) : (
                <>
                  <div className={`grid gap-3 ${invited ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                    <div className="space-y-1.5">
                      <Label htmlFor="public-student-name">Your first name</Label>
                      <Input id="public-student-name" autoComplete="given-name" maxLength={80} value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Marta" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="public-student-email">Your email (optional)</Label>
                      <Input id="public-student-email" type="email" autoComplete="email" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} placeholder="you@example.com" />
                    </div>
                    {!invited && (
                      <div className="space-y-1.5">
                        <Label htmlFor="public-teacher-email">Teacher's email</Label>
                        <Input id="public-teacher-email" type="email" value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} placeholder="teacher@example.com" />
                      </div>
                    )}
                  </div>
                  <Button className="w-full rounded-full" onClick={() => { void sendReport(); }} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send report to my teacher
                  </Button>
                  <p className="text-xs leading-5 text-muted-foreground">The report contains this summary only, never your written answers or recordings. It is valid for 7 days after the test.</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="rounded-2xl bg-muted/40 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs leading-5 text-muted-foreground">
            {isShared ? 'This read-only summary' : 'Your answers and result on this device'} expire after 7 days. This summary is available until {expiry}. Anyone with the link can view the summary until then.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          {!confirmReset ? (
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4" />{isShared ? 'Try Placement Test Yourself' : 'Start a New Test'}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="destructive" className="rounded-full" onClick={() => { void reset(); }} disabled={resetting}>Clear local answers and restart</Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
