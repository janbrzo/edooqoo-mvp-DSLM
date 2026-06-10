import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Goal,
  Layers,
  Lightbulb,
  Map,
  Radio,
  Send,
  StickyNote,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export interface WorkflowProofStep {
  icon: LucideIcon;
  label: string;
  badge?: string;
  nowrap?: boolean;
}

export const setupWorkflowSteps: WorkflowProofStep[] = [
  { icon: UserPlus, label: 'Add student' },
  { icon: Send, label: 'Send Welcome Test' },
  { icon: Goal, label: 'Add goals' },
  { icon: Map, label: 'Generate Learning Roadmap', nowrap: true },
];

export const weeklyWorkflowSteps: WorkflowProofStep[] = [
  { icon: Lightbulb, label: 'Generate Next Lesson Ideas' },
  { icon: CalendarDays, label: 'Use booking context', badge: 'optional' },
  { icon: CheckCircle2, label: 'Choose one idea' },
  { icon: FileText, label: 'Create a worksheet' },
];

export const lessonSignalWorkflowSteps: WorkflowProofStep[] = [
  { icon: BookOpenCheck, label: 'Welcome Test' },
  { icon: StickyNote, label: 'Teacher notes' },
  { icon: ClipboardCheck, label: 'Homework' },
  { icon: Layers, label: 'Flashcards' },
  { icon: Radio, label: 'Live worksheet answers', nowrap: true },
];

export const lessonSignalWorkflowCopy = {
  eyebrow: 'Lesson-time signal capture',
  title: 'Capture useful signals during the lesson',
  description: 'During the lesson, signals are captured without a separate logging session.',
  supporting:
    'Welcome Test, teacher notes, homework, flashcards and live worksheet answers help Edooqoo collect signals about the student.',
} as const;
