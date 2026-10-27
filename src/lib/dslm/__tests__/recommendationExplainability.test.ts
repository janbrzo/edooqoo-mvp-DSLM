import { describe, expect, it } from 'vitest';
import { effectiveMastery, withEffectiveMastery } from '../../../../supabase/functions/_shared/forgetting';
import {
  explainRecommendation,
  type ExplainabilityMetric,
  type RecommendationExplainabilityInput,
} from '../recommendationExplainability';

const NOW = Date.parse('2026-10-27T08:17:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const SKILL = 'ns.B1.grammar.second_conditional';
const metric = (extra: Partial<ExplainabilityMetric> = {}): ExplainabilityMetric => ({
  skill_name: SKILL, skill_category: 'grammar', micro_skill: 'conditionals',
  current_mastery: 90, total_events: 4, last_event_at: ago(2), trend: 'stable', ...extra,
});
const suggestion = { id: 'lesson-1', suggested_topic: 'Negotiating a project deadline', focus_skill_names: [SKILL] };
const run = (extra: Partial<RecommendationExplainabilityInput> = {}) => explainRecommendation({ suggestion, now: NOW, ...extra });
const goal = { id: 'goal-1', title: 'Client negotiations', is_achieved: false, target_date: '2026-11-17' };
const note = { id: 'note-1', category: 'Skill Assessment', entry_source: 'manual', created_at: ago(3), is_outdated: false };
const phase = { id: 'phase-1', title: 'Client communication', sequence_number: 2, status: 'in_progress' };
const diagnostic = { id: 'test-1', status: 'completed', completed_at: ago(5), answered_count: 20, scored_count: 16 };

describe('recommendation evidence, not speculative model attribution', () => {
  it('returns no evidence for a legacy suggestion with only topic and rationale', () => {
    const legacy = { id: 'legacy', suggested_topic: 'Meetings', rationale: 'Spaced review of weak skills', generation_context: { metrics_count: 100, knowledge_count: 10, goals_count: 3 } };
    expect(run({ suggestion: legacy, metrics: [metric({ current_mastery: 20 })], goals: [goal], notes: [note], diagnostics: [diagnostic] }))
      .toEqual({ status: 'insufficient_evidence', primary: null, evidence: [], summary: null });
  });

  it('requires a suggestion and a valid caller clock', () => {
    expect(run({ suggestion: null }).status).toBe('insufficient_evidence');
    expect(run({ suggestion: undefined }).evidence).toEqual([]);
    expect(run({ now: NaN, metrics: [metric({ current_mastery: 20 })] }).evidence).toEqual([]);
    expect(run({ now: new Date('invalid') }).evidence).toEqual([]);
  });

  it('ignores used or deleted suggestions', () => {
    expect(run({ suggestion: { ...suggestion, is_used: true }, metrics: [metric({ current_mastery: 20 })] }).evidence).toEqual([]);
    expect(run({ suggestion: { ...suggestion, deleted_at: ago(0) }, metrics: [metric({ current_mastery: 20 })] }).evidence).toEqual([]);
  });

  it('supports only the targeted skill, not an unrelated weak skill', () => {
    expect(run({ metrics: [metric({ skill_name: 'ns.grammar.articles', current_mastery: 10 })] }).evidence).toEqual([]);
  });

  it('preserves source skill identity and all three hierarchy levels', () => {
    expect(run({ metrics: [metric({ current_mastery: 30 })] }).primary).toMatchObject({
      type: 'critical_gap', basis: 'current_signal', skill_name: SKILL,
      skill_category: 'grammar', micro_skill: 'conditionals', raw_mastery: 30, effective_mastery: 30,
    });
  });

  it('accepts a unique legacy skill alias without renaming the stored evidence', () => {
    const source = metric({ skill_name: 'ns.grammar.second_conditional', current_mastery: 30 });
    expect(run({ metrics: [source] }).primary).toMatchObject({ skill_name: source.skill_name, effective_mastery: 30 });
  });

  it('does not choose among ambiguous legacy aliases', () => {
    expect(run({ suggestion: { ...suggestion, focus_skill_names: ['ns.grammar.second_conditional'] },
      metrics: [metric({ current_mastery: 20 }), metric({ skill_name: 'ns.B2.grammar.second_conditional', current_mastery: 90 })],
    }).evidence).toEqual([]);
  });

  it('prefers a unique exact name to a conflicting canonical alias', () => {
    expect(run({ metrics: [metric({ current_mastery: 20 }), metric({ skill_name: 'ns.B2.grammar.second_conditional' })] }).primary)
      .toMatchObject({ skill_name: SKILL, raw_mastery: 20 });
  });

  it('does not resolve conflicting duplicate exact metric rows', () => {
    expect(run({ metrics: [metric({ current_mastery: 20 }), metric({ current_mastery: 90 })] }).evidence).toEqual([]);
  });

  it('deduplicates repeated target skills', () => {
    expect(run({ suggestion: { ...suggestion, focus_skill_names: [SKILL, SKILL, 'ns.grammar.second_conditional'] },
      metrics: [metric({ current_mastery: 30 })],
    }).evidence).toHaveLength(1);
  });

  it('excludes duplicate card metrics by name and by micro-skill', () => {
    expect(run({ suggestion: { ...suggestion, focus_skill_names: ['flashcard:card-1'] },
      metrics: [metric({ skill_name: 'flashcard:card-1', current_mastery: 0 })],
    }).evidence).toEqual([]);
    expect(run({ metrics: [metric({ micro_skill: 'flashcard', current_mastery: 0 })] }).evidence).toEqual([]);
  });
});

describe('skill evidence boundaries and read-time retention', () => {
  it('marks effective mastery below 50 as a gap, but not 50 itself', () => {
    expect(run({ metrics: [metric({ current_mastery: 49.9 })] }).primary).toMatchObject({ type: 'critical_gap', trigger: 'low_mastery' });
    expect(run({ metrics: [metric({ current_mastery: 50 })] }).evidence).toEqual([]);
  });

  it('keeps genuine zero with real observations', () => {
    expect(run({ metrics: [metric({ current_mastery: 0 })] }).primary).toMatchObject({ raw_mastery: 0, effective_mastery: 0 });
  });

  it.each([null, undefined, '', ' ', 'invalid', -1, 101, NaN, Infinity])('never invents mastery from invalid value %s', (value) => {
    expect(run({ metrics: [metric({ current_mastery: value as number | string | null })] }).evidence).toEqual([]);
  });

  it.each([null, '', 0, -1, 1.5, NaN, Infinity])('requires a positive integer observation count, not %s', (value) => {
    expect(run({ metrics: [metric({ current_mastery: 20, total_events: value })] }).evidence).toEqual([]);
  });

  it('accepts numeric PostgREST strings without rounding away real values', () => {
    expect(run({ metrics: [metric({ current_mastery: '23.5', total_events: '4' })] }).primary)
      .toMatchObject({ raw_mastery: 23.5, effective_mastery: 23.5, total_events: 4 });
  });

  it('labels fewer than four observations as limited evidence', () => {
    expect(run({ metrics: [metric({ current_mastery: 20, total_events: 1 })] }).primary).toMatchObject({ evidence_strength: 'limited' });
    expect(run({ metrics: [metric({ current_mastery: 20, total_events: 4 })] }).primary).toMatchObject({ evidence_strength: 'established' });
  });

  it('requires four observations for a declining-trend gap', () => {
    expect(run({ metrics: [metric({ current_mastery: 70, trend: 'declining', total_events: 3 })] }).evidence).toEqual([]);
    expect(run({ metrics: [metric({ current_mastery: 70, trend: 'declining', total_events: 4 })] }).primary)
      .toMatchObject({ type: 'critical_gap', trigger: 'declining' });
  });

  it('shows retention drop from raw above 80 to effective at or below 80', () => {
    expect(run({ metrics: [metric({ last_event_at: ago(74) })] }).primary)
      .toMatchObject({ type: 'critical_gap', trigger: 'retention_drop', raw_mastery: 90, effective_mastery: 67.5 });
  });

  it('requires raw mastery above 80 and age strictly over 30 days for review', () => {
    expect(run({ metrics: [metric({ last_event_at: ago(30) })] }).evidence.map(e => e.type)).not.toContain('spaced_review');
    expect(run({ metrics: [metric({ last_event_at: ago(30.5) })] }).evidence.find(e => e.type === 'spaced_review'))
      .toMatchObject({ days_since_last_event: 30 });
    expect(run({ metrics: [metric({ current_mastery: 80, last_event_at: ago(31) })] }).evidence.map(e => e.type)).not.toContain('spaced_review');
  });

  it('does not infer review from age alone for a low-mastery skill', () => {
    expect(run({ metrics: [metric({ current_mastery: 30, last_event_at: ago(100) })] }).evidence.map(e => e.type)).toEqual(['critical_gap']);
  });

  it('uses exactly the shared forgetting curve and preserves its floor', () => {
    for (const age of [0, 14, 24, 74, 134, 3650]) {
      const result = run({ metrics: [metric({ current_mastery: 90, last_event_at: ago(age) })] });
      for (const item of result.evidence) {
        if (item.type === 'critical_gap' || item.type === 'spaced_review') {
          expect(item.effective_mastery).toBe(effectiveMastery(90, ago(age), NOW));
          expect(item.effective_mastery).toBeGreaterThanOrEqual(45);
        }
      }
    }
    expect(run({ metrics: [metric({ last_event_at: ago(74) })] }).evidence.find(e => e.type === 'spaced_review'))
      .toMatchObject({ effective_mastery: 67.5 });
  });

  it('does not decay already effective metrics twice', () => {
    const raw = [metric({ last_event_at: ago(74) })];
    expect(run({ metrics: withEffectiveMastery(raw, NOW) })).toEqual(run({ metrics: raw }));
  });

  it('does not fall back to effective mastery when raw mastery is explicitly missing', () => {
    expect(run({ metrics: [metric({ current_mastery: 20, raw_mastery: null })] }).evidence).toEqual([]);
  });

  it.each([null, 'invalid', ago(-1)])('does not derive age or decay from timestamp %s', (last_event_at) => {
    expect(run({ metrics: [metric({ last_event_at })] }).evidence).toEqual([]);
    expect(run({ metrics: [metric({ current_mastery: 20, last_event_at })] }).primary)
      .toMatchObject({ last_event_at: null, days_since_last_event: null, effective_mastery: 20 });
  });

  it('never uses updated_at as a practice timestamp', () => {
    const row = { ...metric({ last_event_at: null }), updated_at: ago(100) };
    expect(run({ metrics: [row] }).evidence).toEqual([]);
  });
});

describe('explicit source links and safe fallback', () => {
  it('requires an explicit goal link and computes a 21-day deadline', () => {
    expect(run({ goals: [goal] }).evidence).toEqual([]);
    expect(run({ goals: [goal], linkedGoalIds: [goal.id] }).primary)
      .toMatchObject({ type: 'goal_milestone', goal_id: goal.id, days_until_target: 21, basis: 'linked_record' });
  });

  it('uses calendar-day deadline boundaries including today and overdue dates', () => {
    expect(run({ goals: [{ ...goal, target_date: '2026-10-27' }], linkedGoalIds: [goal.id] }).primary).toMatchObject({ days_until_target: 0 });
    expect(run({ goals: [{ ...goal, target_date: '2026-10-25' }], linkedGoalIds: [goal.id] }).primary).toMatchObject({ days_until_target: -2 });
  });

  it('retains an explicit active goal link without inventing a missing deadline', () => {
    expect(run({ goals: [{ ...goal, target_date: 'invalid' }], linkedGoalIds: [goal.id] }).primary).toMatchObject({ days_until_target: null });
  });

  it.each([{ is_achieved: true }, { archived_at: ago(1) }, { deleted_at: ago(1) }, { title: '' }, { source: 'welcome_test_auto', accepted_at: null }])
    ('excludes inactive or unaccepted goals: %j', (extra) => {
      expect(run({ goals: [{ ...goal, ...extra }], linkedGoalIds: [goal.id] }).evidence).toEqual([]);
    });

  it('includes an explicitly accepted diagnostic goal', () => {
    expect(run({ goals: [{ ...goal, source: 'welcome_test_auto', accepted_at: ago(1) }], linkedGoalIds: [goal.id] }).primary?.type).toBe('goal_milestone');
  });

  it('requires a linked current manually recorded teacher note', () => {
    expect(run({ notes: [note] }).evidence).toEqual([]);
    expect(run({ notes: [note], linkedNoteIds: [note.id] }).primary)
      .toMatchObject({ type: 'teacher_note', note_id: note.id, observed_at: note.created_at });
  });

  it.each([{ is_outdated: true }, { deleted_at: ago(1) }, { archived_at: ago(1) }, { used_in_worksheet_id: 'worksheet-1' },
    { entry_source: 'student_self' }, { entry_source: 'ai-suggested' }, { created_at: 'invalid' }, { created_at: ago(-1) }])
    ('excludes unsupported teacher-note evidence: %j', (extra) => {
      expect(run({ notes: [{ ...note, ...extra }], linkedNoteIds: [note.id] }).evidence).toEqual([]);
    });

  it('deduplicates links and ignores missing or conflicting source IDs', () => {
    expect(run({ notes: [note], linkedNoteIds: [note.id, note.id, 'missing'] }).evidence).toHaveLength(1);
    expect(run({ notes: [note, { ...note, is_outdated: true }], linkedNoteIds: [note.id] }).evidence).toEqual([]);
    expect(run({ goals: [goal, { ...goal, is_achieved: true }], linkedGoalIds: [goal.id] }).evidence).toEqual([]);
  });

  it('returns references without copying private note content or goal titles', () => {
    const privateGoal = { ...goal, title: 'Confidential acquisition discussion' };
    const privateNote = { ...note, content: 'Private company and personal medical details' };
    const result = JSON.stringify(run({ goals: [privateGoal], notes: [privateNote], linkedGoalIds: [goal.id], linkedNoteIds: [note.id] }));
    expect(result).not.toContain(privateGoal.title);
    expect(result).not.toContain(privateNote.content);
  });

  it('identifies the existing phase-bound lesson without claiming it is next or completed', () => {
    expect(run({ suggestion: { ...suggestion, phase_id: phase.id, sequence_number: 3 }, phases: [phase] }).primary)
      .toMatchObject({ type: 'curriculum_step', suggestion_id: suggestion.id, phase_id: phase.id, phase_sequence: 2, step_sequence: 3 });
  });

  it.each([{ status: 'completed' }, { status: 'paused' }, { deleted_at: ago(1) }, { sequence_number: 0 }])
    ('does not support an inactive/invalid phase: %j', (extra) => {
      expect(run({ suggestion: { ...suggestion, phase_id: phase.id, sequence_number: 1 }, phases: [{ ...phase, ...extra }] }).evidence).toEqual([]);
    });

  it('does not invent curriculum evidence for a missing phase or sequence', () => {
    expect(run({ suggestion: { ...suggestion, phase_id: phase.id }, phases: [phase] }).evidence).toEqual([]);
    expect(run({ suggestion: { ...suggestion, phase_id: phase.id, sequence_number: 1 }, phases: [] }).evidence).toEqual([]);
    expect(run({ suggestion: { ...suggestion, phase_id: phase.id, sequence_number: 1, suggested_topic: '' }, phases: [phase] }).evidence).toEqual([]);
  });

  it('requires explicit diagnostic linkage and usable scored answers', () => {
    expect(run({ diagnostics: [diagnostic] }).evidence).toEqual([]);
    expect(run({ diagnostics: [diagnostic], linkedDiagnosticTestId: diagnostic.id }).primary)
      .toMatchObject({ type: 'diagnostic_baseline', test_id: diagnostic.id, answered_count: 20, scored_count: 16 });
  });

  it.each([{ status: 'in_progress' }, { completed_at: null }, { completed_at: 'invalid' }, { completed_at: ago(-1) },
    { answered_count: 0 }, { scored_count: 0 }, { scored_count: -1 }, { scored_count: 21 }, { scored_count: NaN }, { answered_count: 2.5 }])
    ('does not infer diagnostic failure from incomplete/unscored evidence: %j', (extra) => {
      expect(run({ diagnostics: [{ ...diagnostic, ...extra }], linkedDiagnosticTestId: diagnostic.id }).evidence).toEqual([]);
    });

  it('uses all six evidence types with deterministic gap-first priority', () => {
    const result = run({
      suggestion: { ...suggestion, phase_id: phase.id, sequence_number: 1 }, metrics: [metric({ last_event_at: ago(134) })],
      goals: [goal], linkedGoalIds: [goal.id], notes: [note], linkedNoteIds: [note.id], phases: [phase],
      diagnostics: [diagnostic], linkedDiagnosticTestId: diagnostic.id,
    });
    expect(result.status).toBe('supported');
    expect(result.evidence.map(e => e.type)).toEqual(['critical_gap', 'spaced_review', 'goal_milestone', 'teacher_note', 'curriculum_step', 'diagnostic_baseline']);
    expect(result.primary).toEqual(result.evidence[0]);
  });

  it('is deterministic, accepts Date clocks and never mutates nested inputs', () => {
    const input: RecommendationExplainabilityInput = {
      suggestion: Object.freeze({ ...suggestion, focus_skill_names: Object.freeze([SKILL]) }), now: NOW,
      metrics: Object.freeze([Object.freeze(metric({ last_event_at: ago(74) }))]),
      goals: Object.freeze([Object.freeze(goal)]), linkedGoalIds: Object.freeze([goal.id]),
    };
    const before = JSON.stringify(input);
    const a = explainRecommendation(input);
    expect(explainRecommendation(input)).toEqual(a);
    expect(explainRecommendation({ ...input, now: new Date(NOW) })).toEqual(a);
    expect(JSON.stringify(input)).toBe(before);
  });
});