import { describe, it, expect } from 'vitest';
import { resolveFocusSkills, buildAllowedFocusSkillsBlock } from '../../../../supabase/functions/_shared/focusSkills';
import { groupSkillMetrics } from '../../../../supabase/functions/_shared/dslmPromptCore';

const allowed = [
  { label: 'grammar: modal might', key: 'grammar|modal_might' },
  { label: 'vocabulary: business email', key: 'vocabulary|business_email' },
  { label: 'grammar: articles', key: 'grammar|articles' },
  { label: 'speaking: small talk', key: 'speaking|small_talk' },
  { label: 'writing: summaries', key: 'writing|summaries' },
];

describe('resolveFocusSkills', () => {
  it('keeps exact label matches with their keys', () => {
    const r = resolveFocusSkills(['grammar: modal might', 'grammar: articles'], allowed);
    expect(r.labels).toEqual(['grammar: modal might', 'grammar: articles']);
    expect(r.keys).toEqual(['grammar|modal_might', 'grammar|articles']);
    expect(r.dropped).toBe(0);
  });
  it('accepts case, whitespace, key and underscore variants', () => {
    const r = resolveFocusSkills(['  GRAMMAR:   Modal  Might ', 'vocabulary|business_email', '- speaking: small_talk'], allowed);
    expect(r.keys).toEqual(['grammar|modal_might', 'vocabulary|business_email', 'speaking|small_talk']);
    expect(r.labels[0]).toBe('grammar: modal might');
  });
  it('drops made-up skills and counts them', () => {
    const r = resolveFocusSkills(['grammar: modal might', 'Negotiating tone', 42, null, {}], allowed);
    expect(r.labels).toEqual(['grammar: modal might']);
    expect(r.dropped).toBe(4);
  });
  it('collapses duplicates without counting them as dropped', () => {
    const r = resolveFocusSkills(['grammar: articles', 'Grammar: Articles', 'grammar|articles'], allowed);
    expect(r.keys).toEqual(['grammar|articles']);
    expect(r.dropped).toBe(0);
  });
  it('caps at 4', () => {
    const r = resolveFocusSkills(allowed.map((a) => a.label), allowed);
    expect(r.labels).toHaveLength(4);
    expect(r.keys).toHaveLength(4);
  });
  it('handles non-array input and empty allowed list', () => {
    expect(resolveFocusSkills(undefined, allowed)).toEqual({ labels: [], keys: [], dropped: 0 });
    expect(resolveFocusSkills(['grammar: articles'], []).dropped).toBe(1);
  });
  it('matches labels produced by groupSkillMetrics', () => {
    const now = Date.now();
    const { weak } = groupSkillMetrics([
      { skill_name: 'ns.B1.grammar.modal_might', skill_category: 'grammar', current_mastery: 30, total_events: 4, last_event_at: new Date(now).toISOString(), trend: 'stable' },
    ], now);
    expect(weak[0].key).toBe('grammar|modal_might');
    const r = resolveFocusSkills([weak[0].label], weak.map((g) => ({ label: g.label, key: g.key })));
    expect(r.keys).toEqual(['grammar|modal_might']);
  });
});

describe('buildAllowedFocusSkillsBlock', () => {
  it('lists labels or states there are none', () => {
    expect(buildAllowedFocusSkillsBlock(allowed)).toContain('  - grammar: articles');
    expect(buildAllowedFocusSkillsBlock([])).toContain('focusSkills": []');
  });
});
