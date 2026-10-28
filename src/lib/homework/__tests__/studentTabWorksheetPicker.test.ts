import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const tab = readFileSync('src/components/student-homework/StudentHomeworkTab.tsx', 'utf8');
const modal = readFileSync('src/components/homework/CreateHomeworkModal.tsx', 'utf8');

describe('Student tab homework creation', () => {
  it('lets the teacher choose the worksheet and builds the modal from the chosen one', () => {
    expect(tab).toMatch(/Worksheet for the new homework/);
    expect(tab).toMatch(/worksheetId=\{chosenWorksheet\.id\}/);
    expect(tab).toMatch(/loadWorksheetContent\(chosenWorksheet\)/);
    expect(tab).not.toMatch(/firstWorksheet/);
  });

  it('remounts the modal per worksheet so a selection never carries over', () => {
    expect(tab).toMatch(/key=\{chosenWorksheet\.id\}/);
  });
});

describe('Create homework deadline', () => {
  it('defaults from the next booked lesson and never overrides a deadline the teacher set', () => {
    expect(modal).toMatch(/suggestDeadlineFromLessons\(slots/);
    expect(modal).toMatch(/\.eq\('status', 'booked'\)/);
    expect(modal).toMatch(/if \(!open \|\| !selectedStudentId \|\| deadlineTouched\) return;/);
  });
});
