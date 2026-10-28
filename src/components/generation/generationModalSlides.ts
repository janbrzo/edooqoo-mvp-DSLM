import type { LucideIcon } from 'lucide-react';
import {
  Brain, Zap, Target, Clock3, NotebookPen, ChartNoAxesCombined,
  ClipboardList, MessageSquareText, Lightbulb, RotateCcw, ShieldCheck,
} from 'lucide-react';

export type GenerationContextVariant = 'anonymous' | 'authenticated';

export const GENERATION_SLIDE_INTERVAL_MS = 8000;

export interface GenerationModalBenefit {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface GenerationModalContext {
  eyebrow: string;
  title: string;
  screenshot: {
    src: string;
    alt: string;
    objectPosition?: string;
  };
  items: GenerationModalBenefit[];
}

export interface GenerationModalSlide {
  id: string;
  contexts: Record<GenerationContextVariant, GenerationModalContext>;
}

const radarPreview = {
  src: '/features/skills-heat-map.png',
  alt: 'Example learner skill radar and category mastery',
  objectPosition: 'center bottom',
};
const nextPrepPreview = {
  src: '/features/one-minute-next-steps.png',
  alt: 'Example next lesson suggestion with a teacher-reviewed focus',
  objectPosition: 'center top',
};

export const generationModalSlides: GenerationModalSlide[] = [
  {
    id: 'memory-and-follow-up',
    contexts: {
      anonymous: {
        eyebrow: 'EDOOQOO DSLM',
        title: 'A worksheet is just 10% of 1-minute prep.',
        screenshot: radarPreview,
        items: [
          { icon: Brain, title: 'Smart Memory', text: 'Keep weak points and grammar practice in one learner record.' },
          { icon: Zap, title: 'Next Lesson in 60s', text: 'Start from saved results, then choose your next focus.' },
        ],
      },
      authenticated: {
        eyebrow: 'NEXT STEPS',
        title: 'Close the loop after this lesson',
        screenshot: {
          src: '/features/homework-assignments.png',
          alt: 'Example interactive homework assignments and completion status',
          objectPosition: 'center top',
        },
        items: [
          { icon: ClipboardList, title: 'Assign Homework', text: 'Turn selected exercises into interactive homework.' },
          { icon: MessageSquareText, title: 'Capture Signals', text: 'Evaluated student answers feed the learning record.' },
          { icon: Zap, title: '1-Minute Next Prep', text: 'Choose Next Lesson Ideas instead of starting from scratch.' },
        ],
      },
    },
  },
  {
    id: 'next-prep-and-retention',
    contexts: {
      anonymous: {
        eyebrow: 'CONTINUOUS ADAPTATION',
        title: 'Never start planning from a blank page again.',
        screenshot: nextPrepPreview,
        items: [
          { icon: Target, title: 'A Clear Next Focus', text: 'Review lesson ideas informed by your learner\'s progress.' },
          { icon: Clock3, title: 'Less Prep, More Teaching', text: 'Adjust the idea, then generate your materials.' },
        ],
      },
      authenticated: {
        eyebrow: 'DSLM KNOWLEDGE RETENTION',
        title: 'Track what fades before next week',
        screenshot: radarPreview,
        items: [
          { icon: Brain, title: 'Check Retention', text: 'Compare saved mastery with estimated retention.' },
          { icon: NotebookPen, title: 'Quick Class Notes', text: 'Save spoken errors and observations to the learner profile.' },
          { icon: RotateCcw, title: 'Targeted Review', text: 'Choose a skill that needs practice for your next lesson.' },
        ],
      },
    },
  },
  {
    id: 'learner-record-and-authority',
    contexts: {
      anonymous: {
        eyebrow: 'THE COMPLETE ECOSYSTEM',
        title: 'Connect homework, notes, and progress in one profile.',
        screenshot: {
          src: '/features/welcome-test-profile-ai.png',
          alt: 'Example learner profile with skill results',
          objectPosition: 'center bottom',
        },
        items: [
          { icon: ClipboardList, title: 'Interactive Homework', text: 'Keep practice connected to the same learner.' },
          { icon: ChartNoAxesCombined, title: 'Visible Progress', text: 'Bring results, goals, and class notes together.' },
        ],
      },
      authenticated: {
        eyebrow: 'RECURRING PREP ENGINE',
        title: 'Your next lesson starts with what you already know',
        screenshot: nextPrepPreview,
        items: [
          { icon: Lightbulb, title: 'Evidence-Based Ideas', text: 'Review the saved signals supporting a suggested focus.' },
          { icon: ShieldCheck, title: 'Your Decision', text: 'Accept, adjust, or replace the suggested topic.' },
          { icon: Zap, title: '1-Minute Execution', text: 'Use the chosen idea to prefill the next worksheet.' },
        ],
      },
    },
  },
];
