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
    { name: 'ns.grammar.present_perfect_continuous', mastery: 85, trend: '↑', trendColor: 'text-green-600' },
    { name: 'ns.writing.formal_narrative', mastery: 42, trend: '↓', trendColor: 'text-red-500' },
    { name: 'ns.listening.detail_extraction', mastery: 71, trend: '→', trendColor: 'text-muted-foreground' },
    { name: 'ns.vocabulary.collocation_do_make', mastery: 63, trend: '↑', trendColor: 'text-green-600' },
    { name: 'ns.writing.pragmatic_appropriacy', mastery: 38, trend: '↑', trendColor: 'text-green-600' },
    { name: 'ns.reading.inference_from_text', mastery: 22, trend: '↓', trendColor: 'text-red-500' },
  ];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-muted-foreground font-medium px-1">
        <span>Nano-skill</span>
        <span>Mastery</span>
      </div>
      {skills.map(s => (
        <div key={s.name} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
          <span className="flex-1 break-all text-foreground text-[11px]">{s.name}</span>
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
    { letter: 'A', name: 'Signal Log', desc: 'Welcome Test answers, worksheet events, homework evaluations, teacher notes, goals, and available activity context', color: 'bg-blue-100 border-blue-300 text-blue-800' },
    { letter: 'B', name: 'Nano-skill Metrics', desc: 'Atomic labels, mastery values, trend indicators, event counts, and last-activity timestamps', color: 'bg-green-100 border-green-300 text-green-800' },
    { letter: 'C', name: 'Learner Profile', desc: 'CEFR baseline, profile traits, self-profile notes, goals, deadlines, and pacing mode', color: 'bg-amber-100 border-amber-300 text-amber-800' },
    { letter: 'D', name: 'Decision Support', desc: 'Roadmap phases and next-step worksheet suggestions for teacher review before worksheet output', color: 'bg-violet-100 border-violet-300 text-violet-800' },
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
    { path: '/features/homework', title: 'Homework', icon: BookCheck, desc: 'Reviewed homework answers can become planning signals' },
    { path: '/features/flashcards', title: 'Flashcards', icon: Layers3, desc: 'SM-2 practice can inform vocabulary continuity' },
    { path: '/features/calendar', title: 'Calendar', icon: CalendarDays, desc: 'Lesson cadence supports recurring prep context' },
    { path: '/features/live-sessions', title: 'Live Sessions', icon: Radio, desc: 'Live answers and notes can inform future prep' },
    { path: '/features/placement-test', title: 'Placement Test', icon: ClipboardCheck, desc: 'Creates an initial diagnostic baseline' },
    { path: '/features/student-hub', title: 'Student Hub', icon: GraduationCap, desc: 'Supported student activity can add context' },
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
    { skill: 'Grammar', examples: 'ns.grammar.present_perfect_continuous, ns.grammar.third_conditional, ns.grammar.passive_voice_past' },
    { skill: 'Vocabulary', examples: 'ns.vocabulary.collocation_do_make, ns.vocabulary.word_formation_adverb, ns.vocabulary.idiom_comprehension' },
    { skill: 'Reading', examples: 'ns.reading.identify_main_idea, ns.reading.inference_from_text' },
    { skill: 'Writing', examples: 'ns.writing.formal_narrative, ns.writing.pragmatic_appropriacy, ns.writing.complaint_register' },
    { skill: 'Speaking', examples: 'ns.speaking.complaint_oral, ns.speaking.pragmatic_declining_oral' },
    { skill: 'Listening', examples: 'ns.listening.detail_extraction' },
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
              <td className="p-3 text-xs text-muted-foreground break-words">{d.examples}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Page ─── */

const faqItems = [
  { question: 'What is DSLM?', answer: 'DSLM (Dynamic Student Learning Model) is Edooqoo\'s student-specific signal graph and decision-support layer. It organizes stored profile, goal, nano-skill, activity, pacing, roadmap, and teacher-observation evidence so teachers can make clearer next-step decisions before generating a worksheet.' },
  { question: 'Do I need to set up DSLM manually?', answer: 'DSLM needs student context. The guided setup starts with a student profile, goals, optional Welcome Test data, and supported learning signals. Teachers can also add manual observations through the Student Knowledge system.' },
  { question: 'What are nano-skills?', answer: 'Nano-skills are atomic grammar, vocabulary, reading, writing, speaking, listening, or communication labels. Examples in Edooqoo include ns.grammar.present_perfect_continuous, ns.writing.formal_narrative, and ns.listening.detail_extraction. They are more useful than broad labels like "Grammar" because each signal can point to a concrete next lesson focus.' },
  { question: 'How does trend detection work?', answer: 'DSLM can compare available mastery and activity signals over time. Improving, stable, or declining indicators help teachers decide whether to review, maintain, or push a skill further.' },
  { question: 'Can DSLM suggest what to teach next?', answer: 'Yes. DSLM can generate next-step suggestions from available student context and recent signals. The teacher still chooses, edits, and approves the lesson direction before using the worksheet output.' },
  { question: 'Is my students\' data private?', answer: 'Absolutely. All DSLM data is scoped to your account. Students cannot see each other\'s data. The system only stores learning metrics — never personal information beyond what you enter in the student profile.' },
];

const benefits = [
  { icon: Brain, title: 'Nano-skill Precision', description: 'Track evidence at the atomic level: grammar forms, vocabulary patterns, reading inference, writing register, speaking tasks, and listening detail extraction.' },
  { icon: TrendingUp, title: 'Trend Detection', description: 'See which skills are improving, stable, or declining. Intervene before small gaps become big problems.' },
  { icon: Target, title: 'Next-step Suggestions', description: 'Use available student context, pacing, roadmap phase, and skill metrics to generate clearer worksheet recommendations for teacher review.' },
  { icon: Layers, title: 'Signal Graph', description: 'Profile, goals, tests, worksheets, homework, notes, flashcards, pacing, and events become a student-specific context layer over time.' },
];

const steps = [
  { number: 1, title: 'Student context is created', description: 'Profile, goals, Welcome Test results, homework, flashcards, live work, or teacher observations provide the starting signals.', mockup: undefined },
  { number: 2, title: 'DSLM organizes available signals', description: 'The system turns raw activity and teacher context into profile, nano-skill mastery, trend, pacing, and planning information.' },
  { number: 3, title: 'You review the next-step view', description: 'Open the student profile to see nano-skill signals, trend indicators, confidence context, and suggested worksheet directions.' },
  { number: 4, title: 'Teach with teacher control', description: 'Use DSLM next-focus suggestions to generate the next worksheet, or choose your own focus — then review and edit before use.' },
];

const FeatureDSLM: React.FC = () => (
  <FeaturePageLayout
    title="DSLM — Student Context for 1-Minute Prep | Edooqoo"
    metaDescription="Use Edooqoo's Dynamic Student Learning Model to organize student context, learning signals, and teacher-reviewed next-step suggestions for 1:1 English lessons."
  >
    <FeatureHero
      badge="DSLM"
      badgeColor="bg-violet-100 text-violet-700 border-violet-200"
      headline="Turn stored learner evidence into the next lesson focus."
      subheadline="The Dynamic Student Learning Model supports 1-Minute Prep by organizing profile, goals, nano-skill metrics, pacing, roadmap phases, notes, homework, flashcards, and teacher observations before worksheet output."
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
              Use the canonical workflow page to see how student context, DSLM nano-skill evidence, pacing, and worksheet output fit together.
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
        <p className="text-sm text-muted-foreground text-center mb-10">From stored learner evidence to teacher-reviewed next-step suggestions.</p>
        <LayersDiagram />
      </div>
    </section>

    {/* What it tracks */}
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">What DSLM Tracks</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Six skill areas with atomic nano-skill labels. The labels become more useful when mastery and trend signals accumulate.</p>
        <TrackingTable />
      </div>
    </section>

    {/* Learning Paths */}
    <section className="py-16 bg-secondary/20">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">4 Learning Paths</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">DSLM can suggest a difficulty direction for teacher review.</p>
        <LearningPathCards />
      </div>
    </section>

    <FeatureSteps title="How DSLM works" steps={steps} />

    {/* Ecosystem diagram */}
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">How DSLM Powers Every Feature</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Supported student activity and teacher observations can add context for better recurring prep.</p>
        <EcosystemDiagram />
      </div>
    </section>

    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Start building student context today" subheadline="2 free worksheets. Build the context that moves weekly prep toward 1 minute per student." />
    <RelatedFeatures currentPath="/features/dslm" />
  </FeaturePageLayout>
);

export default FeatureDSLM;
