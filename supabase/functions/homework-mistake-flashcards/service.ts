import { extractHomeworkMistakes, record, type MistakeAnswerRow } from '../_shared/homeworkMistakeExtractor.ts';

export interface MistakeSource {
  homework: {
    id: string; teacher_id: string; student_id: string; title: string; share_token: string | null;
    selected_exercises: unknown; attempt: number; reviewed_at: string | null; completed_at: string | null;
    completed_by_teacher: boolean | null;
  };
  student: { id: string; teacher_id: string; student_email: string | null; deleted_at: string | null };
  answers: MistakeAnswerRow[];
}
export interface MistakeRequest {
  mode: 'preview' | 'create'; homework_id: string; share_token?: string; student_email?: string;
}
export interface SavedMistakes { set_id: string; share_token: string; created_count: number; existing_count: number }
export class MistakeFailure extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
export interface MistakeDependencies {
  load: (id: string) => Promise<MistakeSource | null>;
  save: (source: MistakeSource, cards: ReturnType<typeof extractHomeworkMistakes>, teacherId: string | null, request: MistakeRequest) => Promise<SavedMistakes>;
}
export async function handleMistakes(request: MistakeRequest, teacherId: string | null, deps: MistakeDependencies) {
  const source = await deps.load(request.homework_id);
  if (!source || !record(source.homework) || !record(source.student)) throw new MistakeFailure('not_allowed', 403);
  const { homework: hw, student } = source;
  const owner = !!teacherId && teacherId === hw.teacher_id;
  const learner = !!request.share_token && request.share_token === hw.share_token && !!request.student_email
    && !!student.student_email && request.student_email.trim().toLowerCase() === student.student_email.trim().toLowerCase();
  if ((!owner && !learner) || student.deleted_at || student.id !== hw.student_id || student.teacher_id !== hw.teacher_id) throw new MistakeFailure('not_allowed', 403);
  if (!hw.completed_at || hw.completed_by_teacher || (!owner && !hw.reviewed_at)) throw new MistakeFailure('not_reviewed', 409);
  const cards = extractHomeworkMistakes(hw.selected_exercises, source.answers);
  if (request.mode === 'preview') return { count: cards.length };
  if (!cards.length) throw new MistakeFailure('no_mistakes', 409);
  return deps.save(source, cards, owner ? teacherId : null, request);
}