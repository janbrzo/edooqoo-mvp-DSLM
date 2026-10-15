import { describe, it, expect } from 'vitest';
import { isSkillSkipped, skillAttempts } from '../skillAttempts';

const qs = [
  { element_type: 'grammar', student_answer: 'a' },
  { element_type: 'grammar', student_answer: null },
  { element_type: 'writing', student_answer: '' },
  { element_type: 'writing', student_answer: undefined },
  { element_type: 'reading', student_answer: '__IDK__' },
];

describe('skillAttempts', () => {
  it('counts attempted answers per skill', () => {
    expect(skillAttempts(qs, 'grammar')).toEqual({ total: 2, attempted: 1 });
    expect(skillAttempts(qs, 'writing')).toEqual({ total: 2, attempted: 0 });
  });
  it('flags a skill with questions but no attempt', () => {
    expect(isSkillSkipped(qs, 'writing')).toBe(true);
    expect(isSkillSkipped(qs, 'grammar')).toBe(false);
    expect(isSkillSkipped(qs, 'reading')).toBe(false);
  });
  it('is false without questions for the skill', () => {
    expect(isSkillSkipped(qs, 'speaking')).toBe(false);
    expect(isSkillSkipped(undefined, 'writing')).toBe(false);
  });
});
