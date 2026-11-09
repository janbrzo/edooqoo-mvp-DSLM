import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Headphones, Mic, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PLACEMENT_PREVIEW_QUESTIONS } from '@/lib/welcomeTest/placementPreview';

interface PlacementTestPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const skillAreas = [
  { icon: BookOpen, title: 'Grammar & vocabulary', detail: 'From core structures to practical expressions' },
  { icon: Headphones, title: 'Reading & listening', detail: 'Comprehension in everyday situations' },
  { icon: Mic, title: 'Writing & speaking', detail: 'Real answers, not just multiple choice' },
  { icon: ClipboardCheck, title: 'Goals & preferences', detail: 'A starting point the teacher reviews' },
];

const flowSteps = [
  { title: 'Send a private test link', detail: 'Choose or add your student in the teacher dashboard.' },
  { title: 'Your student completes it', detail: 'They answer on their own device, including writing and speaking tasks.' },
  { title: 'Review the starting point', detail: 'See the skill profile and suggested goals, then decide what to teach.' },
];

const PlacementTestPreviewDialog: React.FC<PlacementTestPreviewDialogProps> = ({ open, onOpenChange }) => {
  const [step, setStep] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = step === null ? undefined : PLACEMENT_PREVIEW_QUESTIONS[step];
  const complete = step !== null && step >= PLACEMENT_PREVIEW_QUESTIONS.length;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) { setStep(null); setAnswers({}); }
    onOpenChange(nextOpen);
  };

  const sendPlacementButton = (
    <Button asChild size="lg" className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5">
      <Link to="/dashboard?action=add-student" onClick={() => close(false)}>
        Send Placement to Student<Send className="h-4 w-4" />
      </Link>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <ClipboardCheck className="h-4 w-4" />Placement Test · Teacher Preview
          </div>
          <DialogTitle className="text-2xl leading-tight tracking-normal">
            {step === null ? 'Meet your student before lesson one' : complete ? 'Your sample is complete' : 'Try the student experience'}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {step === null
              ? 'Send one placement test to understand their English, real-life goals and learning preferences before you plan the first lesson.'
              : 'A short sample of real test questions. Answers stay in this preview and are not saved or evaluated.'}
          </DialogDescription>
        </DialogHeader>

        {step === null ? (
          <>
            <section className="rounded-2xl border border-border bg-muted/30 p-4" aria-labelledby="placement-flow-title">
              <h3 id="placement-flow-title" className="text-sm font-semibold text-foreground">From first contact to a useful teaching profile</h3>
              <ol className="mt-4 space-y-3">
                {flowSteps.map((item, index) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                    <div><p className="text-sm font-semibold text-foreground">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {skillAreas.map(({ icon: Icon, title, detail }) => (
                <div key={title} className="min-w-0 rounded-2xl border border-border bg-card p-3.5">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {sendPlacementButton}
              <Button variant="outline" size="lg" className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5" onClick={() => setStep(0)}>
                Try Sample Test as Student<ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-xs leading-5 text-muted-foreground">The sample is local: it creates no student, saves no answers and calculates no CEFR level.</p>
          </>
        ) : complete ? (
          <div className="space-y-4 border-y border-border py-5">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="text-sm leading-6 text-muted-foreground">The full assigned test also includes listening and recorded speaking tasks. The teacher receives the evaluated profile and reviews the suggested goals. This sample does not determine your CEFR level.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sendPlacementButton}
              <Button variant="outline" className="h-auto min-h-11 rounded-full" onClick={() => { setStep(0); setAnswers({}); }}><RotateCcw className="h-4 w-4" />Try Sample Again</Button>
            </div>
          </div>
        ) : question ? (
          <div className="space-y-4 border-y border-border py-5" aria-live="polite">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Student sample · {(step ?? 0) + 1} of {PLACEMENT_PREVIEW_QUESTIONS.length}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10" aria-hidden="true">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${((step ?? 0) + 1) / PLACEMENT_PREVIEW_QUESTIONS.length * 100}%` }} />
              </div>
            </div>
            <h3 className="whitespace-pre-line text-base font-semibold leading-6 text-foreground">{question.text}</h3>
            {question.description && <p className="text-sm leading-6 text-muted-foreground">{question.description}</p>}
            {question.options ? (
              <div className="space-y-2" role="group" aria-label="Answer choices">
                {question.options.map((option) => (
                  <Button key={option} variant={answers[question.id] === option ? 'secondary' : 'outline'}
                    aria-pressed={answers[question.id] === option}
                    className="h-auto min-h-11 w-full justify-start whitespace-normal rounded-xl px-3 py-2 text-left font-normal"
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}>
                    {option}
                  </Button>
                ))}
              </div>
            ) : question.type === 'speaking_record' ? (
              <div className="flex items-start gap-3 rounded-2xl bg-muted p-4 text-sm leading-6 text-muted-foreground">
                <Mic className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <p>Try saying your answer aloud. Recording is available in the assigned student test; this sample does not access your microphone.</p>
              </div>
            ) : (
              <Textarea aria-label="Your sample answer" rows={4} maxLength={2000} value={answers[question.id] ?? ''}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
            )}
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep((current) => current === null || current <= 0 ? null : current - 1)}><ArrowLeft className="h-4 w-4" />Back</Button>
              <Button className="rounded-full" onClick={() => setStep((current) => (current ?? 0) + 1)}>{step === PLACEMENT_PREVIEW_QUESTIONS.length - 1 ? 'Finish sample' : 'Next'}<ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default PlacementTestPreviewDialog;
