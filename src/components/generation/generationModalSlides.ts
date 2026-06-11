import type { LucideIcon } from 'lucide-react';
import {
  lessonSignalWorkflowCopy,
  lessonSignalWorkflowSteps,
  setupWorkflowSteps,
  weeklyWorkflowSteps,
  type WorkflowProofStep,
} from '@/constants/oneMinutePrepWorkflowProof';

export type GenerationContextVariant = 'anonymous' | 'authenticated';

// v6.9.54 — cap items shown in the left WorkflowSummaryCard so the
// "Lesson-time signal capture" slide (5 items) never grows to 3 rows
// and the modal does not require an inner scrollbar on 720p viewports.
export const MAX_LEFT_CARD_ITEMS = 4;

export interface GenerationModalContext {
  eyebrow: string;
  title: string;
  description: string;
  screenshot: {
    src: string;
    alt: string;
    objectPosition?: string;
  };
  items: string[];
  footer?: string;
}

export interface GenerationModalSlide {
  id: string;
  phaseLabel: string;
  phaseTitle: string;
  phaseDescription: string;
  phaseIcon: LucideIcon;
  tone: string;
  eyebrowTone: string;
  items: WorkflowProofStep[];
  contexts: Record<GenerationContextVariant, GenerationModalContext>;
}

export const generationModalSlides: GenerationModalSlide[] = [
  {
    id: 'setup',
    phaseLabel: 'Phase 1: One-time student setup',
    phaseTitle: 'Build the learner context once',
    phaseDescription: 'First setup creates the student profile, goals, and baseline that recurring prep can use.',
    phaseIcon: setupWorkflowSteps[0].icon,
    tone: 'border-violet-200/70 bg-violet-50/80',
    eyebrowTone: 'text-violet-700',
    items: setupWorkflowSteps,
    contexts: {
      anonymous: {
        eyebrow: 'Account context',
        title: 'Save the learner context before next week',
        description:
          'A free account lets Edooqoo keep the student profile, goals, and baseline instead of treating each worksheet as a one-off request.',
        screenshot: {
          src: '/features/welcome-test-profile-ai.png',
          alt: 'Welcome Test AI profile summary',
          objectPosition: 'center top',
        },
        items: [
          'Save the student profile and goals',
          'Send the Welcome Test when you need a stronger baseline',
          'Keep the Learning Roadmap attached to the learner',
        ],
      },
      authenticated: {
        eyebrow: 'Student context',
        title: 'Attach the worksheet to the right student',
        description:
          'Keep generated material connected to the learner record so it can support the next prep decision after the lesson.',
        screenshot: {
          src: '/features/student-dashboard.png',
          alt: 'Student Hub dashboard',
          objectPosition: 'center top',
        },
        items: [
          'Confirm the worksheet belongs to the right student',
          'Keep profile goals and baseline visible',
          'Use the learner record before generating again',
        ],
      },
    },
  },
  {
    id: 'signals',
    phaseLabel: lessonSignalWorkflowCopy.eyebrow,
    phaseTitle: lessonSignalWorkflowCopy.title,
    phaseDescription: lessonSignalWorkflowCopy.description,
    phaseIcon: lessonSignalWorkflowSteps[4].icon,
    tone: 'border-blue-200/70 bg-blue-50/80',
    eyebrowTone: 'text-blue-700',
    items: lessonSignalWorkflowSteps,
    contexts: {
      anonymous: {
        eyebrow: 'Lesson signals',
        title: 'Let lesson activity become useful evidence',
        description:
          'Account context can connect homework, flashcards, teacher notes, and live worksheet answers to the same student over time.',
        screenshot: {
          src: '/features/live-session.png',
          alt: 'Live Session shared worksheet answers',
          objectPosition: 'center top',
        },
        items: [
          'Collect live worksheet answers where supported',
          'Use homework and flashcards as follow-up evidence',
          'Keep teacher notes attached to the learner',
        ],
      },
      authenticated: {
        eyebrow: 'Lesson signals',
        title: 'Turn this lesson into follow-up signals',
        description:
          'After teaching, selected activity can become useful context for the next worksheet instead of staying separate from planning.',
        screenshot: {
          src: '/features/homework-assignments.png',
          alt: 'Homework assignments list',
          objectPosition: 'center top',
        },
        items: [
          'Add notes after the lesson',
          'Turn selected exercises into homework',
          'Add useful vocabulary to flashcards',
        ],
      },
    },
  },
  {
    id: 'weekly',
    phaseLabel: 'Phase 2: Weekly 1-Minute Prep flow',
    phaseTitle: 'Run the recurring prep loop',
    phaseDescription: 'Weekly prep uses stored context to choose the next focus before worksheet output.',
    phaseIcon: weeklyWorkflowSteps[0].icon,
    tone: 'border-emerald-200/70 bg-emerald-50/80',
    eyebrowTone: 'text-emerald-700',
    items: weeklyWorkflowSteps,
    contexts: {
      anonymous: {
        eyebrow: 'Next prep cycle',
        title: 'Return next week with context already attached',
        description:
          'Once the student has saved context, weekly prep can start from the learner record instead of a blank prompt.',
        screenshot: {
          src: '/features/one-minute-next-steps.png',
          alt: '1-Minute Prep next lesson ideas panel',
          objectPosition: 'center top',
        },
        items: [
          'Use Next Lesson Ideas with saved context',
          'Review or edit the suggested focus',
          'Generate the worksheet only after the focus is chosen',
        ],
      },
      authenticated: {
        eyebrow: 'Next prep cycle',
        title: 'Use Next Lesson Ideas before the next worksheet',
        description:
          'The recurring loop is suggestion-first: review the next focus, adjust it if needed, then generate the worksheet output.',
        screenshot: {
          src: '/features/one-minute-next-steps.png',
          alt: '1-Minute Prep next lesson ideas panel',
          objectPosition: 'center top',
        },
        items: [
          'Open Next Lesson Ideas before generating',
          'Use optional booking context when it is relevant',
          'Teacher review remains part of the decision',
        ],
        footer:
          'Teacher review remains part of the loop. Edooqoo uses saved context to support the next focus, not to replace your decision.',
      },
    },
  },
];
