import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureSteps from '@/components/features/FeatureSteps';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import RelatedFeatures from '@/components/features/RelatedFeatures';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, Target, Layers, BookCheck, Layers3, CalendarDays, Radio, ClipboardCheck, GraduationCap, ArrowRight } from 'lucide-react';

/* ─── Inline Mockups ─── */

const RadarChartMockup = () => {
  const skills = [
    { name: 'Grammar', value: 72, angle: 0 },
    { name: 'Vocabulary', value: 85, angle: 60 },
    { name: 'Reading', value: 68, angle: 120 },
    { name: 'Writing', value: 55, angle: 180 },
    { name: 'Speaking', value: 78, angle: 240 },
    { name: 'Listening', value: 63, angle: 300 },
  ];
  const cx = 120, cy = 120, r = 90;
  const points = skills.map(s => {
    const a = (s.angle - 90) * Math.PI / 180;
    const v = s.value / 100;
    return `${cx + r * v * Math.cos(a)},${cy + r * v * Math.sin(a)}`;
  }).join(' ');
  const labels = skills.map(s => {
    const a = (s.angle - 90) * Math.PI / 180;
    return { x: cx + (r + 20) * Math.cos(a), y: cy + (r + 20) * Math.sin(a), name: s.name, value: s.value };
  });

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 240 240" className="w-56 h-56">
        {[0.25, 0.5, 0.75, 1].map(s => (
          <polygon key={s} points={skills.map(sk => {
            const a = (sk.angle - 90) * Math.PI / 180;
            return `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`;
          }).join(' ')} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
        ))}
        <polygon points={points} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="2" />
        {labels.map(l => (
          <text key={l.name} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[8px] font-medium">
            {l.name} ({l.value}%)
          </text>
        ))}
      </svg>
    </div>
  );
};

const NanoSkillsMockup = () => {
  const skills = [
    { name: 'Present Perfect vs Past Simple', mastery: 85, trend: '↑', trendColor: 'text-green-600' },
    { name: 'Conditional Type 2', mastery: 42, trend: '↓', trendColor: 'text-red-500' },
    { name: 'Business collocations', mastery: 71, trend: '→', trendColor: 'text-muted-foreground' },
    { name: 'Passive voice', mastery: 63, trend: '↑', trendColor: 'text-green-600' },
    { name: 'Email writing structure', mastery: 38, trend: '↑', trendColor: 'text-green-600' },
    { name: 'Reported speech', mastery: 22, trend: '↓', trendColor: 'text-red-500' },
  ];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-muted-foreground font-medium px-1">
        <span>Nano-skill</span>
        <span>Mastery</span>
      </div>
      {skills.map(s => (
        <div key={s.name} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
          <span className="flex-1 text-foreground text-[11px]">{s.name}</span>
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${s.mastery}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-foreground w-8 text-right">{s.mastery}%</span>
          <span className={`text-sm font-bold ${s.trendColor}`}>{s.trend}</span>
        </div>
      ))}
    </div>
  );
};

