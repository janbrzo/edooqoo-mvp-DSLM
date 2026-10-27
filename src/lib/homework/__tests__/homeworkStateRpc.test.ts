import { describe, it, expect } from 'vitest';
import { isHomeworkClosedError, markDoneOutcome } from '../homeworkStateRpc';

describe('isHomeworkClosedError', () => {
  it('recognises the server message for a teacher-closed homework', () => {
    expect(isHomeworkClosedError({ message: 'homework_closed: the teacher closed this homework' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isHomeworkClosedError({ message: 'Invalid share token for homework' })).toBe(false);
    expect(isHomeworkClosedError(null)).toBe(false);
  });
});

describe('markDoneOutcome', () => {
  it('reports a done homework', () => {
    expect(markDoneOutcome({ success: true })).toEqual({ kind: 'done' });
  });

  it('reports a homework that was already returned or closed instead of claiming a change', () => {
    expect(markDoneOutcome({ success: true, already_completed: true })).toEqual({ kind: 'already' });
  });

  it('reports a refusal (success:false is not a thrown error) with the server message', () => {
    expect(markDoneOutcome({ success: false, error: 'Homework not found' })).toEqual({ kind: 'error', message: 'Homework not found' });
    expect(markDoneOutcome(null).kind).toBe('error');
  });
});
