import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureSteps from '@/components/features/FeatureSteps';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import DSLMBadge from '@/components/features/DSLMBadge';
import RelatedFeatures from '@/components/features/RelatedFeatures';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import FeatureWorkflowMap from '@/components/features/FeatureWorkflowMap';
import { ClipboardCheck, Brain, Route, Mic } from 'lucide-react';

const PlacementTestMockup = () => (
  <div className="p-6 md:p-8 space-y-5">
    <div className="flex items-center justify-between text-sm">
      <div>
        <div className="font-semibold text-foreground">Placement Test Results</div>
        <div className="text-xs text-muted-foreground">Anna Chen · Completed Apr 12, 2026</div>
      </div>
      <span className="bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-bold">C1</span>
    </div>

    {/* CEFR Scale */}
    <div className="flex gap-1">
      {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l, i) => (
        <div key={l} className={`flex-1 py-2 rounded-lg text-center text-xs font-semibold border ${i === 4 ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground border-border'}`}>
          {l}
        </div>
      ))}
    </div>

    {/* Skill breakdown */}
    <div className="space-y-2">
      {[
        { skill: 'Grammar', score: 82, level: 'C1' },
        { skill: 'Vocabulary', score: 78, level: 'B2+' },
        { skill: 'Reading', score: 88, level: 'C1' },
        { skill: 'Listening', score: 71, level: 'B2' },
        { skill: 'Speaking', score: 85, level: 'C1' },
      ].map(s => (
        <div key={s.skill} className="flex items-center gap-3">
          <span className="w-20 text-xs text-foreground">{s.skill}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${s.score}%` }} />
          </div>
          <span className="text-xs font-mono text-muted-foreground w-8">{s.score}%</span>
          <span className="text-xs font-semibold text-primary w-8">{s.level}</span>
        </div>
      ))}
    </div>

    {/* AI Summary */}
    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs text-foreground">
      <span className="font-semibold">AI Summary:</span> Strong overall C1 profile with particular strength in reading comprehension. Listening is the weakest area (B2 level). Recommended path: <span className="font-semibold text-primary">Guided</span> — focus on listening skills while maintaining C1 areas.
    </div>
  </div>
);

const benefits = [
  { icon: ClipboardCheck, title: '58-question assessment', description: 'Multi-skill, CEFR-oriented diagnostic covering grammar, vocabulary, reading, listening, and speaking.' },
  { icon: Brain, title: 'AI-generated profile input', description: 'Detailed learning profile with per-skill CEFR indicators, strengths, weaknesses, and pacing context for teacher review.' },
  { icon: Route, title: 'Roadmap starting point', description: 'Results can initialize profile context, skill scores, confidence signals, and a starting point for pacing and roadmap review.' },
  { icon: Mic, title: 'Speaking & listening', description: 'Not just grammar and vocabulary — the test includes audio comprehension and speaking tasks for a complete assessment.' },
];

const steps = [
  { number: 1, title: 'Send the test link', description: 'Generate a unique test link for your new student. They can take it on any device — phone, tablet, or computer.' },
  { number: 2, title: 'Student completes 58 questions', description: '20-30 minutes. Questions cover grammar, vocabulary, reading, listening, and speaking sections across CEFR-oriented difficulty bands.' },
  { number: 3, title: 'AI analyzes results', description: 'AI evaluates answers including open-ended speaking tasks and generates a detailed learning profile for teacher review.' },
  { number: 4, title: 'You review the profile', description: 'See the breakdown: strengths, weaknesses, confidence levels, and starting profile context. Test results become a starting input for DSLM.' },
];

const faqItems = [
  { question: 'How long does the test take?', answer: 'Most students complete it in 20-30 minutes. There are 58 questions across 5 skill areas using a CEFR-oriented diagnostic structure.' },
  { question: 'Does it include speaking and listening?', answer: 'Yes. The listening section uses audio clips. The speaking section includes recording tasks. AI evaluates pronunciation, fluency, and accuracy.' },
  { question: 'Can I customize the test?', answer: 'The placement test uses a standardized 58-question format designed for maximum diagnostic accuracy. You cannot modify questions, but you can supplement results with your own observations through the Student Knowledge system.' },
  { question: 'How does the test connect to DSLM?', answer: 'Test results initialize the student\'s DSLM profile with baseline skill context. This gives Edooqoo a stronger starting point for future worksheet suggestions, while teacher review remains part of the workflow.' },
  { question: 'Can students retake the test?', answer: 'Yes. You can generate a new test link at any time. Retakes update the DSLM profile with fresh data, which is useful for measuring long-term progress.' },
];

const FeaturePlacementTest: React.FC = () => (
  <FeaturePageLayout
    title="AI English Placement Test — 58 Questions, CEFR Assessment | Edooqoo"
    metaDescription="Send a link, student completes 58 questions (grammar, vocabulary, reading, listening, speaking). AI generates a detailed CEFR profile with learning path recommendation."
  >
    <FeatureHero
      badge="58 Questions"
      badgeColor="bg-indigo-100 text-indigo-700 border-indigo-200"
      headline="Know your student's level before the first lesson."
      subheadline="A 58-question AI assessment covering grammar, vocabulary, reading, listening, and speaking. Results become a detailed learning profile and DSLM baseline for teacher review."
    >
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FeatureScreenshotFrame
          src="/features/welcome-test.png"
          alt="Welcome Test question screen with sections and progress"
          caption="Student view: a structured Welcome Test creates the baseline before recurring prep."
          imageClassName="h-72"
          objectPosition="center top"
          loading="eager"
          objectFit="contain"
        />
        <FeatureScreenshotFrame
          src="/features/profile-placement-test-summary.png"
          alt="Placement Test profile summary with level assessment, skill scores, and preferences"
          caption="Teacher view: AI summary, skill scores, self-assessment, and profile context for review."
          imageClassName="h-72"
          objectPosition="center top"
          loading="eager"
          objectFit="contain"
        />
      </div>
    </FeatureHero>

    <FeatureWorkflowMap activeKey="placement-test" />
    <DSLMBadge feature="Placement Test" description="Test results can initialize the student's DSLM profile and provide baseline context before the first recurring prep cycle." />
    <FeatureBenefits benefits={benefits} />
    <FeatureSteps steps={steps} />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Know your students before you teach them" subheadline="Free placement test with AI analysis. No credit card needed." />
    <RelatedFeatures currentPath="/features/placement-test" />
  </FeaturePageLayout>
);

export default FeaturePlacementTest;