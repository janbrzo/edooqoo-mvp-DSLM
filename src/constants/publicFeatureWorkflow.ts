import {
  Brain,
  BrainCircuit,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Radio,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type PublicFeatureKey =
  | 'one-minute-prep'
  | 'placement-test'
  | 'dslm'
  | 'homework'
  | 'flashcards'
  | 'live-sessions'
  | 'calendar'
  | 'student-hub';

export interface PublicFeatureWorkflowItem {
  key: PublicFeatureKey;
  label: string;
  path: string;
  icon: LucideIcon;
  phase: 'setup' | 'decision' | 'lesson' | 'access';
  shortRole: string;
  description: string;
}

export const PUBLIC_FEATURE_WORKFLOW: PublicFeatureWorkflowItem[] = [
  {
    key: 'one-minute-prep',
    label: '1-Minute Prep',
    path: '/one-minute-prep',
    icon: Brain,
    phase: 'decision',
    shortRole: 'Weekly prep surface',
    description: 'Uses stored learner context to choose the next focus before worksheet output.',
  },
  {
    key: 'placement-test',
    label: 'Welcome Test',
    path: '/features/placement-test',
    icon: GraduationCap,
    phase: 'setup',
    shortRole: 'Baseline setup',
    description: 'Creates the initial profile, skill baseline, confidence context, and starting evidence.',
  },
  {
    key: 'dslm',
    label: 'DSLM',
    path: '/features/dslm',
    icon: BrainCircuit,
    phase: 'decision',
    shortRole: 'Decision layer',
    description: 'Organizes goals, pacing, roadmap phases, nano-skills, notes, and recent signals.',
  },
  {
    key: 'homework',
    label: 'Homework',
    path: '/features/homework',
    icon: ClipboardCheck,
    phase: 'lesson',
    shortRole: 'Follow-up evidence',
    description: 'Turns selected lesson work into submitted answers, evaluations, and review context.',
  },
  {
    key: 'flashcards',
    label: 'Flashcards',
    path: '/features/flashcards',
    icon: Layers,
    phase: 'lesson',
    shortRole: 'Vocabulary retention',
    description: 'Tracks word/card-level vocabulary practice and SM-2 retention progress per student.',
  },
  {
    key: 'live-sessions',
    label: 'Live Sessions',
    path: '/features/live-sessions',
    icon: Radio,
    phase: 'lesson',
    shortRole: 'Lesson-time capture',
    description: 'Lets students answer shared worksheets while the teacher sees lesson evidence in real time.',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    path: '/features/calendar',
    icon: Calendar,
    phase: 'access',
    shortRole: 'Booking context',
    description: 'Keeps recurring prep tied to confirmed lesson time, cadence, and schedule context.',
  },
  {
    key: 'student-hub',
    label: 'Student Hub',
    path: '/features/student-hub',
    icon: Users,
    phase: 'access',
    shortRole: 'Student workspace',
    description: 'Gives students one place for worksheets, homework, flashcards, bookings, and tests.',
  },
];

export const getPublicFeatureByPath = (pathname: string) =>
  PUBLIC_FEATURE_WORKFLOW.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

