import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/HomeworkPage.tsx', 'utf8');
const hook = readFileSync('src/hooks/useInteractiveHomework.tsx', 'utf8');
const recorder = readFileSync('src/components/homework/HomeworkSpeakingRecorder.tsx', 'utf8');

describe('homework submit guards', () => {
  it('submitting is always an explicit click: no countdown submits by itself', () => {
    expect(page).not.toMatch(/Auto-submitting|submitCountdown|countdownIntervalRef/);
  });

  it('refuses a submit with nothing answered', () => {
    expect(page).toMatch(/progress\.answeredTasks === 0/);
  });

  it('a recording that failed to upload stops the submit instead of sending an empty answer', () => {
    expect(recorder).toMatch(/Promise<boolean>/);
    expect(recorder).toMatch(/return false;/);
    expect(hook).toMatch(/A recording was not saved/);
  });

  it('keeps one submit in flight', () => {
    expect(hook).toMatch(/if \(readOnly \|\| submittingRef\.current\) return false;/);
  });
});
