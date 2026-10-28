import { describe, expect, it } from 'vitest';
import { STANDALONE_CONTEXT, resolveDraftContext, shouldHydrateDraft } from '../useWorksheetFormPersistence';

describe('draft context scoping', () => {
  it('does not restore student A\'s draft when the form is opened for student B', () => {
    expect(shouldHydrateDraft('student-A', 'student-B')).toBe(false);
  });

  it('restores the draft for the same student', () => {
    expect(shouldHydrateDraft('student-A', 'student-A')).toBe(true);
  });

  it('keeps standalone drafts out of a student form and student drafts out of a Dashboard new worksheet', () => {
    expect(shouldHydrateDraft(STANDALONE_CONTEXT, 'student-A')).toBe(false);
    expect(shouldHydrateDraft('student-A', STANDALONE_CONTEXT)).toBe(false);
    expect(shouldHydrateDraft(STANDALONE_CONTEXT, STANDALONE_CONTEXT)).toBe(true);
  });

  it('restores on a refresh or plain open (unknown context), e.g. after a failed generation', () => {
    expect(shouldHydrateDraft('student-A', null)).toBe(true);
    expect(shouldHydrateDraft(STANDALONE_CONTEXT, null)).toBe(true);
  });

  it('derives the context of drafts written before the context field existed', () => {
    expect(resolveDraftContext({ data: { selectedStudentId: 'student-A' } })).toBe('student-A');
    expect(resolveDraftContext({ data: {} })).toBe(STANDALONE_CONTEXT);
    expect(resolveDraftContext({ context: 'student-B', data: { selectedStudentId: 'student-A' } })).toBe('student-B');
  });
});
