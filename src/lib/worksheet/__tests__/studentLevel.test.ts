import { describe, expect, it } from 'vitest';
import {
  decideLevelBandForStudent,
  formatStudentLevelLabel,
  levelMismatchWarning,
} from '../studentLevel';

describe('student level helpers', () => {
  it('never prints (null) or (unknown) in the student label', () => {
    expect(formatStudentLevelLabel(null)).toBe('level not set');
    expect(formatStudentLevelLabel('unknown')).toBe('level not set');
    expect(formatStudentLevelLabel('B2')).toBe('B2');
  });

  it('uses the student band, or B1/B2 with a flag when the level is missing', () => {
    expect(decideLevelBandForStudent('C1')).toEqual({ band: 'C1/C2', usedDefault: false });
    expect(decideLevelBandForStudent(null)).toEqual({ band: 'B1/B2', usedDefault: true });
    expect(decideLevelBandForStudent('unknown')).toEqual({ band: 'B1/B2', usedDefault: true });
  });

  it('warns only when the chosen band differs from a known student band', () => {
    expect(levelMismatchWarning('A1/A2', 'C1')).toMatch(/C1/);
    expect(levelMismatchWarning('C1/C2', 'C1')).toBeNull();
    expect(levelMismatchWarning('A1/A2', null)).toBeNull();
  });
});
