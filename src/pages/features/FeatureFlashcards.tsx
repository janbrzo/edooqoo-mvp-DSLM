import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureSteps from '@/components/features/FeatureSteps';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import DSLMBadge from '@/components/features/DSLMBadge';
import RelatedFeatures from '@/components/features/RelatedFeatures';
import FeatureComparisonTable from '@/components/features/FeatureComparisonTable';
import { Brain, Repeat, Zap, Link2 } from 'lucide-react';

const FlashcardHeroMockup = () => (
  <div className="p-6 md:p-8">
    <div className="max-w-md mx-auto">
      <div className="text-xs text-muted-foreground mb-3 flex items-center justify-between">
        <span>Business English · B2 · Julia Kowalski</span>
        <span className="font-mono">Card 5 / 24</span>
      </div>
      {/* Card stack */}
      <div className="relative h-48">
        <div className="absolute inset-x-4 top-6 bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-primary/60 mb-2">Translation</div>
          <div className="text-lg font-semibold text-primary">to explain in great detail; to give more information</div>
        </div>
        <div className="absolute inset-x-0 top-0 bg-card border border-border rounded-2xl p-6 shadow-lg">
          <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
            <span>Vocabulary · B2</span>
            <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium">tap to flip</span>
          </div>
          <div className="text-xl font-bold text-foreground">elaborate</div>
          <div className="text-sm text-muted-foreground italic mt-2">"Could you elaborate on that point?"</div>
          <div className="flex items-center gap-2 mt-4">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '72%' }} />
            </div>
            <span className="text-xs text-muted-foreground">72% mastery</span>
          </div>
        </div>
      </div>
      {/* Rating buttons */}
      <div className="flex gap-2 mt-6">
        {[
          { label: 'Again', color: 'bg-red-100 text-red-700 border-red-200' },
          { label: 'Hard', color: 'bg-amber-100 text-amber-700 border-amber-200' },
          { label: 'Good', color: 'bg-green-100 text-green-700 border-green-200' },
          { label: 'Easy', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        ].map(b => (
          <button key={b.label} className={`flex-1 py-2 rounded-lg border text-xs font-medium ${b.color}`}>{b.label}</button>
        ))}
      </div>
    </div>
  </div>
);

const ForgettingCurveDiagram = () => (
  <div className="max-w-lg mx-auto">
    <svg viewBox="0 0 400 180" className="w-full">
      <text x="10" y="15" className="fill-foreground text-[10px] font-medium">Memory Retention</text>
      {/* Axes */}
      <line x1="40" y1="20" x2="40" y2="160" stroke="hsl(var(--border))" strokeWidth="1" />
      <line x1="40" y1="160" x2="390" y2="160" stroke="hsl(var(--border))" strokeWidth="1" />
      {/* Without review — steep decline */}
      <path d="M40,30 Q100,90 180,140 Q250,155 390,158" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" strokeDasharray="4" />
      <text x="300" y="150" className="fill-destructive text-[9px]">Without review</text>
      {/* With SM-2 — sawtooth pattern */}
      <path d="M40,30 L80,70 L80,35 L130,75 L130,38 L200,72 L200,40 L290,68 L290,42 L390,58" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      <text x="300" y="50" className="fill-primary text-[9px] font-medium">With SM-2</text>
      {/* Labels */}
      <text x="40" y="175" className="fill-muted-foreground text-[8px]">Day 1</text>
      <text x="200" y="175" className="fill-muted-foreground text-[8px]">Day 14</text>
      <text x="370" y="175" className="fill-muted-foreground text-[8px]">Day 60</text>
    </svg>
  </div>
);

const benefits = [
  { icon: Brain, title: 'SM-2 scheduling logic', description: 'Spaced-repetition scheduling based on SM-2 logic. Cards the student struggles with appear more often.' },
  { icon: Repeat, title: 'Auto-generated from worksheets', description: 'One click creates a flashcard set from any worksheet. Vocabulary, key phrases, grammar patterns — extracted automatically.' },
  { icon: Link2, title: 'Ecosystem integration', description: 'Flashcard performance can become a vocabulary signal for DSLM and future prep decisions.' },
  { icon: Zap, title: 'Student Hub access', description: 'Students study through their Hub — no app needed. Share via link. Track progress in real-time.' },
];

