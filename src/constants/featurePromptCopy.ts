/**
 * featurePromptCopy — per-feature copy used in <SignupPromptDialog> shown
 * 2.5s after a teacher clicks a FeatureNavPill on the landing page.
 *
 * Keys MUST match `anchorId` in `src/components/landing/EcosystemSection.tsx`
 * and `src/components/landing/FeatureNavPills.tsx`.
 *
 * Copy is andragogic, concrete, and outcome-oriented (Martha rule: never generic).
 */
export interface FeaturePromptCopy {
  headline: string;
  subline: string;
  cta: string;
}

export const FEATURE_PROMPT_COPY: Record<string, FeaturePromptCopy> = {
  'feature-placement-test': {
    headline: 'Place new students at the right CEFR level — in 12 minutes.',
    subline: 'AI-graded speaking, writing, listening and grammar. No spreadsheets, no guesswork.',
    cta: 'Try Placement Test — Free',
  },
  'feature-homework': {
    headline: 'Send interactive homework that grades itself.',
    subline: 'Auto-corrected exercises, audio answers transcribed, results in your dashboard.',
    cta: 'Create Free Homework',
  },
  'feature-calendar': {
    headline: 'Let students book lessons in your real calendar.',
    subline: 'Two-way Google Calendar sync, automatic reminders, recurring slots.',
    cta: 'Open My Calendar — Free',
  },
  'feature-live-sessions': {
    headline: 'Run 1-on-1 lessons with shared materials in one click.',
    subline: 'Real-time worksheet co-editing, drawing canvas, audio monitoring.',
    cta: 'Start a Live Session — Free',
  },
  'feature-flashcards': {
    headline: 'Spaced-repetition flashcards built from each lesson.',
    subline: 'Auto-generated from your worksheets, with AI translations and audio.',
    cta: 'Get My Flashcards — Free',
  },
  'feature-student-hub': {
    headline: 'One link gives every student their own learning hub.',
    subline: 'No passwords, no apps to install. Worksheets, homework, flashcards in one place.',
    cta: 'Set Up Student Hub — Free',
  },
};

export const DEFAULT_FEATURE_PROMPT: FeaturePromptCopy = {
  headline: 'Want to use this with your students?',
  subline: 'Create a free account — 2 worksheets included, no credit card.',
  cta: 'Start Free',
};