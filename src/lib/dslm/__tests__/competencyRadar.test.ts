import { describe, it, expect } from 'vitest';
import {
  buildCategoryCompetencies,
  buildRadarRows,
  classifyZone,
  weakestSkillInCategory,
  zoneCounts,
  CRITICAL_GAP_BELOW,
  MASTERED_AT_OR_ABOVE,
} from '../competencyRadar';

const skill = (over: Partial<Parameters<typeof buildCategoryCompetencies>[0] extends readonly (infer T)[] ? T : never> = {}) => ({
  skill_name: 'grammar.modal_might',
  skill_category: 'grammar',
  micro_skill: 'mod',
  raw_mastery: 70,
  current_mastery: 70,
  total_events: 5,
  trend: 'stable',
  last_event_at: '2026-10-01T00:00:00Z',
  ...over,
});

describe('classifyZone', () => {
  it('keeps the approved thresholds (critical below 50, mastered at 80)', () => {
    expect(CRITICAL_GAP_BELOW).toBe(50);
    expect(MASTERED_AT_OR_ABOVE).toBe(80);
  });

  it('critical gap wins over every other signal', () => {
    expect(classifyZone(90, 49.9)).toBe('critical_gap');
    expect(classifyZone(10, 0)).toBe('critical_gap');
  });

  it('retention alert requires a strong stored mastery that has faded', () => {
    expect(classifyZone(85, 70)).toBe('retention_alert');
    expect(classifyZone(80, 80)).not.toBe('retention_alert');
    expect(classifyZone(79, 60)).toBe('in_progress');
  });

  it('mastered requires effective mastery at or above 80', () => {
    expect(classifyZone(82, 80)).toBe('mastered');
    expect(classifyZone(95, 81)).toBe('mastered');
    expect(classifyZone(90, 79.9)).toBe('retention_alert');
  });

  it('everything else is in progress', () => {
    expect(classifyZone(60, 60)).toBe('in_progress');
    expect(classifyZone(50, 50)).toBe('in_progress');
  });
});

describe('buildCategoryCompetencies', () => {
  it('averages raw and effective layers separately per category', () => {
    const rows = buildCategoryCompetencies([
      skill({ raw_mastery: 80, current_mastery: 60 }),
      skill({ skill_name: 'grammar.passive', raw_mastery: 40, current_mastery: 40 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('grammar');
    expect(rows[0].rawAvg).toBe(60);
    expect(rows[0].effectiveAvg).toBe(50);
    expect(rows[0].skillCount).toBe(2);
  });

  it('excludes flashcard skills and invalid mastery values', () => {
    const rows = buildCategoryCompetencies([
      skill({ skill_name: 'flashcard:abc123', raw_mastery: 90, current_mastery: 90 }),
      skill({ skill_name: 'vocabulary.collocations', skill_category: 'vocabulary', micro_skill: null, raw_mastery: 90, current_mastery: 90 }),
      skill({ skill_name: 'broken', raw_mastery: 'nope', current_mastery: 10 }),
      skill({ skill_name: 'negative', raw_mastery: -5, current_mastery: 10 }),
      skill({ skill_name: null as unknown as string, raw_mastery: 50, current_mastery: 50 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('vocabulary');
  });

  it('never applies decay itself: effective layer is taken as supplied', () => {
    const rows = buildCategoryCompetencies([skill({ raw_mastery: 90, current_mastery: 90 })]);
    expect(rows[0].effectiveAvg).toBe(90);
    expect(rows[0].zone).toBe('mastered');
  });

  it('returns an empty list for empty or null input', () => {
    expect(buildCategoryCompetencies([])).toEqual([]);
    expect(buildCategoryCompetencies(null)).toEqual([]);
    expect(buildCategoryCompetencies(undefined)).toEqual([]);
  });

  it('groups skills without a category under other', () => {
    const rows = buildCategoryCompetencies([skill({ skill_category: null })]);
    expect(rows[0].category).toBe('other');
  });
});

describe('buildRadarRows', () => {
  it('sorts weakest category first and carries both layers', () => {
    const comps = buildCategoryCompetencies([
      skill({ raw_mastery: 90, current_mastery: 90 }),
      skill({ skill_name: 'vocabulary.x', skill_category: 'vocabulary', raw_mastery: 30, current_mastery: 20 }),
    ]);
    const rows = buildRadarRows(comps);
    expect(rows[0].category).toBe('Vocabulary');
    expect(rows[0]).toMatchObject({ raw: 30, effective: 20, zone: 'critical_gap' });
    expect(rows[1]).toMatchObject({ category: 'Grammar', raw: 90, effective: 90, zone: 'mastered' });
  });
});

describe('weakestSkillInCategory', () => {
  it('picks the lowest effective mastery, breaking ties deterministically', () => {
    const focus = weakestSkillInCategory(
      [
        skill({ skill_name: 'grammar.b', raw_mastery: 50, current_mastery: 40 }),
        skill({ skill_name: 'grammar.a', raw_mastery: 50, current_mastery: 40 }),
        skill({ skill_name: 'grammar.c', raw_mastery: 20, current_mastery: 40 }),
        skill({ skill_name: 'grammar.d', raw_mastery: 90, current_mastery: 90 }),
      ],
      'grammar',
    );
    expect(focus?.skill_name).toBe('grammar.c');
  });

  it('ignores flashcards, other categories and invalid rows', () => {
    const focus = weakestSkillInCategory(
      [
        skill({ skill_name: 'flashcard:zzz', raw_mastery: 1, current_mastery: 1 }),
        skill({ skill_name: 'vocabulary.x', skill_category: 'vocabulary', raw_mastery: 1, current_mastery: 1 }),
        skill({ skill_name: 'grammar.ok', raw_mastery: 55, current_mastery: 55 }),
      ],
      'grammar',
    );
    expect(focus?.skill_name).toBe('grammar.ok');
    expect(focus?.zone).toBe('in_progress');
  });

  it('returns null when the category has no valid skills', () => {
    expect(weakestSkillInCategory([], 'grammar')).toBeNull();
    expect(weakestSkillInCategory([skill()], 'speaking')).toBeNull();
  });
});

describe('zoneCounts', () => {
  it('counts every zone in a stable shape', () => {
    const comps = buildCategoryCompetencies([
      skill({ raw_mastery: 90, current_mastery: 90 }),
      skill({ skill_name: 'vocabulary.x', skill_category: 'vocabulary', raw_mastery: 85, current_mastery: 60 }),
      skill({ skill_name: 'reading.x', skill_category: 'reading', raw_mastery: 30, current_mastery: 30 }),
      skill({ skill_name: 'writing.x', skill_category: 'writing', raw_mastery: 65, current_mastery: 65 }),
    ]);
    expect(zoneCounts(comps)).toEqual({ critical_gap: 1, retention_alert: 1, mastered: 1, in_progress: 1 });
  });
});
