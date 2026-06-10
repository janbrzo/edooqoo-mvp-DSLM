import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import { Button } from '@/components/ui/button';

type GenerationContextVariant = 'anonymous' | 'authenticated';

interface GenerationContextPanelProps {
  variant: GenerationContextVariant;
}

const panelCopy: Record<GenerationContextVariant, {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
}> = {
  anonymous: {
    eyebrow: 'Account context',
    title: 'A free account turns this from one worksheet into student context.',
    description:
      'The generator can work instantly. 1-Minute Prep becomes useful when Edooqoo can save learner context and reuse it next week.',
    items: [
      'Save the student profile and goals',
      'Send the Welcome Test when you need a stronger baseline',
      'Use homework, flashcards and live worksheet answers as signals',
      'Return next week with context already attached',
    ],
  },
  authenticated: {
    eyebrow: 'Next prep cycle',
    title: 'Make the next worksheet easier to prepare.',
    description:
      'This worksheet can become useful context for the next student-specific prep decision after you teach, assign, or review it.',
    items: [
      'Attach this worksheet to the right student',
      'Add notes after the lesson',
      'Turn selected exercises into homework',
      'Add useful vocabulary to flashcards',
      'Use Next Lesson Ideas before the next worksheet',
    ],
  },
};

const screenshots: Record<GenerationContextVariant, Array<{ src: string; alt: string }>> = {
  anonymous: [
    { src: '/features/welcome-test-profile-ai.png', alt: 'Welcome Test AI profile summary' },
    { src: '/features/one-minute-next-steps.png', alt: '1-Minute Prep next lesson ideas panel' },
    { src: '/features/student-dashboard.png', alt: 'Student Hub dashboard' },
  ],
  authenticated: [
    { src: '/features/one-minute-next-steps.png', alt: '1-Minute Prep next lesson ideas panel' },
    { src: '/features/homework-assignments.png', alt: 'Homework assignments list' },
    { src: '/features/flashcards-sets.png', alt: 'Student flashcard sets' },
  ],
};

const GenerationContextPanel: React.FC<GenerationContextPanelProps> = ({ variant }) => {
  const copy = panelCopy[variant];
  const [primaryScreenshot, ...secondaryScreenshots] = screenshots[variant];

  return (
    <aside className="flex h-full flex-col rounded-lg border border-border bg-secondary/25 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{copy.eyebrow}</p>
        <h3 className="mt-2 text-lg font-semibold leading-tight text-foreground">{copy.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>

      <FeatureScreenshotFrame
        src={primaryScreenshot.src}
        alt={primaryScreenshot.alt}
        imageClassName="h-32"
        objectPosition="center top"
        className="mt-4 rounded-lg shadow-none"
      />

      <div className="mt-4 space-y-2">
        {copy.items.map((item) => (
          <div key={item} className="flex gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="leading-5">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {secondaryScreenshots.map((screenshot) => (
          <FeatureScreenshotFrame
            key={screenshot.src}
            src={screenshot.src}
            alt={screenshot.alt}
            imageClassName="h-20"
            objectPosition="center top"
            className="rounded-lg shadow-none"
          />
        ))}
      </div>

      {variant === 'anonymous' ? (
        <Button asChild className="mt-4 rounded-full">
          <Link to="/signup">
            Create free account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
          Teacher review remains part of the loop. Edooqoo uses saved context to support the next focus, not to replace your decision.
        </p>
      )}
    </aside>
  );
};

export default GenerationContextPanel;
