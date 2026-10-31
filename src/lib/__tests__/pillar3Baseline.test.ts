import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const ui = [
  'src/components/student-hub/StudentHubHomeworkRow.tsx',
  'src/components/student-hub/HomeworkFeedbackModal.tsx',
  'src/hooks/useStudentHomeworkFeedback.ts',
];

describe('Pillar 3 selected read-only boundaries (not production authorization certification)', () => {
  it('the lifecycle projects the canonical authority without its own clock or I/O', () => {
    const code = read('src/lib/studentHub/homeworkLifecycle.ts');
    expect(code).toContain("from '@/lib/homework/reviewState'");
    expect(code).not.toMatch(/Date\.now\(|new Date\(\)|supabase|localStorage|sessionStorage|fetch\(/);
  });
  it.each(ui)('%s never directly writes homework or flashcards or calls the protected engine', path => {
    expect(read(path)).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|supabase\.rpc|requestHomeworkRedo|generateWorksheet|format-worksheet-prompt/);
  });
  it('Hub bulk payload supplies teacher closure but not raw comments, keys or reviews', () => {
    const code = read('supabase/functions/get-student-hub-data/index.ts');
    const payload = code.slice(code.indexOf('const enrichedHomeworks'), code.indexOf('// 6. Shared worksheets'));
    expect(payload).toContain('completed_by_teacher: h.completed_by_teacher');
    expect(payload).not.toMatch(/teacher_comments|ai_evaluation|item_evaluations|correct_answer/);
  });
  it('feedback reuses only the existing published student review read', () => {
    const adapter = read('src/lib/homework/reviewForStudent.ts');
    expect([...adapter.matchAll(/supabase\.rpc\('([^']+)'/g)].map(match => match[1])).toEqual(['get_homework_review_by_share_token']);
  });
});