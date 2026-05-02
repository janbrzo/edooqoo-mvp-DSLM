import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import DSLMBadge from '@/components/features/DSLMBadge';
import RelatedFeatures from '@/components/features/RelatedFeatures';
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
  { icon: Plus, title: 'Add exercises on-the-fly', description: 'Need an extra practice? Add exercises during the lesson without interrupting the flow.' },
  { icon: PenTool, title: 'Drawing canvas', description: 'Annotate worksheets during online lessons. Circle errors, underline patterns, draw diagrams.' },
  { icon: Zap, title: 'Instant AI evaluation', description: 'Open-ended answers get AI feedback in real-time. Discuss results with the student immediately.' },
];

const faqItems = [
  { question: 'What is Live Session mode?', answer: 'Live Session transforms any worksheet into a real-time teaching tool. You start a session, and the student works through exercises one by one. You see their answers in real-time, with a timer per exercise and a running score.' },
  { question: 'Can I add exercises during the lesson?', answer: 'Yes. If you notice a student needs more practice on a specific area, you can add exercises on-the-fly without leaving the session. The new exercise appears immediately in the student\'s view.' },
  { question: 'What is the drawing canvas?', answer: 'The drawing canvas lets you annotate the worksheet during online lessons — circle errors, underline patterns, draw diagrams. Essential for screen-sharing during Zoom/Meet lessons.' },
  { question: 'How does Live Session connect to DSLM?', answer: 'Every answer submitted during a live session generates immediate learning events. Unlike homework (which may take days), live session data updates the student\'s DSLM profile in real-time — you see skill changes during the lesson.' },
];

const FeatureLiveSessions: React.FC = () => (
  <FeaturePageLayout
    title="Interactive Live Worksheet Sessions for ESL — Real-Time Teaching | Edooqoo"
    metaDescription="Teach live with real-time student answer monitoring. Timer per exercise, on-the-fly exercise addition, drawing canvas, and instant AI evaluation."
  >
    <FeatureHero
      badge="LIVE"
      badgeColor="bg-red-100 text-red-700 border-red-200"
      headline="Teach live. See answers in real-time."
      subheadline="Turn any worksheet into an interactive lesson. Monitor student answers live, add exercises on-the-fly, annotate with drawing tools — all in real-time."
    >
      <LiveSessionMockup />
    </FeatureHero>

    <DSLMBadge feature="Live Sessions" description="Live session answers generate immediate DSLM updates — skill changes happen in real-time during the lesson." />
    <FeatureBenefits benefits={benefits} />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Make every lesson interactive" subheadline="Real-time teaching tools. Start with 2 free worksheets." />
    <RelatedFeatures currentPath="/features/live-sessions" />
  </FeaturePageLayout>
);

export default FeatureLiveSessions;
