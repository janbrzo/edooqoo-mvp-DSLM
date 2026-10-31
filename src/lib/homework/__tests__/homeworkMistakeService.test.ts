import { describe, expect, it, vi } from 'vitest';
import { handleMistakes, type MistakeSource } from '../../../../supabase/functions/homework-mistake-flashcards/service';

const source: MistakeSource = {
  homework: { id: 'hw', teacher_id: 'owner', student_id: 'learner', title: 'Requests', share_token: 'proof', attempt: 1, reviewed_at: '2026-10-31', completed_at: '2026-10-30', completed_by_teacher: false,
    selected_exercises: [{ type: 'multiple-choice', questions: [{ question: 'Choose a request', options: [{ text: 'Send it!', correct: false }, { text: 'Could you send it?', correct: true }] }] }] },
  student: { id: 'learner', teacher_id: 'owner', student_email: 'learner@example.test', deleted_at: null },
  answers: [{ exercise_index: 0, exercise_type: 'multiple-choice', answers: { 0: 'Send it!' }, is_submitted: true, eval_trigger: 'submit_homework', item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true }] }],
};
const request = { mode: 'create' as const, homework_id: 'hw', share_token: 'proof', student_email: 'learner@example.test' };
function deps(value: MistakeSource | null = source) { return { load: vi.fn().mockResolvedValue(value), save: vi.fn().mockResolvedValue({ set_id: 'set', share_token: 'token', created_count: 1, existing_count: 0 }) }; }
describe('Mistake conversion authorization and no-grade contract', () => {
  it('teacher can preview a submitted source without publishing it to the learner', async () => {
    const d = deps({ ...source, homework: { ...source.homework, reviewed_at: null } });
    expect(await handleMistakes({ mode: 'preview', homework_id: 'hw' }, 'owner', d)).toEqual({ count: 1 });
    expect(d.save).not.toHaveBeenCalled();
  });
  it('learner requires published review and matching normalized token/email', async () => {
    const d = deps();
    await handleMistakes({ ...request, student_email: ' LEARNER@example.test ' }, null, d);
    expect(d.save.mock.calls[0]?.[2]).toBeNull();
    expect(d.save.mock.calls[0]?.[1]).toHaveLength(1);
  });
  it.each([
    { ...request, share_token: 'wrong' }, { ...request, student_email: 'other@example.test' },
    { mode: 'create' as const, homework_id: 'hw' },
  ])('rejects unauthorized learner input before any write %j', async req => {
    const d = deps(); await expect(handleMistakes(req, null, d)).rejects.toMatchObject({ code: 'not_allowed' }); expect(d.save).not.toHaveBeenCalled();
  });
  it('foreign teacher cannot convert without learner proof', async () => {
    const d = deps(); await expect(handleMistakes({ mode: 'create', homework_id: 'hw' }, 'foreign', d)).rejects.toMatchObject({ code: 'not_allowed' }); expect(d.save).not.toHaveBeenCalled();
  });
  it.each([
    { ...source, student: { ...source.student, deleted_at: '2026-10-31' } },
    { ...source, student: { ...source.student, teacher_id: 'foreign' } },
    { ...source, student: { ...source.student, id: 'foreign' } }, null,
  ])('rejects deleted and cross-owner sources', async value => {
    const d = deps(value); await expect(handleMistakes(request, null, d)).rejects.toMatchObject({ code: 'not_allowed' }); expect(d.save).not.toHaveBeenCalled();
  });
  it.each([{ reviewed_at: null }, { completed_at: null }, { completed_by_teacher: true }])('rejects unpublished, reopened and teacher-closed learner homework %j', async patch => {
    const d = deps({ ...source, homework: { ...source.homework, ...patch } });
    await expect(handleMistakes(request, null, d)).rejects.toMatchObject({ code: 'not_reviewed' }); expect(d.save).not.toHaveBeenCalled();
  });
  it('no mistakes never creates an empty set', async () => {
    const d = deps({ ...source, answers: [] }); await expect(handleMistakes(request, null, d)).rejects.toMatchObject({ code: 'no_mistakes' }); expect(d.save).not.toHaveBeenCalled();
  });
  it('conversion passes only source-derived text and does not modify source ratings', async () => {
    const before = structuredClone(source);
    const d = deps(); await handleMistakes(request, 'owner', d);
    expect(source).toEqual(before); expect(d.save.mock.calls[0]?.[2]).toBe('owner');
    expect(Object.keys(d.save.mock.calls[0]?.[1]?.[0] ?? {}).sort()).toEqual(['back_text','exercise_index','front_example','front_text','question_index']);
  });
});