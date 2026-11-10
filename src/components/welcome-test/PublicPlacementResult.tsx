import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clipboard, Mail, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  buildPublicPlacementResultUrl,
  type PublicPlacementResult as PublicPlacementResultData,
  type SharedPublicPlacementResult,
} from '@/lib/welcomeTest/publicPlacementTest';
import {
  humanizeDivergenceText,
  interpretSelfAwareness,
  selfAssessmentAccuracyLabel,
  traitLabel,
  traitValueLabel,
} from '@/lib/welcomeTest/traitLabels';

interface PublicPlacementResultProps {
  result: PublicPlacementResultData | null;
  shareStatus: SharedPublicPlacementResult['status'];
  storageError: string | null;
  onReset: () => Promise<void>;
}

const skillLabels = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  listening: 'Listening',
} as const;

const profileTraits = ['motivation_type', 'latent_goal', 'preferred_input_channel', 'homework_commitment', 'feedback_preference'] as const;
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

export function PublicPlacementResult({ result, shareStatus, storageError, onReset }: PublicPlacementResultProps) {
  const [studentEmail, setStudentEmail] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const shareUrl = useMemo(() => result ? buildPublicPlacementResultUrl(result, window.location.origin) : '', [result]);
  const isShared = shareStatus === 'valid';

  const reset = async () => {
    setResetting(true);
    try { await onReset(); } finally { setResetting(false); setConfirmReset(false); }
  };

  const copyLink = async () => {
    try {
      await copyText(shareUrl);
      toast.success('Results link copied. It expires 48 hours after completion.');
    } catch {
      toast.error('Could not copy automatically. Select the link and copy it manually.');
    }
  };

  const openEmail = () => {
    if (!emailPattern.test(studentEmail.trim()) || !emailPattern.test(teacherEmail.trim())) {
      toast.error('Enter a valid student email and teacher email, or use Copy results link.');
      return;
    }
    const subject = 'Placement test preview results';
    const body = [
      `Student: ${studentEmail.trim()}`,
      '',
      'Here is the private placement preview summary:',
      shareUrl,
      '',
      'This link expires 48 hours after test completion. It contains the summary only, not open answers or recordings.',
    ].join('\n');
    window.location.href = `mailto:${teacherEmail.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
                ? 'Placement preview links are available for 48 hours. Take the interactive test to create a fresh local result.'
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
  const availableTraits = profileTraits.filter((key) => result.traits[key]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 px-3 py-6 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="text-center space-y-2">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Interactive placement preview</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{isShared ? 'Shared placement summary' : 'Your placement preview is ready'}</h1>
          <p className="text-sm leading-6 text-muted-foreground max-w-xl mx-auto">
            A local snapshot of keyed answers and learning scenarios. Open writing and speaking are not AI-graded in this public preview.
          </p>
        </div>

        {storageError && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{storageError}</div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="rounded-3xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Estimated CEFR</p>
              <p className="mt-1 text-2xl font-bold text-primary">{result.level ?? 'Not enough evidence'}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {result.level ? `Self-assessment: ${selfAssessmentAccuracyLabel(result.levelConfidence)}` : 'Answer more scored grammar, vocabulary, reading or listening items.'}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Self-awareness signal</p>
              <p className="mt-1 text-2xl font-bold text-primary">{result.selfAwarenessScore === null ? 'No signal' : `${result.selfAwarenessScore}%`}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{interpretSelfAwareness(result.selfAwarenessScore)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Test coverage</p>
              <p className="mt-1 text-2xl font-bold text-primary">{result.answeredCount}/{result.totalQuestions}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{result.openResponseCount} written answers and {result.recordingCount} recordings saved locally</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-lg">Keyed skill snapshot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(skillLabels) as Array<keyof typeof skillLabels>).map((skill) => {
              const data = result.skills[skill];
              return (
                <div key={skill}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{skillLabels[skill]}</span>
                    <span className="text-xs text-muted-foreground">{data?.score === null || !data ? 'Not scored' : `${data.score}% · ${data.correct}/${data.answered} correct`}</span>
                  </div>
                  <Progress value={data?.score ?? 0} className="h-2" aria-label={`${skillLabels[skill]} preview score`} />
                </div>
              );
            })}
            <p className="text-xs leading-5 text-muted-foreground">Only answered keyed items affect these percentages. Writing and speaking require teacher review and are deliberately left unscored here.</p>
          </CardContent>
        </Card>

        {availableTraits.length > 0 && (
          <Card className="rounded-3xl">
            <CardHeader><CardTitle className="text-lg">Learning profile signals</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {availableTraits.map((key) => (
                <div key={key} className="rounded-2xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{traitLabel(key)}</p>
                  <p className="mt-1 text-sm font-medium">{traitValueLabel(key, result.traits[key])}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {result.divergences.length > 0 && (
          <Card className="rounded-3xl">
            <CardHeader><CardTitle className="text-lg">Declared goals vs scenario signals</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {result.divergences.slice(0, 4).map((divergence, index) => (
                <div key={`${divergence.pair}-${index}`} className="rounded-2xl border border-border p-3 text-sm leading-6">
                  <span className="font-medium">Declared: </span>{humanizeDivergenceText(divergence.declared)}.<br />
                  <span className="font-medium">Scenario signal: </span>{humanizeDivergenceText(divergence.observed)}.
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!isShared && (
          <Card className="rounded-3xl border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg">Share this summary with a teacher</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">The link contains this summary only. It does not contain your written answers, recordings or email addresses.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={shareUrl} aria-label="48-hour results link" onFocus={(event) => event.target.select()} className="text-xs" />
                <Button variant="outline" className="rounded-full shrink-0" onClick={() => { void copyLink(); }}><Clipboard className="h-4 w-4" />Copy results link</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="public-student-email">Your email</Label>
                  <Input id="public-student-email" type="email" autoComplete="email" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} placeholder="student@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="public-teacher-email">Teacher's email</Label>
                  <Input id="public-teacher-email" type="email" value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} placeholder="teacher@example.com" />
                </div>
              </div>
              <Button variant="secondary" className="w-full rounded-full" onClick={openEmail}><Mail className="h-4 w-4" />Open email to share</Button>
              <p className="text-xs leading-5 text-muted-foreground">This opens your email app with the link prepared. Nothing is sent or uploaded automatically.</p>
            </CardContent>
          </Card>
        )}

        <div className="rounded-2xl bg-muted/40 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs leading-5 text-muted-foreground">
            {isShared ? 'This read-only summary' : 'Your answers and result on this device'} expire after 48 hours. This summary is available until {expiry}. Anyone with the link can view the summary until then.
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
