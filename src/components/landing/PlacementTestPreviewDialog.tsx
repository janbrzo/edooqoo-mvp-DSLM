import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Headphones, Mic, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PLACEMENT_PREVIEW_QUESTIONS } from '@/lib/welcomeTest/placementPreview';

interface PlacementTestPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PlacementTestPreviewDialog: React.FC<PlacementTestPreviewDialogProps> = ({ open, onOpenChange }) => {
  const location = useLocation();
  const [step, setStep] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = step === null ? undefined : PLACEMENT_PREVIEW_QUESTIONS[step];
  const complete = step !== null && step >= PLACEMENT_PREVIEW_QUESTIONS.length;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) { setStep(null); setAnswers({}); }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <ClipboardCheck className="h-4 w-4" />Placement Test
          </div>
          <DialogTitle className="text-2xl leading-tight tracking-normal">
            {step === null ? 'Meet your student before lesson one' : complete ? 'Your sample is complete' : 'Try the student experience'}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {step === null
              ? 'Discover their English level, real-life goals and learning preferences, then review the suggested starting point.'
              : 'A short sample of real test questions. Answers stay in this preview and are not saved or evaluated.'}
          </DialogDescription>
        </DialogHeader>

        {step === null ? (
          <>
            <div className="grid grid-cols-2 gap-4 border-y border-border py-5">
              {[
                { icon: BookOpen, title: 'Grammar & vocabulary', detail: 'From core structures to practical expressions' },
                { icon: Headphones, title: 'Reading & listening', detail: 'Comprehension in everyday situations' },
                { icon: Mic, title: 'Writing & speaking', detail: 'Real answers, not just multiple choice' },
                { icon: ClipboardCheck, title: 'Goals & preferences', detail: 'A starting point the teacher reviews' },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="min-w-0">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Send the assigned test by link. Your student answers on their own device; you review the profile and choose which suggested goals to use.</p>
            <Button size="lg" className="h-auto min-h-11 whitespace-normal" onClick={() => setStep(0)}>
              Try Placement Test as Student<ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : complete ? (
          <div className="border-y border-border py-5">
            <CheckCircle2 className="mb-3 h-8 w-8 text-success" />
            <p className="text-sm leading-6 text-muted-foreground">The full assigned test includes listening and recorded speaking tasks. A teacher receives the evaluated profile. This sample does not determine your CEFR level.</p>
            <Button variant="outline" className="mt-4" onClick={() => { setStep(0); setAnswers({}); }}><RotateCcw className="h-4 w-4" />Try again</Button>
          </div>
        ) : question ? (
          <div className="space-y-4 border-y border-border py-5" aria-live="polite">
            <p className="text-xs font-medium text-muted-foreground">Sample {(step ?? 0) + 1} of {PLACEMENT_PREVIEW_QUESTIONS.length}</p>
            <h3 className="whitespace-pre-line text-base font-semibold leading-6 text-foreground">{question.text}</h3>
            {question.description && <p className="text-sm leading-6 text-muted-foreground">{question.description}</p>}
            {question.options ? (
              <div className="space-y-2" role="group" aria-label="Answer choices">
                {question.options.map((option) => (
                  <Button key={option} variant={answers[question.id] === option ? 'secondary' : 'outline'}
                    aria-pressed={answers[question.id] === option}
                    className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2 text-left font-normal"
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}>
                    {option}
                  </Button>
                ))}
              </div>
            ) : question.type === 'speaking_record' ? (
              <div className="flex items-start gap-3 rounded-md bg-muted p-4 text-sm leading-6 text-muted-foreground">
                <Mic className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <p>Try saying your answer aloud. Recording is available in the assigned student test; this sample does not access your microphone.</p>
              </div>
            ) : (
              <Textarea aria-label="Your sample answer" rows={4} maxLength={2000} value={answers[question.id] ?? ''}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
            )}
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep((current) => current === null || current <= 0 ? null : current - 1)}><ArrowLeft className="h-4 w-4" />Back</Button>
              <Button onClick={() => setStep((current) => (current ?? 0) + 1)}>{step === PLACEMENT_PREVIEW_QUESTIONS.length - 1 ? 'Finish sample' : 'Next'}<ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : null}

        <Button variant="outline" asChild className="h-auto min-h-11 whitespace-normal">
          <Link to="/signup" state={{ from: location.pathname + location.search }} onClick={() => close(false)}>
            Start Teaching with Edooqoo<ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">Free account. No credit card required.</p>
      </DialogContent>
    </Dialog>
  );
};

export default PlacementTestPreviewDialog;