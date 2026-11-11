import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Headphones,
  Layers,
  MessageSquareText,
  MessagesSquare,
  Mic,
  Play,
  RotateCcw,
  Send,
  UserRound,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeacherFilmPlayer from '@/components/landing/TeacherFilmPlayer';

const EXAMPLE_WORKSHEET_TOPIC = 'Cross-Cultural Negotiations in Tech';
const previewBodyClass = 'flex min-h-[744px] flex-col sm:min-h-[604px]';
const previewCtaClass = 'mt-auto h-auto min-h-11 w-full whitespace-normal rounded-full px-4 py-2.5';

interface OneMinutePrepHeroProofSwitcherProps {
  onGenerateWorksheet: (topic: string) => void;
  onPreviewPlacementTest: () => void;
  onSendPlacement?: () => void;
}

const WorksheetPreview = ({ onGenerateWorksheet }: { onGenerateWorksheet: (topic: string) => void }) => (
  <div className={previewBodyClass}>
    <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-primary">Example worksheet</p>
        <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">{EXAMPLE_WORKSHEET_TOPIC}</h2>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">B2/C1</span>
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4 text-primary" />Marta, Senior Product Manager</span>
      <span className="rounded-full border border-border px-2 py-0.5">Adult Business</span>
    </div>

    <section className="rounded-2xl border border-border bg-background p-4" aria-labelledby="preview-audio-task">
      <div className="flex items-center gap-2">
        <Headphones className="h-4 w-4 shrink-0 text-primary" />
        <h3 id="preview-audio-task" className="text-sm font-semibold text-foreground">Audio discussion</h3>
        <span className="ml-auto text-xs text-muted-foreground">1:45</span>
      </div>
      <div className="mt-3 flex items-center gap-3" aria-label="Example audio duration: 1 minute 45 seconds">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play className="h-3.5 w-3.5 fill-current" /></span>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"><span className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary" /></span>
        <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Two colleagues renegotiate a launch date. What compromise do they reach?</p>
    </section>

    <section className="mt-3 rounded-2xl border border-border bg-background p-4" aria-labelledby="preview-vocabulary-task">
      <h3 id="preview-vocabulary-task" className="flex items-center gap-2 text-sm font-semibold text-foreground"><BookOpen className="h-4 w-4 text-primary" />Vocabulary in context</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the phrase that softens a disagreement.</p>
      <p className="mt-2 rounded-xl bg-primary/5 p-3 text-sm italic leading-6 text-foreground">“I see your point, but could we look at it another way?”</p>
    </section>

    <div className="my-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
      <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span><strong className="font-semibold text-foreground">Speaking roleplay:</strong> Renegotiate a deadline without damaging trust.</span>
    </div>

    <Button className={previewCtaClass} onClick={() => onGenerateWorksheet(EXAMPLE_WORKSHEET_TOPIC)}>
      Generate Worksheet on this Topic<ArrowDown className="h-4 w-4" />
    </Button>
  </div>
);

const SkillBar = ({ label, level, value, attention = false }: { label: string; level: string; value: number; attention?: boolean }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      <span className={attention ? 'font-semibold text-primary' : 'text-muted-foreground'}>{level}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-primary/10" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  </div>
);

