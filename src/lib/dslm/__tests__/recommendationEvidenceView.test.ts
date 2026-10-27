import { describe, expect, it } from 'vitest';
import { explainRecommendation } from '../recommendationExplainability';
import { evidenceFacts, findEvidenceSuggestion, resolveAppliedEvidenceSuggestion, type ScopedEvidenceSuggestion } from '../recommendationEvidenceView';

const source = { studentId: 'student-1', suggestionId: 'suggestion-2' };
const fields = { topic: 'Handling a client objection', goal: 'Respond diplomatically', grammarFocus: 'modals', additionalInfo: 'Consulting call' };
const row: ScopedEvidenceSuggestion = {
  id: source.suggestionId, student_id: source.studentId, teacher_id: 'teacher-1',
  suggested_topic: fields.topic, suggested_goal: fields.goal, suggested_grammar_focus: fields.grammarFocus,
  suggested_additional_info: fields.additionalInfo, focus_skill_names: ['ns.B1.grammar.modals'],
};
const resolve = (extra: Partial<Parameters<typeof resolveAppliedEvidenceSuggestion>[0]> = {}) => resolveAppliedEvidenceSuggestion({
  source, rows: [row], studentId: source.studentId, teacherId: row.teacher_id, fields, ...extra,
});

describe('exact lesson evidence source', () => {
  it('finds the selected non-first suggestion instead of using the queue head', () => {
    const first = { ...row, id: 'suggestion-1', focus_skill_names: ['ns.grammar.articles'] };
    expect(findEvidenceSuggestion([first, row], source.suggestionId, source.studentId, row.teacher_id)).toBe(row);
  });
  it('never matches source records belonging to another learner or teacher', () => {
    expect(resolve({ studentId: 'student-2' })).toBeNull();
    expect(resolve({ teacherId: 'teacher-2' })).toBeNull();
    expect(resolve({ rows: [{ ...row, student_id: 'student-2' }] })).toBeNull();
    expect(resolve({ rows: [{ ...row, teacher_id: 'teacher-2' }] })).toBeNull();
  });
  it('needs an explicit ID, not an identical topic', () => {
    expect(resolve({ source: null })).toBeNull();
    expect(resolve({ source: { ...source, suggestionId: 'missing' } })).toBeNull();
  });
  it('rejects ambiguous duplicate IDs', () => {
    expect(resolve({ rows: [row, { ...row }] })).toBeNull();
  });
  it('hides explanations after source removal, deletion or successful use', () => {
    expect(resolve({ rows: [] })).toBeNull();
    expect(resolve({ rows: [{ ...row, is_used: true }] })).toBeNull();
    expect(resolve({ rows: [{ ...row, deleted_at: '2026-10-27' }] })).toBeNull();
  });
  it.each(['topic', 'goal', 'grammarFocus', 'additionalInfo'] as const)('hides evidence when the teacher edits %s', key => {
    expect(resolve({ fields: { ...fields, [key]: 'New lesson content' } })).toBeNull();
  });
  it('hides evidence when a refetched source no longer matches the form', () => {
    expect(resolve({ rows: [{ ...row, suggested_topic: 'Changed plan' }] })).toBeNull();
  });
  it('allows harmless whitespace differences and does not mutate the source', () => {
    expect(resolve({ fields: { ...fields, topic: ` ${fields.topic} ` } })).toBe(row);
    expect(row.suggested_topic).toBe(fields.topic);
  });
  it('retains the selected focus skill through form application', () => {
    const selected = resolve();
    const explanation = explainRecommendation({ suggestion: selected, now: Date.parse('2026-10-27'), metrics: [
      { skill_name: 'ns.B1.grammar.modals', current_mastery: 25, total_events: 4 },
      { skill_name: 'ns.grammar.articles', current_mastery: 0, total_events: 20 },
    ] });
    expect(explanation.primary).toMatchObject({ type: 'critical_gap', skill_name: 'ns.B1.grammar.modals', raw_mastery: 25 });
  });
  it('does not turn unknown raw mastery into a displayed zero', () => {
    expect(explainRecommendation({ suggestion: row, now: Date.parse('2026-10-27'), metrics: [
      { skill_name: 'ns.B1.grammar.modals', current_mastery: 0, raw_mastery: null, total_events: 4 },
    ] }).primary).toBeNull();
  });
  it('keeps stored mastery and estimated retention as distinct numerical facts', () => {
    const explanation = explainRecommendation({ suggestion: row, now: Date.parse('2026-10-27'), metrics: [
      { skill_name: 'ns.B1.grammar.modals', current_mastery: 90, total_events: 4, last_event_at: '2026-08-14' },
    ] });
    if (!explanation.primary) throw new Error('Expected retention evidence');
    const facts = evidenceFacts(explanation.primary);
    expect(facts).toContain('Stored mastery: 90%');
    expect(facts).toContain('Estimated retention: 67.5%');
  });
});