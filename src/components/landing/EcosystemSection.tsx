import React from 'react';
import { Link } from 'react-router-dom';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

/* ─── Mini UI Mockups ─────────────────────────────── */

const LiveSessionsMockup = () => (
  <div className="bg-background rounded-xl border border-border shadow-sm p-3 space-y-2 text-xs">
    <div className="flex items-center justify-between mb-1">
      <span className="font-semibold text-foreground text-[11px]">Fill in the gaps</span>
      <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span>
        02:45
      </span>
    </div>
    <div className="bg-muted/60 rounded-lg p-2 text-muted-foreground leading-5">
      She <span className="inline-block w-12 h-4 bg-violet-100 border border-violet-300 rounded mx-1 align-middle"></span> to the office every day.
    </div>
    <div className="flex gap-1.5 flex-wrap">
      {['walks', 'drive', 'goes'].map((w, i) => (
        <span key={w} className={`px-2 py-0.5 rounded-full border text-[10px] font-medium cursor-pointer ${i === 0 ? 'bg-green-50 border-green-300 text-green-700' : 'bg-background border-border text-muted-foreground'}`}>{w}</span>
      ))}
    </div>
    <div className="flex items-center justify-between pt-1 border-t border-border">
      <span className="text-muted-foreground text-[10px]">Score</span>
      <span className="text-violet-600 font-bold text-[11px]">7 / 10</span>
    </div>
  </div>
);

const HomeworkMockup = () => (
  <div className="bg-background rounded-xl border border-border shadow-sm p-3 space-y-2 text-xs">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-foreground text-[11px]">Business English – Unit 3</span>
      <span className="bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 text-[10px] font-medium">Due Mon</span>
    </div>
    <div className="space-y-1.5">
      {[
        { label: 'Fill in the gaps', status: 'ai', score: '9/10' },
        { label: 'Vocabulary match', status: 'ai', score: '7/10' },
        { label: 'Writing task', status: 'pending', score: '' },
      ].map((ex) => (
        <div key={ex.label} className="flex items-center justify-between bg-muted/40 rounded-lg px-2 py-1.5">
          <span className="text-muted-foreground">{ex.label}</span>
          {ex.status === 'ai' ? (
            <span className="flex items-center gap-1 text-[10px] text-green-700 font-medium">
              <span className="bg-green-100 border border-green-200 rounded-full px-1.5 py-0.5">✓ AI graded</span>
              <span className="font-bold">{ex.score}</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">awaiting</span>
          )}
        </div>
      ))}
    </div>
  </div>
);

const FlashcardMockup = () => (
  <div className="relative h-24">
    {/* Back card */}
    <div className="absolute inset-x-2 top-3 bg-violet-50 border border-violet-200 rounded-xl p-3 shadow-sm">
      <div className="text-[10px] text-violet-400 mb-1">Translation</div>
      <div className="text-sm font-semibold text-violet-700">to explain in great detail</div>
    </div>
    {/* Front card */}
    <div className="absolute inset-x-0 top-0 bg-background border border-border rounded-xl p-3 shadow-md">
      <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-between">
        <span>Vocabulary · B2</span>
        <span className="bg-violet-100 text-violet-600 text-[9px] px-1.5 rounded-full">flip →</span>
      </div>
      <div className="text-sm font-bold text-foreground">elaborate</div>
      <div className="text-[10px] text-muted-foreground italic mt-0.5">"Could you elaborate on that point?"</div>
    </div>
  </div>
);

const CalendarMockup = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const slots = [
    [null, 'booked', null, 'avail', null],
    ['avail', null, 'booked', null, 'avail'],
    [null, 'avail', null, 'booked', null],
  ];
  return (
    <div className="bg-background rounded-xl border border-border shadow-sm p-3 text-[10px]">
      <div className="grid grid-cols-5 gap-1 mb-1.5">
        {days.map(d => <div key={d} className="text-center text-muted-foreground font-medium">{d}</div>)}
      </div>
      {slots.map((row, ri) => (
        <div key={ri} className="grid grid-cols-5 gap-1 mb-1">
          {row.map((slot, ci) => (
            <div key={ci} className={`h-6 rounded-md flex items-center justify-center text-[9px] font-medium ${
              slot === 'booked' ? 'bg-violet-100 text-violet-700 border border-violet-200' :
              slot === 'avail' ? 'bg-green-50 text-green-700 border border-green-200' :
              'bg-muted/30 border border-transparent'
            }`}>
              {slot === 'booked' ? '✓' : slot === 'avail' ? '◦' : ''}
            </div>
          ))}
        </div>
      ))}
      <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-border">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-100 border border-green-300"></span>Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-100 border border-violet-300"></span>Booked</span>
      </div>
    </div>
  );
};

const WelcomeTestMockup = () => (
  <div className="bg-background rounded-xl border border-border shadow-sm p-3 text-xs space-y-2">
    <div className="text-[11px] font-semibold text-foreground">Placement Test · Anna K.</div>
    <div className="flex gap-1 flex-wrap">
      {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l, i) => (
        <span key={l} className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${i === 3 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted/40 text-muted-foreground border-border'}`}>{l}</span>
      ))}
    </div>
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Progress</span><span className="font-medium text-foreground">18 / 25</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full" style={{ width: '72%' }}></div>
      </div>
    </div>
    <div className="bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5 text-[10px] text-violet-700">
      <span className="font-semibold">AI result:</span> Estimated B2 — Upper Intermediate
    </div>
  </div>
);

const ShareMockup = () => (
  <div className="bg-background rounded-xl border border-border shadow-sm p-3 text-xs space-y-2">
    <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1.5 border border-border">
      <span className="text-[10px] text-muted-foreground truncate flex-1">edooqoo.app/ws/abc123</span>
      <span className="text-[10px] text-violet-600 font-medium shrink-0 cursor-pointer">Copy</span>
    </div>
    <div className="space-y-1">
      {[
        { name: 'Anna K.', done: true, score: '9/10' },
        { name: 'Piotr M.', done: true, score: '7/10' },
        { name: 'Maria S.', done: false, score: '' },
      ].map((s) => (
        <div key={s.name} className="flex items-center justify-between px-2 py-1 rounded-lg bg-muted/30">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[9px] font-bold text-violet-600">{s.name[0]}</div>
            <span className="text-[10px] text-foreground">{s.name}</span>
          </div>
          {s.done
            ? <span className="text-[10px] text-green-700 font-medium flex items-center gap-0.5"><span className="text-green-500">✓</span> {s.score}</span>
            : <span className="text-[10px] text-muted-foreground italic">not started</span>
          }
        </div>
      ))}
    </div>
  </div>
);

const OneMinutePrepMockup = () => (
  <div className="bg-background rounded-xl border border-border shadow-sm p-3 text-xs space-y-2">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-foreground text-[11px]">Julia K. · B2 Business English</span>
      <span className="bg-violet-50 border border-violet-200 text-violet-700 rounded-full px-2 py-0.5 text-[10px] font-medium">~1 min target</span>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      {['Profile ready', 'Goals set', 'Homework scored', 'Flashcards active'].map((item) => (
        <div key={item} className="bg-muted/40 rounded-md px-2 py-1 text-[10px] text-muted-foreground">
          <span className="text-green-600 font-bold">✓</span> {item}
        </div>
      ))}
    </div>
    <div className="bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5 text-[10px] text-violet-700">
      <span className="font-semibold">Next focus:</span> email structure + hedging
    </div>
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-violet-500 rounded-full" style={{ width: '78%' }}></div>
    </div>
  </div>
);

/* ─── Feature data ────────────────────────────────── */

const features = [
  {
    badge: 'Core',
    badgeColor: 'bg-violet-50 text-violet-600 border-violet-200',
    title: '1-Minute Prep + DSLM',
    description: 'Student goals, profile data and learning signals help define the next lesson focus before worksheet generation.',
    mockup: <OneMinutePrepMockup />,
    link: '/features/dslm',
    anchorId: 'feature-one-minute-prep',
  },
  {
    badge: 'Live',
    badgeColor: 'bg-red-50 text-red-600 border-red-200',
    title: 'Live Sessions',
    description: 'Teach with the worksheet open. Live responses and review moments can feed the next lesson focus.',
    mockup: <LiveSessionsMockup />,
    link: '/features/live-sessions',
    anchorId: 'feature-live-sessions',
  },
  {
    badge: 'Auto',
    badgeColor: 'bg-amber-50 text-amber-600 border-amber-200',
    title: 'Homework + AI Grading',
    description: 'Assign exercises with deadlines. AI-assisted grading gives review data for the next student-specific worksheet.',
    mockup: <HomeworkMockup />,
    link: '/features/homework',
    anchorId: 'feature-homework',
  },
  {
    badge: 'SM-2',
    badgeColor: 'bg-violet-50 text-violet-600 border-violet-200',
    title: 'Smart Flashcards',
    description: 'Auto-generated flashcards and spaced repetition activity add vocabulary signals to the student context.',
    mockup: <FlashcardMockup />,
    link: '/features/flashcards',
    anchorId: 'feature-flashcards',
  },
  {
    badge: 'Sync',
    badgeColor: 'bg-green-50 text-green-600 border-green-200',
    title: 'Lesson Calendar',
    description: 'Lesson cadence and bookings keep weekly prep tied to the students you actually teach next.',
    mockup: <CalendarMockup />,
    link: '/features/calendar',
    anchorId: 'feature-calendar',
  },
  {
    badge: 'AI',
    badgeColor: 'bg-blue-50 text-blue-600 border-blue-200',
    title: 'Welcome Placement Test',
    description: 'New student? Send a placement test to initialize level, goals and starting context before lesson one.',
    mockup: <WelcomeTestMockup />,
    link: '/features/placement-test',
    anchorId: 'feature-placement-test',
  },
  {
    badge: 'Link',
    badgeColor: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    title: 'Student Hub',
    description: 'Students work through shared materials online, giving you completion context for follow-up prep.',
    mockup: <ShareMockup />,
    link: '/features/student-hub',
    anchorId: 'feature-student-hub',
  },
];

/* ─── Section ─────────────────────────────────────── */

const EcosystemSection: React.FC = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="features" className="bg-background/60 backdrop-blur-sm py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className={`text-2xl font-bold text-foreground mb-2 animate-fade-up ${isVisible ? 'visible' : ''}`}>
            The system behind 1-Minute Prep
          </h2>
          <p className={`text-sm text-muted-foreground max-w-2xl mx-auto animate-fade-up stagger-1 ${isVisible ? 'visible' : ''}`}>
            Each feature adds context or turns that context into the next ready-to-teach worksheet.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <Link
              to={feature.link}
              key={feature.title}
              id={feature.anchorId}
              className={`scroll-mt-20 bg-secondary/30 rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-violet-200 transition-all duration-300 animate-fade-up stagger-${i + 1} ${isVisible ? 'visible' : ''} group`}
            >
              {/* Mockup preview area */}
              <div className="bg-muted/30 border-b border-border px-4 pt-4 pb-3">
                {feature.mockup}
              </div>

              {/* Text area */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${feature.badgeColor}`}>{feature.badge}</span>
                  <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{feature.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                <span className="text-xs text-primary font-medium mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Learn more →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EcosystemSection;
