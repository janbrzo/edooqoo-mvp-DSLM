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
import { Clock, Zap, BarChart3, CheckCircle } from 'lucide-react';

const HomeworkMockup = () => (
  <div className="p-6 space-y-4 text-sm">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold text-foreground">Business English — Unit 3</div>
        <div className="text-xs text-muted-foreground">Julia Kowalski · B2 · Assigned Apr 10</div>
      </div>
      <span className="bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-medium">✓ Completed</span>
    </div>
    <div className="space-y-2">
      {[
        { ex: 'Fill in the gaps — Present Perfect', score: '9/10', status: 'AI graded', color: 'text-green-700 bg-green-50 border-green-200' },
        { ex: 'Vocabulary Matching — Business', score: '7/10', status: 'AI graded', color: 'text-green-700 bg-green-50 border-green-200' },
        { ex: 'Reading Comprehension', score: '8/10', status: 'AI graded', color: 'text-green-700 bg-green-50 border-green-200' },
        { ex: 'Writing Task — Email', score: '6/10', status: 'AI graded', color: 'text-amber-700 bg-amber-50 border-amber-200' },
        { ex: 'Multiple Choice — Grammar', score: '10/10', status: 'Auto-checked', color: 'text-green-700 bg-green-50 border-green-200' },
      ].map(e => (
        <div key={e.ex} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
          <span className="text-xs text-foreground">{e.ex}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${e.color}`}>{e.status}</span>
            <span className="text-xs font-bold text-foreground">{e.score}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between pt-2 border-t border-border">
      <span className="text-xs text-muted-foreground">Overall</span>
      <span className="font-bold text-primary">40/50 (80%)</span>
    </div>
  </div>
);

const benefits = [
  { icon: Clock, title: 'Save 2+ hours per week', description: 'AI grades open-ended answers, vocabulary, grammar, and reading exercises automatically. You review, not correct.' },
  { icon: Zap, title: 'Instant feedback', description: 'Students see their results immediately after submitting. No waiting for the next lesson to know how they did.' },
  { icon: CheckCircle, title: 'Consistent grading', description: 'AI applies the same rubric every time. No more "I was tired, I graded too easy" inconsistency.' },
  { icon: BarChart3, title: 'DSLM integration', description: 'Every graded answer feeds into the student\'s nano-skill mastery profile automatically.' },
];

const steps = [
  { number: 1, title: 'Generate a worksheet', description: 'Create a worksheet for your student with any combination of 29 exercise types. Takes under 60 seconds.' },
  { number: 2, title: 'Assign as homework', description: 'Click "Send as Homework." Set a deadline, add optional notes. Student receives an email with a direct link.' },
  { number: 3, title: 'Student completes it online', description: 'Interactive interface — fill gaps, drag & drop, write essays, record audio. Progress auto-saves.' },
  { number: 4, title: 'AI grades automatically', description: 'Objective exercises are auto-checked. Open-ended answers (writing, explanations) evaluated by AI with detailed feedback.' },
  { number: 5, title: 'You review and adjust', description: 'See all results in one view. Override AI scores if needed. Add teacher comments. Mark as reviewed.' },
];

const faqItems = [
  { question: 'What types of exercises can AI grade?', answer: 'AI grades all 29 exercise types: fill-in-the-gaps, multiple choice, vocabulary matching, reading comprehension, writing tasks, error correction, sentence transformation, and more. Objective exercises are auto-checked instantly. Open-ended answers use AI evaluation with rubric-based scoring.' },
  { question: 'Can I override AI grades?', answer: 'Yes. Every AI-graded answer can be manually adjusted. You can change the score, add comments, and mark corrections. The student sees both the AI evaluation and your adjustments.' },
  { question: 'How does the student receive homework?', answer: 'When you assign homework, the student receives an email with a direct link. They complete it in the browser — no account needed, no app to download. You can set deadlines and enable reminders.' },
  { question: 'Can I track if the student opened the homework?', answer: 'Yes. You see when the student viewed the homework, when they started, and when they submitted. View count and time spent per exercise are tracked.' },
  { question: 'How does homework connect to DSLM?', answer: 'Every graded answer generates learning events that flow into the DSLM model. If a student scores low on Present Perfect exercises, their nano-skill mastery for Present Perfect decreases, and DSLM may suggest focusing on it in the next worksheet.' },
];

const comparisonRows = [
  { feature: 'AI grading of open answers', edooqoo: true, competitors: [false, false] },
  { feature: 'Integrated with worksheet generator', edooqoo: true, competitors: [false, false] },
  { feature: 'Student progress tracking', edooqoo: true, competitors: ['Basic' as string | boolean, false] },
  { feature: 'Email notifications', edooqoo: true, competitors: [true, false] },
  { feature: 'Deadline management', edooqoo: true, competitors: [true, true] },
  { feature: 'No student account needed', edooqoo: true, competitors: [false, false] },
  { feature: 'Nano-skill mastery updates', edooqoo: true, competitors: [false, false] },
];

const FeatureHomework: React.FC = () => (
  <FeaturePageLayout
    title="AI Homework Grading for ESL Teachers — Automatic Evaluation | Edooqoo"
    metaDescription="Assign homework in 30 seconds. AI grades open-ended answers automatically. Students submit online, you review results. Save 2+ hours per week."
  >
    <FeatureHero
      badge="Auto-Grade"
      badgeColor="bg-amber-100 text-amber-700 border-amber-200"
      headline="Assign homework in 30 seconds. AI grades it for you."
      subheadline="Stop spending evenings correcting worksheets. Edooqoo's AI evaluates student answers — including open-ended writing — so you only review, not grade from scratch."
    >
      <HomeworkMockup />
    </FeatureHero>

    <DSLMBadge feature="Homework" description="Every AI-graded answer feeds into the Dynamic Student Learning Model, updating nano-skill mastery scores and enabling data-driven teaching." />

    {/* The Problem */}
    <section className="py-16 bg-background">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">The problem with manual grading</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="text-3xl font-bold text-red-700">10</div>
            <div className="text-xs text-red-600 mt-1">students per week</div>
          </div>
          <div className="p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="text-3xl font-bold text-red-700">×8</div>
            <div className="text-xs text-red-600 mt-1">exercises each</div>
          </div>
          <div className="p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="text-3xl font-bold text-red-700">=80</div>
            <div className="text-xs text-red-600 mt-1">answers to check manually</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-6">With Edooqoo, AI handles the grading. You spend 5 minutes reviewing instead of 2 hours correcting.</p>
      </div>
    </section>

    <FeatureBenefits benefits={benefits} />
    <FeatureSteps steps={steps} />
    <FeatureComparisonTable
      title="Homework grading: Edooqoo vs alternatives"
      competitorNames={['Google Classroom', 'Manual']}
      rows={comparisonRows}
    />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Stop grading manually" subheadline="Let AI handle the corrections. Start with 2 free worksheets." />
    <RelatedFeatures currentPath="/features/homework" />
  </FeaturePageLayout>
);

export default FeatureHomework;
