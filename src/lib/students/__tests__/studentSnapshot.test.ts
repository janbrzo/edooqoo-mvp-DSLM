import { describe, it, expect } from 'vitest';
import {
  selectFocusAreas,
  formatNextLessonLabel,
  formatDeadline,
  describeHubStatus,
  MAX_FOCUS_AREAS,
} from '../studentSnapshot';
import { pickNextLesson } from '@/hooks/useStudentNextLesson';
import type { StudentKnowledgeEntry } from '@/types/studentKnowledge';

function entry(over: Partial<StudentKnowledgeEntry> = {}): StudentKnowledgeEntry {
  return {
    id: over.id ?? 'e1',
    student_id: 's1',
    teacher_id: 't1',
    category: 'Skill Assessment',
    content: 'some note',
    tags: [],
    worksheet_id: null,
    entry_source: 'manual',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    is_outdated: false,
    outdated_at: null,
    outdated_reason: null,
    metadata: { skill_subtype: 'weakness' },
    ...over,
  } as StudentKnowledgeEntry;
}

describe('selectFocusAreas', () => {
  it('returns an empty list for missing input', () => {
    expect(selectFocusAreas(undefined)).toEqual([]);
    expect(selectFocusAreas(null)).toEqual([]);
    expect(selectFocusAreas([])).toEqual([]);
  });

  it('prefers nano_skill over content', () => {
    const result = selectFocusAreas([
      entry({ metadata: { skill_subtype: 'weakness', nano_skill: 'past simple' } }),
    ]);
    expect(result).toEqual(['past simple']);
  });

  it('falls back to the first line of content', () => {
    const result = selectFocusAreas([
      entry({ content: 'phrasal verbs\nmore detail here' }),
    ]);
    expect(result).toEqual(['phrasal verbs']);
  });

  it('keeps weakness, mistake and practice but drops strength', () => {
    const result = selectFocusAreas([
      entry({ id: 'a', metadata: { skill_subtype: 'weakness', nano_skill: 'w' } }),
      entry({ id: 'b', metadata: { skill_subtype: 'mistake', nano_skill: 'm' } }),
      entry({ id: 'c', metadata: { skill_subtype: 'practice', nano_skill: 'p' } }),
      entry({ id: 'd', metadata: { skill_subtype: 'strength', nano_skill: 's' } }),
    ]);
    expect(result).toContain('w');
    expect(result).toContain('m');
    expect(result).not.toContain('s');
  });

  it('ignores non Skill Assessment categories', () => {
    const result = selectFocusAreas([
      entry({ category: 'Notes', metadata: { skill_subtype: 'weakness', nano_skill: 'x' } }),
    ]);
    expect(result).toEqual([]);
  });

  it('ignores deleted, outdated and archived entries', () => {
    const result = selectFocusAreas([
      entry({ id: 'a', deleted_at: '2026-09-02T00:00:00Z', metadata: { skill_subtype: 'weakness', nano_skill: 'a' } }),
      entry({ id: 'b', is_outdated: true, metadata: { skill_subtype: 'weakness', nano_skill: 'b' } }),
      entry({ id: 'c', archived_at: '2026-09-02T00:00:00Z', metadata: { skill_subtype: 'weakness', nano_skill: 'c' } }),
    ]);
    expect(result).toEqual([]);
  });

  it('orders by recency, newest first', () => {
    const result = selectFocusAreas([
      entry({ id: 'old', updated_at: '2026-08-01T00:00:00Z', metadata: { skill_subtype: 'weakness', nano_skill: 'old' } }),
      entry({ id: 'new', updated_at: '2026-09-10T00:00:00Z', metadata: { skill_subtype: 'weakness', nano_skill: 'new' } }),
    ]);
    expect(result).toEqual(['new', 'old']);
  });

  it('collapses case-insensitive duplicates', () => {
    const result = selectFocusAreas([
      entry({ id: 'a', updated_at: '2026-09-10T00:00:00Z', metadata: { skill_subtype: 'weakness', nano_skill: 'Past Simple' } }),
      entry({ id: 'b', updated_at: '2026-09-01T00:00:00Z', metadata: { skill_subtype: 'mistake', nano_skill: 'past simple' } }),
    ]);
    expect(result).toEqual(['Past Simple']);
  });

  it('returns at most three labels', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((n, i) =>
      entry({ id: n, updated_at: `2026-09-0${i + 1}T00:00:00Z`, metadata: { skill_subtype: 'weakness', nano_skill: n } }),
    );
    expect(selectFocusAreas(many)).toHaveLength(MAX_FOCUS_AREAS);
  });

  it('truncates long labels', () => {
    const long = 'x'.repeat(120);
    const [label] = selectFocusAreas([entry({ metadata: { skill_subtype: 'weakness', nano_skill: long } })]);
    expect(label.length).toBeLessThanOrEqual(60);
    expect(label.endsWith('…')).toBe(true);
  });

  it('skips entries with no usable text', () => {
    expect(selectFocusAreas([entry({ content: '   ', metadata: { skill_subtype: 'weakness' } })])).toEqual([]);
  });
});

