import React from 'react';
import {
  UserPlus,
  Send,
  Target,
  Map,
  BookOpen,
  FileText,
  ClipboardCheck,
  Layers,
  Radio,
  Lightbulb,
  Calendar,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * v6.9.51 — Compact 3-phase workflow card rendered inside `GeneratingModal`
 * to fill the empty space below the "Expected time" line and visualise the
 * full 1-Minute Prep loop (one-time setup → lesson signals → weekly prep).
 * Presentational only. No props beyond `className`.
 */
interface WorkflowSummaryCardProps {
  className?: string;
}

type Item = { icon: React.ComponentType<{ className?: string }>; label: string; badge?: string };

type Column = {
  eyebrow: string;
  title: string;
  description: string;
  items: Item[];
  tone: string;
  eyebrowTone: string;
};

const columns: Column[] = [
  {
    eyebrow: 'Phase 1 · One-time student setup',
    title: 'Set up the student',
    description: 'First setup creates the student context recurring prep can use.',
    items: [
      { icon: UserPlus, label: 'Add student' },
      { icon: Send, label: 'Send Welcome Test' },
      { icon: Target, label: 'Add goals' },
      { icon: Map, label: 'Generate Learning Roadmap' },
    ],
    tone: 'bg-violet-50/70 border-violet-200/60',
    eyebrowTone: 'text-violet-700',
  },
  {
    eyebrow: 'Lesson-time signal capture',
    title: 'Capture signals during the lesson',
    description: 'Signals are captured automatically during the lesson.',
    items: [
      { icon: BookOpen, label: 'Welcome Test' },
      { icon: FileText, label: 'Teacher notes' },
      { icon: ClipboardCheck, label: 'Homework' },
      { icon: Layers, label: 'Flashcards' },
      { icon: Radio, label: 'Live worksheet answers' },
    ],
    tone: 'bg-blue-50/70 border-blue-200/60',
    eyebrowTone: 'text-blue-700',
  },
  {
    eyebrow: 'Phase 2 · Weekly 1-Minute Prep',
    title: 'Weekly 1-Minute Prep flow',
    description: 'Weekly prep uses stored context to decide the next focus.',
    items: [
      { icon: Lightbulb, label: 'Generate Next Lesson Ideas' },
      { icon: Calendar, label: 'Use booking context', badge: 'OPTIONAL' },
      { icon: CheckCircle2, label: 'Choose one idea' },
      { icon: FileEdit, label: 'Create a worksheet' },
    ],
    tone: 'bg-emerald-50/70 border-emerald-200/60',
    eyebrowTone: 'text-emerald-700',
  },
];

const WorkflowSummaryCard: React.FC<WorkflowSummaryCardProps> = ({ className }) => {
  return (
    <div className={cn('grid grid-cols-3 gap-2 items-stretch', className)}>
      {columns.map((col) => (
        <div
          key={col.eyebrow}
          className={cn('flex flex-col rounded-lg border p-2', col.tone)}
        >
          <p
            className={cn(
              'text-[9px] font-semibold uppercase tracking-widest leading-tight',
              col.eyebrowTone
            )}
          >
            {col.eyebrow}
          </p>
          <h4 className="mt-1 text-[11px] font-semibold leading-tight text-foreground">
            {col.title}
          </h4>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {col.description}
          </p>
          <div className="mt-2 space-y-1">
            {col.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-1.5 py-1"
                >
                  <Icon className="h-3 w-3 shrink-0 text-primary" />
                  <span className="flex-1 text-[10px] leading-tight text-foreground truncate">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-violet-700">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkflowSummaryCard;