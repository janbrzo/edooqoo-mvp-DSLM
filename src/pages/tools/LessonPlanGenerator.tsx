import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const DURATIONS = [30, 45, 60, 90] as const;

type Level = (typeof LEVELS)[number];
type Duration = (typeof DURATIONS)[number];

interface FormState {
  topic: string;
  level: Level;
  duration: Duration;
  goal: string;
  persona: string;
}

interface Stage {
  name: string;
  minutes: number;
  description: string;
  materials: string[];
}

const FAQS = [
  { question: 'Is this lesson plan generator free?', answer: 'Yes. The plan is rendered locally in your browser. No sign-up, no email, no payment.' },
  { question: 'Can I edit the result?', answer: 'Yes. Copy the plan, download it as HTML, or paste it into Google Docs and edit freely.' },
  { question: 'Does it work for 1-on-1 adult lessons?', answer: 'Yes — the structure follows andragogical principles (relevance to learner goals, immediate application, autonomy).' },
  { question: 'How is this different from the worksheets I generate inside Edooqoo?', answer: 'This tool produces a structured plan (stages, timing, materials). Edooqoo worksheets fill the practice and production stages with personalized exercises.' },
];

function buildStages(form: FormState): Stage[] {
  // Time distribution scales with total duration.
  const d = form.duration;
  const warm = Math.max(3, Math.round(d * 0.08));
  const lead = Math.max(5, Math.round(d * 0.12));
  const present = Math.round(d * 0.18);
  const practice = Math.round(d * 0.28);
  const produce = Math.round(d * 0.22);
  const wrap = Math.max(3, d - (warm + lead + present + practice + produce));

  return [
    {
      name: 'Warm-up',
      minutes: warm,
      description: `Quick conversational opener tied to the learner’s context (${form.persona || 'adult professional'}). Activate prior knowledge of ${form.topic || 'today’s topic'}.`,
      materials: ['2 personalized warm-up questions'],
    },
    {
      name: 'Lead-in',
      minutes: lead,
      description: `Elicit the target language naturally. Connect ${form.topic || 'the topic'} to the learner’s goal: "${form.goal || 'use English at work'}".`,
      materials: ['Real-world image or short audio clip (≤60s)'],
    },
    {
      name: 'Presentation',
      minutes: present,
      description: `Clarify form, meaning, and pronunciation at ${form.level} level. Use 3–5 concept-checking questions instead of long explanations.`,
      materials: ['Target language summary (1 slide / 1 paragraph)', 'CCQ list'],
    },
    {
      name: 'Controlled practice',
      minutes: practice,
      description: `Accuracy-focused exercises on ${form.topic || 'the target language'}. Mix fill-in-the-blanks, matching, and error correction.`,
      materials: [`Edooqoo worksheet (${form.level}, ${form.topic || 'topic'})`],
    },
    {
      name: 'Freer production',
      minutes: produce,
      description: `Role-play or task-based activity simulating a real ${form.persona || 'workplace'} scenario. Learner uses target language with minimal scaffolding.`,
      materials: ['Role-play prompt card', 'Scoring rubric (fluency / accuracy / range)'],
    },
    {
      name: 'Wrap-up & homework',
      minutes: wrap,
      description: `Recap key items. Assign 1 homework item from Edooqoo (auto-graded). Confirm next session’s focus.`,
      materials: ['Homework link (Edooqoo)', '3-line learner reflection'],
    },
  ];
}

