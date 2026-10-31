import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleMistakes, MistakeFailure, type MistakeSource } from './service.ts';

const source: MistakeSource = {
  homework: { id: 'homework', teacher_id: 'owner', student_id: 'learner', title: 'Requests', share_token: 'proof', attempt: 1,
    reviewed_at: '2026-10-31', completed_at: '2026-10-30', completed_by_teacher: false,
    selected_exercises: [{ type: 'multiple-choice', questions: [{ question: 'Choose a polite request.', options: [{ text: 'Send it!', correct: false }, { text: 'Could you send it?', correct: true }] }] }] },
  student: { id: 'learner', teacher_id: 'owner', student_email: 'learner@example.test', deleted_at: null },
  answers: [{ exercise_index: 0, exercise_type: 'multiple-choice', answers: { 0: 'Send it!' }, is_submitted: true, eval_trigger: 'submit_homework', item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true }] }],
};
const result = { set_id: 'set', share_token: 'token', created_count: 1, existing_count: 0 };
Deno.test('teacher preview returns count, not private source or a write', async () => {
  let saves = 0;
  const response = await handleMistakes({ mode: 'preview', homework_id: 'homework' }, 'owner', {
    load: () => Promise.resolve(source), save: () => { saves++; return Promise.resolve(result); },
  });
  assertEquals(response, { count: 1 }); assertEquals(saves, 0);
});
Deno.test('assigned learner may create only after publication', async () => {
  let saves = 0;
  const request = { mode: 'create' as const, homework_id: 'homework', share_token: 'proof', student_email: ' LEARNER@example.test ' };
  await handleMistakes(request, null, { load: () => Promise.resolve(source), save: () => { saves++; return Promise.resolve(result); } });
  assertEquals(saves, 1);
  await assertRejects(() => handleMistakes(request, null, {
    load: () => Promise.resolve({ ...source, homework: { ...source.homework, reviewed_at: null } }),
    save: () => { saves++; return Promise.resolve(result); },
  }), MistakeFailure, 'not_reviewed');
  assertEquals(saves, 1);
});
Deno.test('wrong learner token cannot create or expose count', async () => {
  let saves = 0;
  await assertRejects(() => handleMistakes({ mode: 'create', homework_id: 'homework', share_token: 'wrong', student_email: 'learner@example.test' }, null, {
    load: () => Promise.resolve(source), save: () => { saves++; return Promise.resolve(result); },
  }), MistakeFailure, 'not_allowed');
  assertEquals(saves, 0);
});