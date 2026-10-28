import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompetencyRadarView } from '@/components/dslm/CompetencyRadarView';
import { ConnectedWhyThisLesson } from '@/components/dslm/ConnectedWhyThisLesson';
import { usePlanEvidenceMetrics } from '@/hooks/dslm/usePlanEvidenceMetrics';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import type { SkillMetric } from '@/hooks/useSkillMetrics';
import type { ExplainabilityMetric, RecommendationExplanation } from '@/lib/dslm/recommendationExplainability';
import { weakestSkillInCategory } from '@/lib/dslm/competencyRadar';
import { buildAutoGeneratePayload, hasAutoGenerateIntent, readAutoGenerateIntent } from '@/lib/worksheet/autoGenerateBootstrap';

const boundary = vi.hoisted(() => ({
  demo: false,
  blocked: vi.fn(),
  navigate: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
  rows: [] as ExplainabilityMetric[],
  error: null as Error | null,
  explanation: null as RecommendationExplanation | null,
  evidenceError: false,
}));

vi.mock('@/contexts/DemoContext', () => ({
  useDemoContext: () => ({ isDemoMode: boundary.demo, showDemoBlockedToast: boundary.blocked }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => boundary.navigate }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: boundary.from, rpc: boundary.rpc },
}));
vi.mock('@/components/dslm/WhyThisLessonBanner', () => ({
  WhyThisLessonBanner: ({ explanation, error }: { explanation: RecommendationExplanation; error: boolean }) => {
    boundary.explanation = explanation;
    boundary.evidenceError = error;
    return null;
  },
}));

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: key => { values.delete(key); },
    clear: () => { values.clear(); },
    key: index => [...values.keys()][index] ?? null,
  };
}

const metric: ExplainabilityMetric = {
  skill_name: 'ns.B1.grammar.modals', skill_category: 'grammar', micro_skill: 'modals',
  current_mastery: 25, total_events: 4, last_event_at: null,
};
const suggestion = { id: 'suggestion-2', suggested_topic: 'Client negotiation', focus_skill_names: [metric.skill_name ?? ''] };
const skill = (name: string, raw: number, effective: number): SkillMetric => ({
  id: name, student_id: 'student-1', teacher_id: 'teacher-1', skill_name: name,
  skill_category: 'grammar', micro_skill: 'modals', raw_mastery: raw,
  current_mastery: effective, total_events: 4, trend: 'stable',
  last_event_at: null, first_event_at: null, mastery_history: [], updated_at: '2026-10-28',
});
const skills = [skill('ns.B1.grammar.modals', 40, 40), skill('ns.B1.grammar.passive_voice', 20, 20)];

let signals: ReturnType<typeof usePlanEvidenceMetrics> | undefined;
let renderer: ReactTestRenderer | undefined;
let client: QueryClient;

function MetricsProbe({ studentId = 'student-1', teacherId = 'teacher-1' }: { studentId?: string; teacherId?: string }) {
  signals = usePlanEvidenceMetrics(studentId, teacherId);
  return null;
}

async function mount(child: React.ReactElement) {
  await act(async () => {
    renderer = create(<QueryClientProvider client={client}>{child}</QueryClientProvider>);
  });
}

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}

async function clickRadarAction() {
  if (!renderer) throw new Error('Radar must be mounted');
  const buttons = renderer.root.findAllByType('button');
  expect(buttons).toHaveLength(1);
  const onClick = buttons[0]?.props.onClick;
  if (typeof onClick !== 'function') throw new Error('Missing radar action');
  await act(async () => { onClick(); });
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.demo = false;
  boundary.rows = [metric];
  boundary.error = null;
  boundary.explanation = null;
  boundary.evidenceError = false;
  signals = undefined;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const local = storage();
  const session = storage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
  const query = {
    select: boundary.select, eq: boundary.eq,
    insert: boundary.insert, update: boundary.update, delete: boundary.remove, upsert: boundary.upsert,
    then: (resolve: (result: { data: ExplainabilityMetric[]; error: Error | null }) => unknown) =>
      Promise.resolve({ data: boundary.rows, error: boundary.error }).then(resolve),
  };
  boundary.from.mockReturnValue(query);
  boundary.select.mockReturnValue(query);
  boundary.eq.mockReturnValue(query);
});

afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  renderer = undefined;
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Pillar 2 metric read boundary', () => {
  it('scopes a real query and its cache to the exact learner and teacher', async () => {
    await mount(<MetricsProbe />);
    await settle();
    expect(boundary.from).toHaveBeenCalledWith('student_skill_metrics');
    expect(boundary.eq.mock.calls).toEqual([['student_id', 'student-1'], ['teacher_id', 'teacher-1']]);
    expect(client.getQueryData(['plan-evidence-metrics', 'student-1', 'teacher-1'])).toEqual([metric]);
    expect(client.getQueryData(['plan-evidence-metrics', 'student-2', 'teacher-1'])).toBeUndefined();
    expect(signals?.rawMetrics).toEqual([metric]);
    for (const write of [boundary.insert, boundary.update, boundary.remove, boundary.upsert, boundary.rpc]) {
      expect(write).not.toHaveBeenCalled();
    }
  });

  it('preserves a missing raw score instead of fabricating zero evidence', async () => {
    boundary.rows = [{ ...metric, current_mastery: null }];
    await mount(<ConnectedWhyThisLesson studentId="student-1" teacherId="teacher-1" suggestion={suggestion} />);
    await settle();
    expect(boundary.explanation).toMatchObject({ status: 'insufficient_evidence', primary: null, evidence: [] });
    expect(client.getQueryData(['plan-evidence-metrics', 'student-1', 'teacher-1'])).toEqual(boundary.rows);
  });

  it('keeps both stored and once-decayed mastery through the hook and evidence engine', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T00:00:00Z'));
    boundary.rows = [{ ...metric, current_mastery: 90, last_event_at: '2026-08-15T00:00:00Z' }];
    await mount(<ConnectedWhyThisLesson studentId="student-1" teacherId="teacher-1" suggestion={suggestion} />);
    await settle();
    expect(boundary.explanation?.primary).toMatchObject({ raw_mastery: 90, effective_mastery: 67.5 });
    expect(boundary.rows[0]?.current_mastery).toBe(90);
  });

  it('blocks metric reads in demo even when refetch is explicitly requested', async () => {
    localStorage.setItem('edooqoo_demo_mode', 'true');
    await mount(<MetricsProbe />);
    if (!signals) throw new Error('Metrics probe did not run');
    await act(async () => { await signals?.refetch(); });
    expect(boundary.from).not.toHaveBeenCalled();
    expect(signals?.rawMetrics).toEqual([]);
  });

  it.each([{ studentId: '', teacherId: 'teacher-1' }, { studentId: 'student-1', teacherId: '' }])(
    'blocks reads and explicit refetch for incomplete scope: %j', async scope => {
      await mount(<MetricsProbe {...scope} />);
      await act(async () => { await signals?.refetch(); });
      expect(boundary.from).not.toHaveBeenCalled();
    },
  );

  it('the connected evidence surface performs no read when the real demo guard context is active', async () => {
    boundary.demo = true;
    await mount(<ConnectedWhyThisLesson studentId="demo-student" teacherId="demo-teacher" suggestion={suggestion} />);
    await settle();
    expect(boundary.from).not.toHaveBeenCalled();
    expect(boundary.explanation).toBeNull();
    expect(renderer?.toJSON()).toBeNull();
  });

  it('removes cached numerical evidence after a refetch failure and restores it on retry', async () => {
    await mount(<ConnectedWhyThisLesson studentId="student-1" teacherId="teacher-1" suggestion={suggestion} />);
    await settle();
    expect(boundary.explanation?.primary).toMatchObject({ raw_mastery: 25 });
    boundary.error = new Error('Unavailable');
    await act(async () => { await client.refetchQueries({ queryKey: ['plan-evidence-metrics', 'student-1', 'teacher-1'] }); });
    await settle();
    expect(boundary.evidenceError).toBe(true);
    expect(boundary.explanation).toMatchObject({ primary: null, evidence: [] });
    boundary.error = null;
    await act(async () => { await client.refetchQueries({ queryKey: ['plan-evidence-metrics', 'student-1', 'teacher-1'] }); });
    await settle();
    expect(boundary.evidenceError).toBe(false);
    expect(boundary.explanation?.primary).toMatchObject({ raw_mastery: 25 });
  });
});

describe('Pillar 2 manual radar handoff', () => {
  it.each([{ raw: 20, effective: 20 }, { raw: 90, effective: 67.5 }])(
    'hands off a gap or retention alert without creating any generation intent: %j', async values => {
      const rows = [skills[0], skill('ns.B1.grammar.passive_voice', values.raw, values.effective)];
      // The retention case must contain only the faded skill to exercise its zone.
      const input = values.raw >= 80 ? rows.slice(1) : rows;
      sessionStorage.setItem('prefillSuggestionId', 'unrelated-suggestion');
      await mount(<CompetencyRadarView skills={input} />);
      await clickRadarAction();
      const payload = JSON.parse(sessionStorage.getItem('prefillWorksheet') ?? '{}');
      expect(Object.keys(payload).sort()).toEqual(['additionalInfo', 'goal', 'grammarFocus', 'topic']);
      const weakest = weakestSkillInCategory(input, 'grammar');
      if (!weakest) throw new Error('Expected focus skill');
      expect(payload.topic.endsWith(weakest.label)).toBe(true);
      expect(payload.goal).toBe('');
      expect(payload.grammarFocus).toBe('');
      expect(sessionStorage.getItem('prefillSuggestionId')).toBeNull();
      expect(sessionStorage.getItem('forceNewWorksheet')).toBe('true');
      expect(boundary.navigate.mock.calls).toEqual([['/']]);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(2);
      expect(hasAutoGenerateIntent()).toBe(false);
      expect(readAutoGenerateIntent()).toBeNull();
      expect(buildAutoGeneratePayload()).toBeNull();
      expect(boundary.from).not.toHaveBeenCalled();
      expect(boundary.rpc).not.toHaveBeenCalled();
    },
  );

  it('the actual demo guard blocks storage writes and navigation', async () => {
    boundary.demo = true;
    sessionStorage.setItem('prefillSuggestionId', 'existing-suggestion');
    await mount(<CompetencyRadarView skills={skills} />);
    await clickRadarAction();
    expect(boundary.blocked).toHaveBeenCalledTimes(1);
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem('prefillSuggestionId')).toBe('existing-suggestion');
    expect(localStorage.length).toBe(0);
    expect(boundary.navigate).not.toHaveBeenCalled();
    expect(boundary.from).not.toHaveBeenCalled();
  });

  it('the real demo guard executes an allowed action once', () => {
    const callback = vi.fn();
    function GuardProbe() {
      const { guardAction } = useDemoGuard();
      React.useEffect(() => { guardAction('test action', callback); }, []);
      return null;
    }
    act(() => { renderer = create(<GuardProbe />); });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(boundary.blocked).not.toHaveBeenCalled();
  });
});