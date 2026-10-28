import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const modal = readFileSync('src/components/homework/CreateHomeworkModal.tsx', 'utf8');

describe('homework reminder needs a deadline', () => {
  it('stores no reminder when there is no deadline, and says so in the form', () => {
    expect(modal).toMatch(/reminder_hours: sendReminder && deadline \? parseInt\(reminderHours\) : null/);
    expect(modal).toMatch(/disabled=\{!deadline\}/);
    expect(modal).toMatch(/Pick a deadline to send a reminder\./);
  });
});