const LayersDiagram = () => {
  const layers = [
    { letter: 'A', name: 'Event Log', desc: 'Raw learning events from homework, flashcards, live sessions, tests', color: 'bg-blue-100 border-blue-300 text-blue-800' },
    { letter: 'B', name: 'Metrics Engine', desc: 'Nano-skill mastery scores, trend detection, forgetting curves', color: 'bg-green-100 border-green-300 text-green-800' },
    { letter: 'C', name: 'Student Profile', desc: 'CEFR level, strengths/weaknesses, learning preferences', color: 'bg-amber-100 border-amber-300 text-amber-800' },
    { letter: 'D', name: 'Decision Engine', desc: 'AI-powered worksheet suggestions with estimated impact', color: 'bg-violet-100 border-violet-300 text-violet-800' },
  ];

  return (
    <div className="space-y-3">
      {layers.map((l, i) => (
        <div key={l.letter}>
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${l.color}`}>
            <span className="font-bold text-lg shrink-0">Layer {l.letter}</span>
            <div>
              <div className="font-semibold text-sm">{l.name}</div>
              <div className="text-xs opacity-80 mt-0.5">{l.desc}</div>
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center py-1">
              <span className="text-muted-foreground text-lg">↓</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const LearningPathCards = () => {
  const paths = [
    { name: 'Comfort', desc: 'Mostly review. Builds confidence with familiar material.', color: 'bg-green-50 border-green-200', emoji: '🟢' },
    { name: 'Guided', desc: 'Balanced mix of review + new material at student\'s pace.', color: 'bg-blue-50 border-blue-200', emoji: '🔵' },
    { name: 'Accelerated', desc: 'Pushes the student harder. More new material, less review.', color: 'bg-amber-50 border-amber-200', emoji: '🟠' },
    { name: 'Target', desc: 'Laser-focused on specific weak areas detected by DSLM.', color: 'bg-red-50 border-red-200', emoji: '🔴' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {paths.map(p => (
        <div key={p.name} className={`p-4 rounded-xl border ${p.color}`}>
          <div className="text-lg mb-1">{p.emoji}</div>
          <div className="font-semibold text-foreground text-sm">{p.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{p.desc}</div>
        </div>
      ))}
    </div>
  );
};

const EcosystemDiagram = () => {
  const nodes = [
    { path: '/features/homework', title: 'Homework', icon: BookCheck, desc: 'AI-graded answers feed mastery scores' },
    { path: '/features/flashcards', title: 'Flashcards', icon: Layers3, desc: 'SM-2 performance updates vocabulary skills' },
    { path: '/features/calendar', title: 'Calendar', icon: CalendarDays, desc: 'Lesson frequency tracks consistency' },
    { path: '/features/live-sessions', title: 'Live Sessions', icon: Radio, desc: 'Real-time answers update skills instantly' },
    { path: '/features/placement-test', title: 'Placement Test', icon: ClipboardCheck, desc: 'Initializes the student DSLM profile' },
    { path: '/features/student-hub', title: 'Student Hub', icon: GraduationCap, desc: 'All student activity auto-tracked' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 text-primary font-bold text-lg">
        <Brain className="h-6 w-6" />
        DSLM Core
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {nodes.map(n => (
          <Link key={n.path} to={n.path} className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group">
            <n.icon className="h-6 w-6 text-primary mb-2" />
            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{n.title}</span>
            <span className="text-[10px] text-muted-foreground mt-1 leading-tight">{n.desc}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
};

/* ─── Tracking Table ─── */

const TrackingTable = () => {
  const data = [
    { skill: 'Grammar', examples: 'Present Perfect, Conditionals, Passive Voice, Reported Speech' },
    { skill: 'Vocabulary', examples: 'Business collocations, Phrasal verbs, Academic register' },
    { skill: 'Reading', examples: 'Skimming, Scanning, Inference, Main idea identification' },
    { skill: 'Writing', examples: 'Email structure, Essay coherence, Register consistency' },
    { skill: 'Speaking', examples: 'Pronunciation patterns, Fluency, Turn-taking, Hedging' },
    { skill: 'Listening', examples: 'Gist comprehension, Detail extraction, Accent adaptation' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/50">
            <th className="text-left p-3 font-semibold text-foreground">Skill Area</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Example Nano-skills Tracked</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.skill} className={i % 2 === 0 ? 'bg-card' : 'bg-secondary/20'}>
              <td className="p-3 font-medium text-foreground">{d.skill}</td>
              <td className="p-3 text-xs text-muted-foreground">{d.examples}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Page ─── */

const faqItems = [
  { question: 'What is DSLM?', answer: 'DSLM (Dynamic Student Learning Model) is Edooqoo\'s 4-layer system that automatically tracks what each student knows, identifies gaps, detects trends, and recommends exactly what to teach next — at the nano-skill level.' },
  { question: 'Do I need to set up DSLM manually?', answer: 'No. DSLM works automatically. Every homework submission, flashcard review, live session answer, and placement test result feeds data into the model. You can also add manual observations through the Student Knowledge system.' },
  { question: 'What are nano-skills?', answer: 'Nano-skills are the smallest measurable units of language ability — for example, "Present Perfect vs Past Simple" or "Business email opening phrases." DSLM tracks mastery at this granular level, not just broad categories like "Grammar."' },
  { question: 'How does trend detection work?', answer: 'DSLM analyzes mastery changes over time. If a student\'s score on a nano-skill improves across multiple interactions, it\'s marked as "improving" (↑). Declining scores trigger "declining" (↓) alerts so you can intervene early.' },
  { question: 'Can DSLM suggest what to teach next?', answer: 'Yes. Layer D (Decision Engine) uses an AI mega-prompt that prioritizes low-mastery areas (0-30%), declining trends, and avoids repeating topics from the last 10 lessons. It generates worksheet suggestions with estimated impact scores.' },
  { question: 'Is my students\' data private?', answer: 'Absolutely. All DSLM data is scoped to your account. Students cannot see each other\'s data. The system only stores learning metrics — never personal information beyond what you enter in the student profile.' },
];

const benefits = [
  { icon: Brain, title: 'Nano-skill Precision', description: 'Track mastery at the most granular level — not just "Grammar" but "3rd Conditional in negative form."' },
  { icon: TrendingUp, title: 'Trend Detection', description: 'See which skills are improving, stable, or declining. Intervene before small gaps become big problems.' },
  { icon: Target, title: 'AI Suggestions', description: 'Get worksheet recommendations based on actual data — not guesswork. Each suggestion includes estimated impact.' },
  { icon: Layers, title: 'Zero Setup', description: 'Works automatically from day one. Every interaction feeds the model. No spreadsheets, no manual tracking.' },
];

const steps = [
  { number: 1, title: 'Student completes an activity', description: 'Homework, flashcard review, live session, or placement test — any interaction generates learning events automatically.', mockup: undefined },
  { number: 2, title: 'DSLM processes the data', description: 'Events flow through 4 layers: raw events → metrics calculation → profile update → AI recommendations. All automatic, real-time.' },
  { number: 3, title: 'You see the full picture', description: 'Open any student\'s profile to see their radar chart, nano-skill mastery bars, trend indicators, and AI-generated worksheet suggestions.' },
  { number: 4, title: 'Teach with precision', description: 'Use DSLM suggestions to generate the next worksheet, or choose your own focus — informed by data, not guesswork.' },
];

const FeatureDSLM: React.FC = () => (
  <FeaturePageLayout
    title="DSLM — AI Student Progress Tracking for ESL Teachers | Edooqoo"
    metaDescription="Track student progress at nano-skill level with Edooqoo's Dynamic Student Learning Model. 4-layer AI system: events, metrics, profiles, and intelligent suggestions."
  >
    <FeatureHero
      badge="DSLM"
      badgeColor="bg-violet-100 text-violet-700 border-violet-200"
      headline="Know exactly what to teach next. Every lesson, every student."
      subheadline="The Dynamic Student Learning Model tracks mastery at nano-skill level, detects trends, and recommends precisely what each student needs — automatically."
    >
      <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Julia Kowalski — B2 Business English</h3>
          <RadarChartMockup />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Nano-skill Mastery</h3>
          <NanoSkillsMockup />
        </div>
      </div>
    </FeatureHero>

    <section className="py-8 bg-background border-b border-border">
      <div className="max-w-4xl mx-auto px-4">
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-5 md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">DSLM is the decision layer inside 1-Minute Prep.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the canonical workflow page to see how student context, DSLM signals, and worksheet output fit together.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-4 shrink-0 md:mt-0">
            <Link to="/one-minute-prep">
              Open 1-Minute Prep <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>

    <FeatureBenefits benefits={benefits} />

    {/* The 4 Layers */}
    <section className="py-16 bg-secondary/20">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">The 4-Layer Architecture</h2>
        <p className="text-sm text-muted-foreground text-center mb-10">From raw events to intelligent teaching decisions — fully automatic.</p>
        <LayersDiagram />
      </div>
    </section>

    {/* What it tracks */}
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">What DSLM Tracks</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Six skill areas, dozens of nano-skills — all tracked automatically.</p>
        <TrackingTable />
      </div>
    </section>

    {/* Learning Paths */}
    <section className="py-16 bg-secondary/20">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">4 Learning Paths</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">DSLM suggests the right difficulty level for each student.</p>
        <LearningPathCards />
      </div>
    </section>

    <FeatureSteps title="How DSLM works" steps={steps} />

    {/* Ecosystem diagram */}
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">How DSLM Powers Every Feature</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Every feature feeds data into DSLM. Every suggestion is powered by DSLM.</p>
        <EcosystemDiagram />
      </div>
    </section>

    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Start tracking student progress today" subheadline="2 free worksheets. DSLM starts working from the first interaction." />
    <RelatedFeatures currentPath="/features/dslm" />
  </FeaturePageLayout>
);

export default FeatureDSLM;