function renderHtml(form: FormState, stages: Stage[]): string {
  const total = stages.reduce((s, x) => s + x.minutes, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Lesson Plan — ${form.topic || 'Untitled'} (${form.level})</title>
<style>body{font-family:system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;color:#111}h1{margin-bottom:.25rem}table{border-collapse:collapse;width:100%;margin-top:1rem}th,td{border:1px solid #ddd;padding:.5rem;vertical-align:top;text-align:left}th{background:#f6f6f6}small{color:#666}</style></head>
<body>
<h1>${form.topic || 'Lesson plan'}</h1>
<small>Level: ${form.level} · Duration: ${total} min · Learner: ${form.persona || 'adult learner'} · Goal: ${form.goal || '—'}</small>
<table><thead><tr><th>Stage</th><th>Min</th><th>Description</th><th>Materials</th></tr></thead><tbody>
${stages.map((s) => `<tr><td>${s.name}</td><td>${s.minutes}</td><td>${s.description}</td><td>${s.materials.join('<br>')}</td></tr>`).join('')}
</tbody></table>
<p><small>Generated with Edooqoo — https://edooqoo.com/tools/lesson-plan-generator</small></p>
</body></html>`;
}

const LessonPlanGenerator: React.FC = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const [form, setForm] = useState<FormState>({
    topic: '',
    level: 'B1',
    duration: 60,
    goal: '',
    persona: '',
  });
  const [stages, setStages] = useState<Stage[] | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setStages(buildStages(form));
    setTimeout(() => document.getElementById('plan-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleCopy = async () => {
    if (!stages) return;
    const text = stages.map((s) => `${s.name} (${s.minutes} min)\n${s.description}\nMaterials: ${s.materials.join('; ')}`).join('\n\n');
    await navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    if (!stages) return;
    const html = renderHtml(form, stages);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesson-plan-${form.level.toLowerCase()}-${(form.topic || 'untitled').toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Free ESL Lesson Plan Generator — 1-on-1 Adult Learners"
        description="Free ESL lesson plan generator. Choose topic, CEFR level, duration — get a printable 6-stage plan for adult 1-on-1 English lessons. No sign-up."
        path="/tools/lesson-plan-generator"
        ogType="article"
        jsonLd={[
          buildFaqPageLd(FAQS),
          {
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to create a structured ESL lesson plan',
            step: [
              { '@type': 'HowToStep', name: 'Enter the lesson topic' },
              { '@type': 'HowToStep', name: 'Pick CEFR level and duration' },
              { '@type': 'HowToStep', name: 'Add the learner goal and persona' },
              { '@type': 'HowToStep', name: 'Download the structured plan' },
            ],
            provider: { '@type': 'Organization', name: 'Edooqoo', url: 'https://edooqoo.com' },
          },
        ]}
      />
      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex gap-1">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link to="/tools" className="hover:text-primary">Tools</Link></li>
            <li aria-hidden>/</li>
            <li className="text-foreground">Lesson Plan Generator</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">ESL Lesson Plan Generator</h1>
          <p className="text-lg text-muted-foreground">
            Build a structured 1-on-1 adult ESL lesson in under a minute. Six andragogical stages, scaled to your duration, ready to print or paste into Google Docs.
          </p>
        </header>

        <aside aria-label="Summary" className="mb-8 rounded-lg border bg-card p-5 text-sm">
          <strong className="block text-foreground mb-1">TL;DR</strong>
          <span className="text-muted-foreground">
            Fill 5 fields → press Generate → copy text or download HTML. Runs locally; nothing is uploaded.
          </span>
        </aside>

        <form onSubmit={handleGenerate} className="space-y-4 rounded-lg border bg-card p-6">
          <label className="block">
            <span className="block text-sm font-semibold text-foreground mb-1">Topic</span>
            <input
              type="text"
              required
              value={form.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="e.g. Present Perfect for business emails"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-semibold text-foreground mb-1">CEFR level</span>
              <select
                value={form.level}
                onChange={(e) => update('level', e.target.value as Level)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-foreground mb-1">Duration (minutes)</span>
              <select
                value={form.duration}
                onChange={(e) => update('duration', Number(e.target.value) as Duration)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-semibold text-foreground mb-1">Learner goal</span>
            <input
              type="text"
              value={form.goal}
              onChange={(e) => update('goal', e.target.value)}
              placeholder="e.g. Lead a project status meeting in English"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-foreground mb-1">Learner persona</span>
            <input
              type="text"
              value={form.persona}
              onChange={(e) => update('persona', e.target.value)}
              placeholder="e.g. Software engineer, 34, working at a US fintech"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Generate lesson plan
          </button>
        </form>

        {stages && (
          <section id="plan-result" className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold text-foreground">Your lesson plan</h2>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="px-4 py-2 rounded-md border border-input text-sm font-semibold hover:bg-accent">Copy text</button>
                <button onClick={handleDownload} className="px-4 py-2 rounded-md border border-input text-sm font-semibold hover:bg-accent">Download HTML</button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Level {form.level} · {form.duration} minutes · Goal: {form.goal || '—'}
            </p>
            <ol className="space-y-3">
              {stages.map((s, i) => (
                <li key={i} className="rounded-lg border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h3 className="font-semibold text-foreground">{i + 1}. {s.name}</h3>
                    <span className="text-xs text-muted-foreground">{s.minutes} min</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                  <p className="text-xs text-muted-foreground mt-2"><strong>Materials:</strong> {s.materials.join(' · ')}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="my-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.question} className="border rounded-lg p-4">
                <summary className="font-semibold text-foreground cursor-pointer">{f.question}</summary>
                <p className="mt-2 text-muted-foreground text-sm">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="p-8 bg-primary/5 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Fill the practice stage automatically</h2>
          <p className="text-muted-foreground mb-6">
            Edooqoo creates personalized worksheets that teachers can review and place into the plan.
          </p>
          <Link to="/signup" state={fromState} className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90">
            Try Edooqoo free
          </Link>
        </section>
      </article>
    </div>
  );
};

export default LessonPlanGenerator;