const WelcomeTestPreview = ({ onPreviewPlacementTest, onSendPlacement }: { onPreviewPlacementTest: () => void; onSendPlacement: () => void }) => (
  <div className={previewBodyClass}>
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase text-primary">Example placement report</p>
      <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">Marta's starting point</h2>
      <p className="mt-1 text-xs text-muted-foreground">Senior Product Manager · Illustrative result</p>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4">
      <div className="min-w-0"><p className="text-sm font-semibold text-foreground">Overall profile</p><p className="mt-1 text-xs leading-5 text-muted-foreground">B2 Upper-Intermediate</p></div>
      <div className="text-right"><span className="block text-2xl font-bold text-primary">B2</span><span className="text-xs font-medium text-muted-foreground">48/54</span></div>
    </div>
    <div className="mt-4 space-y-3" aria-label="Example skill profile">
      <SkillBar label="Grammar" level="B2+" value={82} />
      <SkillBar label="Vocabulary" level="B2" value={75} />
      <SkillBar label="Speaking gap" level="B1 · 33%" value={33} attention />
      <SkillBar label="Listening" level="C1" value={90} />
    </div>
    <div className="my-4 rounded-2xl border border-border bg-background p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ClipboardCheck className="h-4 w-4 text-primary" />Suggested learning goals</h3>
      <ul className="mt-2 space-y-2 text-sm leading-5 text-muted-foreground">
        <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Pitching proposals to global leadership</li>
        <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Diplomatic disagreement in sprint reviews</li>
      </ul>
    </div>
    <div className="mt-auto grid gap-2">
      <Button className={`${previewCtaClass} mt-0`} onClick={onSendPlacement}>
        Send Placement to Student<Send className="h-4 w-4" />
      </Button>
      <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal rounded-full px-4 py-2.5" onClick={onPreviewPlacementTest}>
        Preview Placement Test<ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const HomeworkPreview = () => (
  <div className={previewBodyClass}>
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase text-primary">Example student homework</p>
      <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">An unexpected project delay</h2>
      <p className="mt-1 text-xs text-muted-foreground">Past simple vs. past continuous · B2</p>
    </div>
    <div className="mt-4 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Your task</h3></div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Describe what was happening when the client changed the deadline, and explain how your team responded.</p>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted p-3" aria-label="Example student voice answer, 38 seconds">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Mic className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">Student voice answer</p><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15"><div className="h-full w-3/4 rounded-full bg-primary" /></div></div>
        <span className="text-xs text-muted-foreground">0:38</span>
      </div>
      <p className="mt-3 text-sm italic leading-6 text-foreground">“We were testing the update when the client called.”</p>
    </div>
    <div className="my-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">AI-assisted evaluation</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Reviewed by Teacher</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Past continuous correctly used for the action in progress. Check prepositions in question 2.</p>
      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground"><strong className="font-semibold text-foreground">Teacher note:</strong> Clear sequence. Next, practise explaining the response with “so” and “as a result”.</p>
    </div>
    <Button asChild className={previewCtaClass}>
      <Link to="/features/homework">See Homework Workflow<ArrowRight className="h-4 w-4" /></Link>
    </Button>
  </div>
);

const FlashcardsPreview = () => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={previewBodyClass}>
      <div className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase text-primary">Example smart flashcard</p>
        <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">Business vocabulary in context</h2>
        <p className="mt-1 text-xs text-muted-foreground">Illustrative card and study progress</p>
      </div>
      <button
        type="button"
        aria-pressed={revealed}
        aria-label={revealed ? 'Show flashcard phrase' : 'Reveal flashcard meaning'}
        onClick={() => setRevealed((current) => !current)}
        className="mt-5 flex min-h-[270px] w-full flex-col rounded-3xl border border-primary/20 bg-primary/5 p-6 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-primary"><span>{revealed ? 'Meaning & example' : 'Phrase'}</span><RotateCcw className="h-4 w-4" /></span>
        <span className="my-auto block py-6">
          <span className="block text-3xl font-bold text-foreground">follow up</span>
          <span className="mt-2 block text-sm text-muted-foreground">/ˈfɒləʊ ʌp/</span>
          {revealed ? (
            <span className="mt-5 block">
              <span className="block text-sm leading-6 text-foreground">Contact someone again after a previous conversation or meeting.</span>
              <span className="mt-3 block rounded-xl bg-background p-3 text-sm italic leading-6 text-muted-foreground">“I'll follow up with the client after tomorrow's sprint review.”</span>
            </span>
          ) : (
            <span className="mt-5 block text-sm font-medium text-primary">Tap to reveal the meaning and example</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">Business English · Verb phrase</span>
      </button>
      <div className="my-4 rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-foreground">Example mastery</span><span className="font-semibold text-primary">85%</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10" aria-hidden="true"><div className="h-full w-[85%] rounded-full bg-primary" /></div>
        <p className="mt-2 text-xs text-muted-foreground">Next review in 3 days · SM-2 scheduling</p>
      </div>
      <Button asChild className={previewCtaClass}>
        <Link to="/features/flashcards">Explore Smart Flashcards<ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  );
};

const FilmPreview = () => (
  <div className={previewBodyClass}>
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase text-primary">Interactive teacher tour</p>
      <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">See the tools work together</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Follow one illustrative student from placement to the next lesson.</p>
    </div>
    <TeacherFilmPlayer />
    <Button asChild className={`${previewCtaClass} mt-4`}>
      <Link to="/one-minute-prep#interactive-tour">Watch Full Teacher Tour<ArrowUpRight className="h-4 w-4" /></Link>
    </Button>
  </div>
);

const ecosystem = [
  { icon: ClipboardCheck, label: 'Placement' },
  { icon: FileText, label: 'Worksheet' },
  { icon: ClipboardCheck, label: 'Homework' },
  { icon: Layers, label: 'Flashcards' },
  { icon: Play, label: 'Next prep' },
];

const OneMinutePrepHeroProofSwitcher: React.FC<OneMinutePrepHeroProofSwitcherProps> = ({ onGenerateWorksheet, onPreviewPlacementTest }) => (
  <div className="w-full min-w-0">
    <Tabs defaultValue="worksheet" activationMode="manual">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-full border border-border bg-card/80 p-1.5 shadow-sm sm:grid-cols-5" aria-label="Edooqoo product preview">
        {[
          ['worksheet', 'Worksheet'],
          ['test', 'Placement Test'],
          ['homework', 'Homework'],
          ['flashcards', 'Flashcards'],
          ['film', '1-Minute Loop'],
        ].map(([id, label]) => (
          <TabsTrigger
            key={id}
            value={id}
            className="h-10 whitespace-normal rounded-full px-1.5 text-center text-xs leading-4 last:col-span-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:last:col-span-1"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="mt-3 min-h-[800px] rounded-3xl border border-border bg-card/90 p-5 shadow-lg sm:min-h-[660px] sm:p-6">
        <TabsContent value="worksheet" className="mt-0"><WorksheetPreview onGenerateWorksheet={onGenerateWorksheet} /></TabsContent>
        <TabsContent value="test" className="mt-0"><WelcomeTestPreview onPreviewPlacementTest={onPreviewPlacementTest} /></TabsContent>
        <TabsContent value="homework" className="mt-0"><HomeworkPreview /></TabsContent>
        <TabsContent value="flashcards" className="mt-0"><FlashcardsPreview /></TabsContent>
        <TabsContent value="film" className="mt-0"><FilmPreview /></TabsContent>
      </div>
    </Tabs>
    <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Connected teaching workflow">
      {ecosystem.map(({ icon: Icon, label }, index) => (
        <li key={label} className="relative flex min-w-0 flex-col items-center gap-1 text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]">
          <Icon className="h-4 w-4 text-primary" /><span>{label}</span>{index < ecosystem.length - 1 && <ArrowRight className="absolute -right-2 top-0.5 h-3 w-3 text-muted-foreground" />}
        </li>
      ))}
    </ol>
  </div>
);

export default OneMinutePrepHeroProofSwitcher;