const steps = [
  { number: 1, title: 'Generate a worksheet', description: 'Create any worksheet with vocabulary, grammar, or mixed exercises.' },
  { number: 2, title: 'Create flashcards with one click', description: 'Click "Create Flashcards" — Edooqoo extracts key vocabulary and creates a set automatically. You can edit, add, or remove cards.' },
  { number: 3, title: 'Share with the student', description: 'Send a link or let students access through Student Hub. No account needed — just email-based access.' },
  { number: 4, title: 'SM-2 schedules reviews', description: 'Students rate difficulty (Again/Hard/Good/Easy), and the system schedules harder cards more frequently.' },
];

const faqItems = [
  { question: 'What is the SM-2 algorithm?', answer: 'SM-2 (SuperMemo 2) is a spaced repetition algorithm developed by Piotr Wozniak. It schedules review intervals from the student\'s previous performance: easier cards appear less frequently, and harder cards appear more often.' },
  { question: 'Can I create flashcards manually?', answer: 'Yes. While auto-generation from worksheets is the fastest method, you can also create cards manually. Set the front text, back text, example sentence, and CEFR level for each card.' },
  { question: 'Do students need an account?', answer: 'No. Students access flashcards through a shared link or their Student Hub. Access is email-based — no registration, no password, no app to install.' },
  { question: 'Can flashcards be bidirectional?', answer: 'Yes. You can enable bidirectional mode so students practice both directions: English → translation and translation → English. Each direction is tracked separately in the SM-2 algorithm.' },
  { question: 'How do flashcards connect to DSLM?', answer: 'Flashcard reviews can generate vocabulary learning signals. If a student repeatedly struggles with business collocations, that signal can support more relevant future prep and worksheet suggestions.' },
];

const comparisonRows = [
  { feature: 'Auto-generate from teaching content', edooqoo: true, competitors: [false, false] },
  { feature: 'SM-2 spaced repetition', edooqoo: true, competitors: [true, false] },
  { feature: 'Integrated with student progress tracking', edooqoo: true, competitors: [false, false] },
  { feature: 'Teacher can share sets per student', edooqoo: true, competitors: ['Manual' as string | boolean, true] },
  { feature: 'No student app/account needed', edooqoo: true, competitors: [false, false] },
  { feature: 'CEFR-tagged cards', edooqoo: true, competitors: [false, false] },
  { feature: 'Bidirectional practice', edooqoo: true, competitors: [true, true] },
];

const FeatureFlashcards: React.FC = () => (
  <FeaturePageLayout
    title="SM-2 Spaced Repetition Flashcards for ESL — Edooqoo"
    metaDescription="Auto-generate flashcards from any worksheet. SM-2 spaced repetition algorithm. Integrated with student progress tracking. No student app needed."
  >
    <FeatureHero
      badge="SM-2"
      badgeColor="bg-violet-100 text-violet-700 border-violet-200"
      headline="Vocabulary review that feeds future prep."
      subheadline="Auto-generate flashcard sets from any worksheet. Students study through their Hub with SM-2 scheduling logic, and review activity can become a vocabulary signal for DSLM."
    >
      <FlashcardHeroMockup />
    </FeatureHero>

    <DSLMBadge feature="Flashcards" description="Flashcard performance can add vocabulary signals to DSLM, helping future worksheet suggestions reflect what the student actually reviews." />

    {/* Forgetting curve */}
    <section className="py-16 bg-background">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">Why spaced repetition works</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Spaced repetition helps students revisit difficult cards more often and keep vocabulary active between lessons.</p>
        <ForgettingCurveDiagram />
      </div>
    </section>

    <FeatureBenefits benefits={benefits} />
    <FeatureSteps steps={steps} />
    <FeatureComparisonTable
      title="Flashcards: Edooqoo vs alternatives"
      competitorNames={['Anki', 'Quizlet']}
      rows={comparisonRows}
    />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Build vocabulary continuity between lessons" subheadline="Auto-generate flashcards from your worksheets and use review signals for future prep. Start free." />
    <RelatedFeatures currentPath="/features/flashcards" />
  </FeaturePageLayout>
);

export default FeatureFlashcards;
