import React from 'react';
import { ArrowRight, Brain, CheckCircle2, ClipboardCheck, Compass, ExternalLink, Headphones, Mic, Minus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PUBLIC_PLACEMENT_TEST_PATH } from '@/lib/welcomeTest/publicPlacementTest';
import { QuickSendPlacementForm } from '@/components/landing/QuickSendPlacementForm';

interface PlacementTestPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: 'preview' | 'send';
}

const skillAreas = [
  { icon: Compass, title: 'Real needs vs declared goals', detail: 'Decision scenarios reveal what the learner actually needs at work, not only what they say they want.' },
  { icon: Brain, title: 'Learner profile', detail: 'Self-awareness, confidence and learning preferences, so you know how to teach this adult.' },
  { icon: Mic, title: 'Writing & speaking', detail: 'Open answers and a recorded speaking task, not only multiple choice.' },
  { icon: Headphones, title: 'Grammar, vocabulary & listening', detail: 'Practical structures and expressions measured in everyday professional situations.' },
];

const marketContrast = [
  { label: 'Typical level test', points: ['Multiple choice grammar', 'One CEFR label', 'No idea what to teach first'] },
  { label: 'Edooqoo Placement Test', points: ['Four skills with real production', 'Declared vs actual needs', 'Suggested goals you review'] },
];

const flowSteps = [
  { title: 'Enter the student and your email', detail: 'You get a private test link in seconds and can share it by email, WhatsApp or Messenger.' },
  { title: 'Your student completes it', detail: 'About 20 to 25 minutes on their phone or laptop, including writing and speaking tasks.' },
  { title: 'Receive the teaching profile', detail: 'Skill profile, real needs and suggested goals arrive before lesson one. You decide what to teach.' },
];

const PlacementTestPreviewDialog: React.FC<PlacementTestPreviewDialogProps> = ({ open, onOpenChange, initialMode = 'preview' }) => {
  const [mode, setMode] = React.useState<'preview' | 'send'>(initialMode);
  React.useEffect(() => { if (open) setMode(initialMode); }, [open, initialMode]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <ClipboardCheck className="h-4 w-4" />Placement Test · Teacher Preview
          </div>
          <DialogTitle className="text-2xl leading-tight tracking-normal">Meet your student before lesson one</DialogTitle>
          <DialogDescription className="leading-6">
            Send one placement test to understand their English, real-life goals and learning preferences before you plan the first lesson.
          </DialogDescription>
        </DialogHeader>

        {mode === 'send' ? (
          <QuickSendPlacementForm onBack={() => setMode('preview')} />
        ) : (
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

        <section aria-labelledby="placement-contrast-title" className="space-y-3">
          <h3 id="placement-contrast-title" className="text-sm font-semibold text-foreground">More than a level: who your student is and what they really need</h3>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            {marketContrast.map((column, index) => (
              <div key={column.label} className={`rounded-2xl border p-3.5 ${index === 1 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                <p className={`text-xs font-semibold uppercase ${index === 1 ? 'text-primary' : 'text-muted-foreground'}`}>{column.label}</p>
                <ul className="mt-2 space-y-1.5">
                  {column.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs leading-5 text-foreground">
                      {index === 1 ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> : <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
          <Button asChild size="lg" className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5">
            <button type="button" onClick={() => setMode('send')}>
              Send Placement to Student<Send className="h-4 w-4" />
            </button>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5">
            <a href={PUBLIC_PLACEMENT_TEST_PATH} target="_blank" rel="noreferrer" onClick={() => onOpenChange(false)}>
              Try Placement Test as Student<ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <p className="text-center text-xs leading-5 text-muted-foreground">The full test opens in a new tab. Its answers and recordings stay on that device for 7 days.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlacementTestPreviewDialog;
