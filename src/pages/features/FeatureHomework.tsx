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
        { ex: 'Fill in the gaps — Present Perfect', score: '9/10', status: 'Checked', color: 'text-green-700 bg-green-50 border-green-200' },
        { ex: 'Vocabulary Matching — Business', score: '7/10', status: 'Checked', color: 'text-green-700 bg-green-50 border-green-200' },
        { ex: 'Reading Comprehension', score: '8/10', status: 'Reviewed', color: 'text-green-700 bg-green-50 border-green-200' },
        { ex: 'Writing Task — Email', score: '6/10', status: 'AI-assisted', color: 'text-amber-700 bg-amber-50 border-amber-200' },
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
  { icon: Clock, title: 'Structured review workflow', description: 'AI can pre-evaluate open-ended answers, vocabulary, grammar, and reading exercises. You review and confirm results.' },
  { icon: Zap, title: 'Instant feedback', description: 'Students see their results immediately after submitting. No waiting for the next lesson to know how they did.' },
  { icon: CheckCircle, title: 'Consistent review support', description: 'AI-assisted scoring gives you a first pass to review, adjust, and confirm with your professional judgement.' },
  { icon: BarChart3, title: 'DSLM integration', description: 'Reviewed homework results can become learning signals for the next prep cycle.' },
];

const steps = [
  { number: 1, title: 'Generate a worksheet', description: 'Create a worksheet for your student with any combination of 29 exercise types, then review it before assignment.' },
  { number: 2, title: 'Assign as homework', description: 'Click "Send as Homework." Set a deadline, add optional notes. Student receives an email with a direct link.' },
  { number: 3, title: 'Student completes it online', description: 'Interactive interface — fill gaps, drag & drop, write essays, record audio. Progress auto-saves.' },
  { number: 4, title: 'AI assists evaluation', description: 'Objective exercises can be auto-checked. Open-ended answers can receive AI-assisted feedback for teacher review.' },
  { number: 5, title: 'You review and adjust', description: 'See all results in one view. Override AI scores if needed. Add teacher comments. Mark as reviewed.' },
];

const faqItems = [
  { question: 'What types of exercises can AI help evaluate?', answer: 'Objective exercises can be auto-checked. Open-ended answers such as writing, explanations, sentence transformation, and discussion responses can use AI-assisted evaluation with rubric-based scoring for teacher review.' },
  { question: 'Can I override AI-assisted scores?', answer: 'Yes. Every AI-assisted score can be manually adjusted. You can change the score, add comments, and mark corrections. The student sees both the AI evaluation and your adjustments.' },
  { question: 'How does the student receive homework?', answer: 'When you assign homework, the student receives an email with a direct link. They complete it in the browser — no account needed, no app to download. You can set deadlines and enable reminders.' },
  { question: 'Can I track if the student opened the homework?', answer: 'Yes. You see when the student viewed the homework, when they started, and when they submitted. View count and time spent per exercise are tracked.' },
  { question: 'How does homework connect to DSLM?', answer: 'Reviewed homework results can generate learning signals for DSLM. If a student struggles with Present Perfect exercises, that signal can help Edooqoo suggest a more relevant next worksheet focus.' },
];

const comparisonRows = [
  { feature: 'AI-assisted open-answer review', edooqoo: true, competitors: [false, false] },
  { feature: 'Integrated with worksheet generator', edooqoo: true, competitors: [false, false] },
  { feature: 'Student progress tracking', edooqoo: true, competitors: ['Basic' as string | boolean, false] },
  { feature: 'Email notifications', edooqoo: true, competitors: [true, false] },
  { feature: 'Deadline management', edooqoo: true, competitors: [true, true] },
  { feature: 'No student account needed', edooqoo: true, competitors: [false, false] },
  { feature: 'Nano-skill mastery updates', edooqoo: true, competitors: [false, false] },
];

const FeatureHomework: React.FC = () => (
  <FeaturePageLayout
    title="AI-Assisted Homework Review for ESL Teachers | Edooqoo"
    metaDescription="Assign homework, let students submit online, and review AI-assisted evaluations of open-ended answers in Edooqoo."
  >
    <FeatureHero
      badge="Review"
      badgeColor="bg-amber-100 text-amber-700 border-amber-200"
      headline="Assign homework and review AI-assisted evaluation."
      subheadline="Edooqoo supports homework submission, AI-assisted answer evaluation, and teacher review for open-ended writing and structured exercises."
    >
      <HomeworkMockup />
    </FeatureHero>

    <DSLMBadge feature="Homework" description="Reviewed homework results can feed the Dynamic Student Learning Model, giving Edooqoo more context for the next prep cycle." />

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
        <p className="text-sm text-muted-foreground mt-6">With Edooqoo, AI-assisted evaluation gives teachers a review surface instead of a blank correction workflow.</p>
      </div>
    </section>

    <FeatureBenefits benefits={benefits} />
    <FeatureSteps steps={steps} />
    <FeatureComparisonTable
      title="Homework review: Edooqoo vs alternatives"
      competitorNames={['Google Classroom', 'Manual']}
      rows={comparisonRows}
    />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Review homework faster" subheadline="Use AI-assisted evaluation, teacher review, and student signals for the next prep cycle. Start with 2 free worksheets." />
    <RelatedFeatures currentPath="/features/homework" />
  </FeaturePageLayout>
);

export default FeatureHomework;
