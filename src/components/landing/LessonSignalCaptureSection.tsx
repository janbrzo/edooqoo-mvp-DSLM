import React from 'react';
import {
  BookOpenCheck,
  ClipboardCheck,
  Layers,
  Radio,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const lessonSignalItems = [
  {
    title: 'Live Session answers',
    description:
      'Students complete a shared worksheet while the teacher sees answers update in real time. Worksheet answers can store item evaluations, mastery-like scores, audio answers, active time, and AI-evaluation state where supported.',
    icon: Radio,
  },
  {
    title: 'Homework from the lesson',
    description:
      'The teacher can turn selected lesson exercises or generated follow-up exercises into homework and send it to the student. Submitted homework stores answers, item evaluations, mastery, AI-assisted review for supported open answers, and a homework_submitted event.',
    icon: ClipboardCheck,
  },
  {
    title: 'Teacher notes',
    description:
      'The teacher can add skill observations, goals, personal context, and next-lesson ideas during the lesson. Notes are stored as student knowledge entries and can be AI-classified with tags, nano_skill metadata, and mastery when detected.',
    icon: StickyNote,
  },
  {
    title: 'Flashcards',
    description:
      'The teacher can add vocabulary to flashcards and share sets with the student. Each word/card can act as a vocabulary nano-skill context item while student reviews update SM-2 retention progress, due dates, response time, quality rating, and mistake counts.',
    icon: Layers,
  },
];

interface LessonSignalCaptureSectionProps {
  className?: string;
  compact?: boolean;
}

const LessonSignalCaptureSection: React.FC<LessonSignalCaptureSectionProps> = ({
  className,
  compact = false,
}) => (
  <section className={cn('space-y-6', className)} aria-labelledby="lesson-signal-capture-heading">
    <div className={compact ? 'max-w-3xl' : 'max-w-4xl'}>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <BookOpenCheck className="h-3.5 w-3.5" />
        Lesson-time signal capture
      </div>
      <h2 id="lesson-signal-capture-heading" className={cn('font-bold text-foreground', compact ? 'text-2xl' : 'text-2xl sm:text-3xl')}>
        During the lesson, signals are captured without a separate logging session
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
        When the teacher uses Edooqoo during a normal lesson, teaching actions can add evidence for the next prep cycle.
      </p>
    </div>

    <div className={cn('grid gap-4', compact ? 'md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4')}>
      {lessonSignalItems.map(({ title, description, icon: Icon }) => (
        <article key={title} className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </article>
      ))}
    </div>

    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
      Flashcard study supplies word/card-level vocabulary retention context. Teacher review remains part of the loop.
    </div>
  </section>
);

export default LessonSignalCaptureSection;
