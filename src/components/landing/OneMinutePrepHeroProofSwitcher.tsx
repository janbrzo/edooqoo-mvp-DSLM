import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, FileText, Headphones, Layers, MessagesSquare, Play, UserRound } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeacherFilmPlayer from '@/components/landing/TeacherFilmPlayer';

const WorksheetPreview = () => (
  <>
    <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-primary">Example worksheet</p>
        <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">Cross-Cultural Negotiations in Tech</h2>
      </div>
      <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">B2/C1</span>
    </div>
    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
      <UserRound className="h-4 w-4 shrink-0 text-primary" />Marta, Senior Product Manager
    </div>
    <div className="divide-y divide-border">
      {[
        { icon: Headphones, title: 'Audio discussion', detail: 'Compare two approaches to a delayed product launch.' },
        { icon: BookOpen, title: 'Vocabulary in context', detail: 'Choose the phrase that softens a disagreement.' },
        { icon: MessagesSquare, title: 'Speaking practice', detail: 'Renegotiate a deadline without damaging trust.' },
      ].map(({ icon: Icon, title, detail }) => (
        <article key={title} className="py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </article>
      ))}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs font-medium text-muted-foreground">
      {['Adult-focused', 'Teacher-editable', 'Ready to share'].map((label) => <span key={label} className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{label}</span>)}
    </div>
  </>
);

const WelcomeTestPreview = () => (
  <>
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase text-primary">Example placement profile</p>
      <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">Know who you are teaching</h2>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-primary/5 p-4">
      <div className="min-w-0"><p className="text-sm font-semibold text-foreground">Marta's starting point</p><p className="mt-1 text-xs leading-5 text-muted-foreground">B2 Upper-Intermediate</p></div>
      <span className="text-2xl font-bold text-primary">B2</span>
    </div>
    <dl className="mt-2 divide-y divide-border">
      {[
        ['Speaking', 'Precision and nuance need practice'],
        ['Learning goal', 'Pitch ideas to international clients'],
        ['Next focus', 'Clear, confident client conversations'],
      ].map(([label, detail]) => (
        <div key={label} className="py-4"><dt className="text-sm font-semibold text-foreground">{label}</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</dd></div>
      ))}
    </dl>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Sent by link. Completed on the student's device. Suggested goals are reviewed by the teacher.</p>
  </>
);

const HomeworkPreview = () => (
  <>
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase text-primary">Example homework & flashcards</p>
      <h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">Keep learning between lessons</h2>
    </div>
    <div className="mt-4 border-l-2 border-primary pl-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">Marta's homework</h3><span className="text-xs font-medium text-success">Reviewed</span></div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Describe a project delay and explain what happened.</p>
      <p className="mt-3 text-sm italic leading-6 text-foreground">“We were testing the update when the client called.”</p>
      <div className="mt-3 rounded-md bg-muted p-3"><p className="text-xs font-semibold text-primary">AI-assisted feedback</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Clear sequence. Use past continuous for the action already in progress.</p></div>
    </div>
    <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground"><ArrowRight className="h-4 w-4 text-primary" />Vocabulary ready for another encounter</div>
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-primary">Example flashcard</p><p className="mt-2 text-lg font-bold text-foreground">follow up</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Contact someone again after a first conversation.</p>
    </div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Teacher review stays in control. Flashcards from confirmed homework mistakes are beta.</p>
  </>
);

const ecosystem = [
  { icon: ClipboardCheck, label: 'Placement' },
  { icon: FileText, label: 'Worksheet' },
  { icon: ClipboardCheck, label: 'Homework' },
  { icon: Layers, label: 'Flashcards' },
  { icon: Play, label: 'Next prep' },
];

const OneMinutePrepHeroProofSwitcher: React.FC = () => (
  <div className="w-full min-w-0">
    <Tabs defaultValue="worksheet" activationMode="manual">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1 sm:grid-cols-4" aria-label="Edooqoo product preview">
        {[
          ['worksheet', 'Worksheet'], ['test', 'Placement Test'], ['homework', 'Homework & Cards'], ['film', '1-Minute Loop'],
        ].map(([id, label]) => <TabsTrigger key={id} value={id} className="h-10 whitespace-normal px-1.5 text-center text-xs leading-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{label}</TabsTrigger>)}
      </TabsList>
      <div className="mt-3 min-h-[640px] border-y border-border bg-card/80 px-4 py-5 sm:min-h-[560px] sm:px-5">
        <TabsContent value="worksheet" className="mt-0"><WorksheetPreview /></TabsContent>
        <TabsContent value="test" className="mt-0"><WelcomeTestPreview /></TabsContent>
        <TabsContent value="homework" className="mt-0"><HomeworkPreview /></TabsContent>
        <TabsContent value="film" className="mt-0">
          <div className="mb-4"><p className="text-xs font-semibold uppercase text-primary">Interactive teacher tour</p><h2 className="mt-1.5 text-xl font-bold leading-tight text-foreground">See the tools work together</h2></div>
          <TeacherFilmPlayer compact />
        </TabsContent>
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
