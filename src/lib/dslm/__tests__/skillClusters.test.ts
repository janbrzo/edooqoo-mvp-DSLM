import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildClusters, buildSkillClustersSource, CSV_PATH, OUT_PATH } from '../../../../scripts/dslm/build-skill-clusters.mjs';
import { SKILL_CLUSTERS } from '../../../../supabase/functions/_shared/skillClusters';
import { canonicalSkill, canonicalSkillKey, clusterForKey, grammarMicroSkill, isExcludedSkillKey, skillLabel } from '../../../../supabase/functions/_shared/skillLabels';
import { buildWeakAreasBlock, groupSkillMetrics } from '../../../../supabase/functions/_shared/dslmPromptCore';
import { buildAllowedFocusSkillsBlock, resolveFocusSkills } from '../../../../supabase/functions/_shared/focusSkills';

const NOW = Date.parse('2026-10-27T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 86400000).toISOString();
const row = (skill_name: string, mastery: number, events: number, ageDays: number, extra: Record<string, unknown> = {}) => ({
  skill_name, skill_category: 'vocabulary', micro_skill: null, current_mastery: mastery, total_events: events, trend: 'stable', last_event_at: day(ageDays), ...extra,
});

describe('generated skillClusters.ts', () => {
  it('equals the output of scripts/dslm/build-skill-clusters.mjs for the reviewed CSV', () => {
    const csv = fs.readFileSync(CSV_PATH, 'utf8');
    expect(fs.readFileSync(OUT_PATH, 'utf8')).toBe(buildSkillClustersSource(csv));
  });

  it('uses only scenario 2 HIGH/MED rows and never a LOW row', () => {
    const csv = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
    expect(csv.length).toBeGreaterThan(0);
    for (const r of csv) {
      expect(r[0]).toBe('2');
      expect(['HIGH', 'MED']).toContain(r[2]);
    }
    expect(buildClusters(fs.readFileSync(CSV_PATH, 'utf8'))).toHaveLength(SKILL_CLUSTERS.length);
    expect(SKILL_CLUSTERS.length).toBe(190);
  });

  it('has no key in two clusters, the cluster key is one of its members and contains no student data', () => {
    const seen = new Set<string>();
    for (const c of SKILL_CLUSTERS) {
      expect(c.members).toContain(c.key);
      expect(c.members.length).toBeGreaterThan(1);
      expect(c.label).toMatch(/^[a-z_]+: /);
      for (const m of c.members) {
        expect(seen.has(m)).toBe(false);
        seen.add(m);
        const [cat, rest] = m.split('|'); expect(canonicalSkill(rest, cat).exactKey).toBe(m);
      }
    }
    expect(seen.size).toBe(590);
    expect(fs.readFileSync(CSV_PATH, 'utf8')).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('canonicalSkill with the cluster table', () => {
  it('keeps the exact canonical form for keys outside the table', () => {
    const c = canonicalSkill('ns.B1.grammar.something_unique_zz', 'grammar');
    expect(c.key).toBe('grammar|something_unique_zz');
    expect(c.exactKey).toBe(c.key);
    expect(c.clusterLabel).toBeNull();
    expect(canonicalSkillKey('ns.vocab.x', 'vocabulary')).toBe('vocabulary|x');
  });

  it('pools reviewed HIGH variants and keeps category meaning', () => {
    expect(canonicalSkillKey('detail_extraction', 'listening')).toBe(canonicalSkillKey('specific_information_retrieval', 'listening'));
    expect(canonicalSkillKey('detail_extraction', 'listening')).not.toBe(canonicalSkillKey('detail_extraction', 'reading'));
    expect(canonicalSkillKey('ns.A2.reading.main_idea_identification', 'reading')).toBe(canonicalSkillKey('identify_main_idea', 'reading'));
    const c = canonicalSkill('main_idea_identification', 'reading');
    expect(c.category).toBe('reading');
    expect(c.clusterLabel).toMatch(/^reading: /);
    expect(clusterForKey(c.exactKey)?.key).toBe(c.key);
  });

  it('never merges across categories', () => {
    for (const c of SKILL_CLUSTERS) {
      const cats = new Set(c.members.map((m) => m.split('|')[0]));
      expect(cats.size).toBe(1);
    }
  });

  it('skillLabel stays the exact label', () => {
    expect(skillLabel('main_idea_identification', 'reading')).toBe('reading: main idea identification');
  });
});

describe('groupSkillMetrics pooling', () => {
  it('pools cluster members into one group with the cluster label', () => {
    const rows = [
      row('detail_extraction', 40, 2, 3, { skill_category: 'listening' }),
      row('specific_information_retrieval', 30, 1, 2, { skill_category: 'listening' }),
    ];
    const { all, weak } = groupSkillMetrics(rows, NOW);
    expect(all).toHaveLength(1);
    expect(all[0].events).toBe(3);
    expect(all[0].tier).toBe('AUTHORITATIVE');
    expect(weak).toHaveLength(1);
    expect(all[0].label).toBe(canonicalSkill('detail_extraction', 'listening').clusterLabel);
  });
});

describe('grammar micro_skill grouping (three tier hierarchy)', () => {
  const g = (name: string, micro: string | null, mastery: number, events: number, extra: Record<string, unknown> = {}) =>
    row(name, mastery, events, 2, { skill_category: 'grammar', micro_skill: micro, ...extra });

  it('groups grammar rows by a real micro_skill', () => {
    const { all } = groupSkillMetrics([g('ns.B1.grammar.a_x', 'present_simple', 40, 2), g('ns.B1.grammar.b_y', 'present_simple', 50, 1)], NOW, { grammarByMicro: true });
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe('grammar|micro:present_simple');
    expect(all[0].label).toBe('grammar: present simple');
    expect(all[0].events).toBe(3);
  });

  it('keeps different micro skills apart and keeps the category', () => {
    const { all } = groupSkillMetrics([g('a_x', 'present_simple', 40, 1), g('b_y', 'modal_verbs', 40, 1)], NOW, { grammarByMicro: true });
    expect(all.map((x) => x.key).sort()).toEqual(['grammar|micro:modal_verbs', 'grammar|micro:present_simple']);
  });

  it('ignores generic micro skills (falls back to the exact or cluster key)', () => {
    for (const micro of ['grammar_other', 'grammar', 'general', null, '']) {
      const { all } = groupSkillMetrics([g('ns.B1.grammar.modal_might', micro, 40, 1)], NOW);
      expect(all[0].key).toBe(canonicalSkill('ns.B1.grammar.modal_might', 'grammar').key);
    }
  });

  it('never uses micro_skill outside grammar', () => {
    expect(grammarMicroSkill({ skill_name: 'x', skill_category: 'vocabulary', micro_skill: 'vocabulary' })).toBeNull();
    const { all } = groupSkillMetrics([
      row('idiom_a', 40, 1, 2, { micro_skill: 'idioms' }),
      row('idiom_b', 40, 1, 2, { micro_skill: 'idioms' }),
      row('talk_a', 40, 1, 2, { skill_category: 'speaking', micro_skill: 'present_simple' }),
    ], NOW);
    expect(all).toHaveLength(3);
    expect(all.every((x) => !x.key.includes('micro:'))).toBe(true);
  });

  it('does not merge a grammar micro skill with a speaking skill of the same name', () => {
    const { all } = groupSkillMetrics([g('a_x', 'present_simple', 40, 1), row('present_simple', 40, 1, 2, { skill_category: 'speaking', micro_skill: 'present_simple' })], NOW);
    expect(all).toHaveLength(2);
  });
});

describe('data hygiene', () => {
  it('flags position fallbacks and test leftovers', () => {
    for (const k of ['other|question_0', 'other|question_14', 'other|qa.forged.skill_l2', 'vocabulary|test_item']) expect(isExcludedSkillKey(k)).toBe(true);
    for (const k of ['grammar|question_words', 'vocabulary|test_items', 'other|questions', 'grammar|modal_might']) expect(isExcludedSkillKey(k)).toBe(false);
  });

  it('keeps them out of weak areas and focus candidates', () => {
    const rows = [
      row('question_3', 0, 3, 1, { skill_category: 'other' }),
      row('ns.other.qa.forged.skill_l2', 0, 3, 1, { skill_category: 'other' }),
      row('test_item', 0, 3, 1),
      row('ns.vocab.real_skill', 30, 3, 1),
    ];
    const { all, weak } = groupSkillMetrics(rows, NOW);
    expect(all.map((g) => g.key)).toEqual(['vocabulary|real_skill']);
    expect(buildWeakAreasBlock(rows, 10, NOW)).not.toMatch(/question|forged|test item/i);
    const allowed = weak.map((g) => ({ label: g.label, key: g.key }));
    expect(buildAllowedFocusSkillsBlock(allowed)).not.toMatch(/question|forged|test item/i);
    expect(resolveFocusSkills(['other: question 3'], allowed).dropped).toBe(1);
  });

  it('says there is no evidence when only junk rows exist', () => {
    expect(buildWeakAreasBlock([row('test_item', 0, 3, 1)], 10, NOW)).toMatch(/NO SKILL EVIDENCE/);
  });
});

describe('focus skills with clusters', () => {
  it('resolves a cluster label and a member name to the cluster key', () => {
    const rows = [row('detail_extraction', 40, 3, 1, { skill_category: 'listening' })];
    const allowed = groupSkillMetrics(rows, NOW).weak.map((g) => ({ label: g.label, key: g.key }));
    expect(resolveFocusSkills([allowed[0].label], allowed).keys).toEqual([allowed[0].key]);
    expect(resolveFocusSkills([allowed[0].key], allowed).keys).toEqual([allowed[0].key]);
  });
});

describe('grammar micro pooling is off by default', () => {
  it('keeps two grammar rows of one micro skill apart unless the option is passed', () => {
    const rows = [
      { skill_name: 'ns.B1.grammar.a_x', skill_category: 'grammar', micro_skill: 'present_simple', current_mastery: 40, total_events: 2, last_event_at: new Date(NOW).toISOString() },
      { skill_name: 'ns.B1.grammar.b_y', skill_category: 'grammar', micro_skill: 'present_simple', current_mastery: 90, total_events: 3, last_event_at: new Date(NOW).toISOString() },
    ];
    expect(groupSkillMetrics(rows, NOW).all).toHaveLength(2);
    expect(groupSkillMetrics(rows, NOW, { grammarByMicro: true }).all).toHaveLength(1);
  });
});
