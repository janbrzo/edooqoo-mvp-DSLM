import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import DSLMBadge from '@/components/features/DSLMBadge';
import RelatedFeatures from '@/components/features/RelatedFeatures';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import FeatureWorkflowMap from '@/components/features/FeatureWorkflowMap';
import { Radio, PenTool, Zap, Plus } from 'lucide-react';

const LiveSessionMockup = () => (
  <div className="p-6 space-y-4 text-sm">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold text-foreground">Business English — Unit 3</div>
        <div className="text-xs text-muted-foreground">Julia Kowalski · B2</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 rounded-full px-3 py-1 text-xs font-mono font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          LIVE — 14:32
        </span>
      </div>
    </div>
    {/* Exercise progress */}
    <div className="space-y-2">
      {[
        { name: 'Fill in the gaps — Present Perfect', status: 'done', score: '9/10', time: '3:12' },
        { name: 'Vocabulary Matching', status: 'done', score: '7/10', time: '2:45' },
        { name: 'Reading Comprehension', status: 'active', score: '—', time: '4:02' },
        { name: 'Writing Task', status: 'upcoming', score: '', time: '' },
      ].map(ex => (
        <div key={ex.name} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
          ex.status === 'active' ? 'bg-primary/5 border-primary/30' :
          ex.status === 'done' ? 'bg-muted/40 border-border' :
          'bg-muted/20 border-transparent'
        }`}>
          <div className="flex items-center gap-2">
            {ex.status === 'active' && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
            {ex.status === 'done' && <span className="text-green-600">✓</span>}
            {ex.status === 'upcoming' && <span className="text-muted-foreground/40">○</span>}
            <span className={`text-xs ${ex.status === 'upcoming' ? 'text-muted-foreground/60' : 'text-foreground'}`}>{ex.name}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {ex.time && <span className="text-muted-foreground font-mono">{ex.time}</span>}
            {ex.score && <span className="font-bold">{ex.score}</span>}
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
      <span className="text-muted-foreground">Running score</span>
      <span className="font-bold text-primary">16/20 (80%)</span>
    </div>
  </div>
);

const benefits = [
  { icon: Radio, title: 'Real-time monitoring', description: 'See student answers as they type. Timer per exercise. Running score updates live.' },
  { icon: Plus, title: 'Flexible lesson flow', description: 'Use the worksheet as a live teaching surface and respond to what the student does during the lesson.' },
  { icon: PenTool, title: 'Drawing canvas', description: 'Annotate worksheets during online lessons. Circle errors, underline patterns, draw diagrams.' },
  { icon: Zap, title: 'AI-assisted review', description: 'Open-ended answers can receive AI-assisted evaluation where supported, with teacher review before conclusions.' },
];

const faqItems = [
  { question: 'What is Live Session mode?', answer: 'Live Session transforms any worksheet into a real-time teaching tool. You start a session, and the student works through exercises one by one. You see their answers in real-time, with a timer per exercise and a running score.' },
  { question: 'Can I adapt during the lesson?', answer: 'Yes. Live Session gives you a shared worksheet surface, real-time answers, drawing tools, and review context so you can adjust how you teach the material during the lesson.' },
  { question: 'What is the drawing canvas?', answer: 'The drawing canvas lets you annotate the worksheet during online lessons — circle errors, underline patterns, draw diagrams. Essential for screen-sharing during Zoom/Meet lessons.' },
  { question: 'How does Live Session connect to DSLM?', answer: 'Live answers, teacher notes, and supported evaluation signals can inform future prep. Edooqoo uses available lesson signals as context, while teacher review remains responsible for final lesson decisions.' },
];

const FeatureLiveSessions: React.FC = () => (
  <FeaturePageLayout
    title="Interactive Live Worksheet Sessions for ESL — Real-Time Teaching | Edooqoo"
    metaDescription="Teach live with real-time student answer monitoring, timer per exercise, drawing canvas, and AI-assisted review where supported."
  >
    <FeatureHero
      badge="LIVE"
      badgeColor="bg-red-100 text-red-700 border-red-200"
      headline="Teach live. Capture lesson-time evidence."
      subheadline="Turn any worksheet into an interactive lesson. Monitor student answers live, annotate with drawing tools, review responses, and keep shared worksheet signals visible for future prep."
    >
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FeatureScreenshotFrame
          src="/features/live-session.png"
          alt="Live Session teacher worksheet with answer evidence and nano-skill tooltip"
          caption="Teacher view: student answers, nano-skill labels, notes, flashcards, and live lesson actions stay in one surface."
          imageClassName="h-72"
          objectPosition="center top"
          loading="eager"
        />
        <FeatureScreenshotFrame
          src="/features/shared-worksheet-2.png"
          alt="Shared worksheet student view with progress and lesson content"
          caption="Student view: shared worksheets can be completed online while progress is saved."
          imageClassName="h-72"
          objectPosition="center top"
          loading="eager"
        />
      </div>
    </FeatureHero>

    <FeatureWorkflowMap activeKey="live-sessions" />
    <DSLMBadge feature="Live Sessions" description="Live answers and teacher review signals can become context for future DSLM next-focus suggestions and the next prep cycle." />
    <FeatureBenefits benefits={benefits} />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Make every lesson interactive" subheadline="Real-time teaching tools. Start with 2 free worksheets." />
    <RelatedFeatures currentPath="/features/live-sessions" />
  </FeaturePageLayout>
);

export default FeatureLiveSessions;