describe('formatNextLessonLabel', () => {
  const now = new Date(2026, 8, 13, 9, 0, 0); // 13 Sep 2026, local

  it('returns null without a lesson', () => {
    expect(formatNextLessonLabel(null, now)).toBeNull();
    expect(formatNextLessonLabel(undefined, now)).toBeNull();
  });

  it('labels today and tomorrow', () => {
    expect(formatNextLessonLabel({ date: '2026-09-13', time: '18:00:00' }, now)).toBe('Today 18:00');
    expect(formatNextLessonLabel({ date: '2026-09-14', time: '09:30:00' }, now)).toBe('Tomorrow 09:30');
  });

  it('labels other days with a weekday', () => {
    expect(formatNextLessonLabel({ date: '2026-09-15', time: '18:00:00' }, now)).toBe('Tue 18:00');
  });

  it('accepts HH:MM without seconds', () => {
    expect(formatNextLessonLabel({ date: '2026-09-13', time: '08:15' }, now)).toBe('Today 08:15');
  });

  it('returns null for malformed rows', () => {
    expect(formatNextLessonLabel({ date: 'nope', time: '18:00' }, now)).toBeNull();
    expect(formatNextLessonLabel({ date: '2026-09-13', time: 'x' }, now)).toBeNull();
  });
});

describe('formatDeadline', () => {
  it('formats a date-only value', () => {
    expect(formatDeadline('2026-11-12')).toBe('Nov 12, 2026');
  });

  it('formats a timestamp by its calendar day', () => {
    expect(formatDeadline('2026-11-12T23:30:00.000Z')).toBe('Nov 12, 2026');
  });

  it('returns null when unset or malformed', () => {
    expect(formatDeadline(null)).toBeNull();
    expect(formatDeadline('')).toBeNull();
    expect(formatDeadline('later')).toBeNull();
  });
});

describe('describeHubStatus', () => {
  it('is enabled when an email exists', () => {
    expect(describeHubStatus('a@b.com')).toEqual({ enabled: true, label: 'Enabled', email: 'a@b.com' });
  });

  it('is not set for blank values', () => {
    expect(describeHubStatus('   ')).toEqual({ enabled: false, label: 'Not set', email: null });
    expect(describeHubStatus(null)).toEqual({ enabled: false, label: 'Not set', email: null });
  });
});

describe('pickNextLesson', () => {
  it('returns null with no rows', () => {
    expect(pickNextLesson([], '2026-09-13')).toBeNull();
    expect(pickNextLesson(null, '2026-09-13')).toBeNull();
  });

  it('picks the earliest upcoming slot', () => {
    const rows = [
      { slot_date: '2026-09-20', start_time: '10:00:00' },
      { slot_date: '2026-09-14', start_time: '16:00:00' },
      { slot_date: '2026-09-14', start_time: '09:00:00' },
    ];
    expect(pickNextLesson(rows, '2026-09-13')).toEqual({ date: '2026-09-14', time: '09:00:00' });
  });

  it('ignores past slots', () => {
    const rows = [{ slot_date: '2026-09-01', start_time: '10:00:00' }];
    expect(pickNextLesson(rows, '2026-09-13')).toBeNull();
  });
});
