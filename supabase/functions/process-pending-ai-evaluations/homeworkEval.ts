/**
 * Server-side AI evaluation of SUBMITTED homework answers whose evaluation never
 * arrived (the student closed the tab while the browser path was running).
 *
 * Same scoring as the homework client (useInteractiveHomework.submitHomework):
 * verify-open-answers results, scoreToMastery, aiAlternativeMastery (typed closed
 * items), averageScoredMastery / calculateExerciseMastery, written with
 * eval_trigger 'submit_homework' so the homework trigger creates the
 * submit_hw_AI_evaluation event. Idempotent: the final UPDATE only applies while
 * ai_evaluation is still NULL, so a finished browser path is never overwritten.
 */
import { buildClosedItemContext } from '../_shared/closedItemContext.ts';
import {
  aiAlternativeMastery, applyAiAlternatives, averageScoredMastery, calculateExerciseMastery,
  calculateItemMastery, isClosedExerciseType, isOpenExerciseType, isSelectionType,
} from '../_shared/itemMastery.ts';
import { resolveEnglishLevel } from '../_shared/englishLevel.ts';
import { buildOpenAnswerContext, openExerciseContextString, openExerciseItems } from '../_shared/openAnswerContext.ts';
import { buildOpenItemEvaluations, buildQuestionEvaluations, validNanoSkills } from './itemBuilder.ts';

export interface HomeworkAnswerRow {
  id: string;
  homework_id: string;
  student_email: string;
  exercise_index: number;
  exercise_type: string;
  answers: Record<string, unknown> | null;
  audio_answers: Record<string, string> | null;
  item_evaluations: any[] | null;
  last_saved_at: string;
}

/** Closed types the AI may raise (typed answers); selection items cannot have an alternative. */
export const isHomeworkAiType = (t: string): boolean =>
  isOpenExerciseType(t) || (isClosedExerciseType(t) && !isSelectionType(t));

const answeredIndexes = (answers: Record<string, unknown>): number[] => {
  const idx = new Set<number>();
  for (const k of Object.keys(answers)) {
    if (k.startsWith('_')) continue;
    const n = parseInt(k);
    if (!isNaN(n)) idx.add(n);
  }
  return [...idx].sort((a, b) => a - b);
};

/** Items sent to verify-open-answers for a closed exercise (answer key as ground truth). */
export function buildClosedAnswersToVerify(row: Pick<HomeworkAnswerRow, 'exercise_index' | 'exercise_type'>, exercise: any, answers: Record<string, unknown>) {
  const out: any[] = [];
  for (const q of answeredIndexes(answers)) {
    const ctx = buildClosedItemContext(row.exercise_type, exercise, q, answers as Record<string | number, any>);
    if (!ctx) continue;
    out.push({
      exercise_index: row.exercise_index,
      question_index: q,
      question_text: ctx.question_text,
      student_answer: ctx.student_answer,
      suggested_answer: ctx.suggested_answer,
      key_verdict: ctx.key_verdict,
      exercise_type: row.exercise_type,
    });
  }
  return out;
}

/** Items sent for an open exercise: written answer, or the transcription for audio-only. */
export function buildOpenAnswersToVerify(
  row: Pick<HomeworkAnswerRow, 'exercise_index' | 'exercise_type'>,
  exercise: any,
  answers: Record<string, unknown>,
  audioAnswers: Record<string, string>,
  transcriptions: Record<number, { text: string; wordCount: number; duration?: number }>,
  worksheetAudioTranscript: string | null,
) {
  const idx = new Set<number>(answeredIndexes(answers));
  for (const k of Object.keys(audioAnswers || {})) {
    const n = parseInt(k);
    if (!isNaN(n)) idx.add(n);
  }
  const out: any[] = [];
  const items = openExerciseItems(exercise);
  for (const q of [...idx].sort((a, b) => a - b)) {
    if (!items[q]) continue;
    const written = answers[String(q)];
    const hasWritten = !!(written && String(written).trim());
    const tr = transcriptions[q];
    if (!hasWritten && !tr) continue;
    const ctx = buildOpenAnswerContext({ exercise, questionIndex: q, worksheetAudioTranscript, includeInstructions: true });
    out.push({
      exercise_index: row.exercise_index,
      question_index: q,
      question_text: ctx.question_text,
      student_answer: hasWritten ? String(written) : '',
      suggested_answer: ctx.suggested_answer || undefined,
      exercise_type: row.exercise_type,
      ...(tr ? {
        audio_transcription: tr.text,
        audio_word_count: tr.wordCount,
        ...(tr.duration ? { audio_duration_seconds: tr.duration } : {}),
      } : {}),
    });
  }
  return out;
}

export interface HomeworkWrite {
  ai_evaluation: { question_evaluations: any[] };
  /** null: keep the stored value (as the client RPC does). */
  item_evaluations: any[] | null;
  mastery: number | null;
}

/** Ratings and mastery of one evaluated homework exercise, exactly as the client computes them. */
export function computeHomeworkWrite(params: {
  exerciseType: string;
  exercise: any;
  answers: Record<string, unknown>;
  storedItemEvaluations: any[] | null;
  evaluations: any[];
  transcribed: (q: number) => boolean;
}): HomeworkWrite {
  const { exerciseType, exercise, answers, storedItemEvaluations, evaluations, transcribed } = params;
  const aiEvaluation = buildQuestionEvaluations({ evaluations, answers, hasAudio: transcribed });

  if (isClosedExerciseType(exerciseType)) {
    const raised: Record<number, number> = {};
    for (const qEval of aiEvaluation.question_evaluations) {
      const qi = qEval.question_index ?? 0;
      const key = calculateItemMastery(exerciseType, exercise, qi, (answers as any)[qi], answers as any);
      const up = aiAlternativeMastery(exerciseType, key, qEval, (answers as any)[qi]);
      if (up !== null) raised[qi] = up;
    }
    const hasRaised = Object.keys(raised).length > 0;
    const items = hasRaised && Array.isArray(storedItemEvaluations) && storedItemEvaluations.length > 0
      ? applyAiAlternatives(storedItemEvaluations, raised).items
      : null;
    return {
      ai_evaluation: aiEvaluation,
      item_evaluations: items,
      mastery: calculateExerciseMastery(exerciseType, exercise, answers as any, hasRaised ? raised : undefined),
    };
  }

  const itemEvals = buildOpenItemEvaluations({
    evaluations, questionItems: openExerciseItems(exercise), answers, hasAudio: transcribed,
  });
  return {
    ai_evaluation: aiEvaluation,
    item_evaluations: itemEvals.length === 0 ? null : itemEvals,
    mastery: averageScoredMastery(itemEvals),
  };
}

export { validNanoSkills };

interface HomeworkMeta { exercises: any[]; studentLevel: unknown; worksheetAudioTranscript: string | null }

async function loadHomeworkMeta(supabase: any, homeworkId: string): Promise<HomeworkMeta | null> {
  const { data: hw } = await supabase
    .from('homework_assignments')
    .select('selected_exercises, student_id, source_worksheet_id')
    .eq('id', homeworkId)
    .maybeSingle();
  if (!hw || !Array.isArray(hw.selected_exercises)) return null;
  let studentLevel: unknown = null;
  if (hw.student_id) {
    const { data: st } = await supabase.from('students').select('english_level').eq('id', hw.student_id).maybeSingle();
    studentLevel = st?.english_level;
  }
  let transcript: string | null = null;
  if (hw.source_worksheet_id) {
    try {
      const { data: ws } = await supabase.from('worksheets').select('ai_response').eq('id', hw.source_worksheet_id).maybeSingle();
      const parsed = typeof ws?.ai_response === 'string' ? JSON.parse(ws.ai_response) : ws?.ai_response;
      if (typeof parsed?.audio_transcript === 'string' && parsed.audio_transcript.trim()) transcript = parsed.audio_transcript;
    } catch { /* source worksheet unreadable: graded without the transcript */ }
  }
  return { exercises: hw.selected_exercises, studentLevel, worksheetAudioTranscript: transcript };
}

/** Recorded audio answers (http url) with no transcription. */
export function missingTranscriptions(
  audioAnswers: Record<string, string>,
  transcriptions: Record<number, unknown>,
): number[] {
  const out: number[] = [];
  for (const [q, url] of Object.entries(audioAnswers || {})) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
    const n = parseInt(q);
    if (isNaN(n) || transcriptions[n]) continue;
    out.push(n);
  }
  return out;
}

async function transcribeAll(
  supabaseUrl: string, serviceKey: string, audioAnswers: Record<string, string>,
): Promise<Record<number, { text: string; wordCount: number; duration?: number }>> {
  const map: Record<number, { text: string; wordCount: number; duration?: number }> = {};
  for (const [q, url] of Object.entries(audioAnswers || {})) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ audio_url: url }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (typeof data.transcription === 'string' && data.transcription.trim()) {
        const words = data.transcription.split(/\s+/).filter((w: string) => w.length > 0);
        map[parseInt(q)] = {
          text: data.transcription,
          wordCount: words.length,
          ...(typeof data.duration === 'number' && data.duration > 0 ? { duration: data.duration } : {}),
        };
      }
    } catch (e) {
      console.error(`[homework-ai] transcription failed for q${q}:`, (e as Error).message);
    }
  }
  return map;
}

export async function processHomeworkAiEvaluations(
  supabase: any, supabaseUrl: string, serviceKey: string, limit: number,
): Promise<{ processed: number; failed: number; skipped: number }> {
  const result = { processed: 0, failed: 0, skipped: 0 };
  const { data: rows, error } = await supabase.rpc('list_homework_answers_needing_ai_evaluation', { p_limit: limit });
  if (error) {
    console.warn('[homework-ai] scan unavailable:', error.message);
    return result;
  }
  const metaCache = new Map<string, Promise<HomeworkMeta | null>>();
  const queue: HomeworkAnswerRow[] = [...(rows || [])];

  const work = async () => {
    while (true) {
      const row = queue.shift();
      if (!row) return;
      try {
        // Atomic attempt counter: another run (or a retry spacing) may own this row.
        const { data: claimed, error: claimError } = await supabase.rpc('claim_homework_answer_ai_attempt', { p_id: row.id });
        if (claimError) throw claimError;
        if (!claimed) { result.skipped++; continue; }

        if (!metaCache.has(row.homework_id)) metaCache.set(row.homework_id, loadHomeworkMeta(supabase, row.homework_id));
        const meta = await metaCache.get(row.homework_id)!;
        const exercise = meta?.exercises?.[row.exercise_index];
        if (!meta || !exercise) {
          await supabase.rpc('mark_homework_answer_ai_not_evaluable', { p_id: row.id, p_note: 'exercise not found' });
          result.skipped++;
          continue;
        }

        const answers = (row.answers && typeof row.answers === 'object' ? row.answers : {}) as Record<string, unknown>;
        const audioAnswers = (row.audio_answers && typeof row.audio_answers === 'object' ? row.audio_answers : {}) as Record<string, string>;
        const isClosed = isClosedExerciseType(row.exercise_type);
        const transcriptions = isClosed ? {} : await transcribeAll(supabaseUrl, serviceKey, audioAnswers);
        if (!isClosed) {
          // A recorded answer without a transcription (transient failure) must be retried by the
          // claim, not dropped: the row would otherwise finish with that item permanently unevaluated.
          const missing = missingTranscriptions(audioAnswers, transcriptions);
          if (missing.length > 0) throw new Error(`Transcription missing for audio answer(s) ${missing.join(', ')}`);
        }
        const toVerify = isClosed
          ? buildClosedAnswersToVerify(row, exercise, answers)
          : buildOpenAnswersToVerify(row, exercise, answers, audioAnswers, transcriptions, meta.worksheetAudioTranscript);
        if (toVerify.length === 0) {
          await supabase.rpc('mark_homework_answer_ai_not_evaluable', { p_id: row.id, p_note: 'no evaluable answers' });
          result.skipped++;
          continue;
        }

        const res = await fetch(`${supabaseUrl}/functions/v1/verify-open-answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            answers: toVerify,
            english_level: resolveEnglishLevel(meta.studentLevel),
            context: isClosed
              ? 'Homework submission - individual question evaluation'
              : openExerciseContextString(exercise, `Exercise ${row.exercise_index + 1}`, { worksheetAudioTranscript: meta.worksheetAudioTranscript }),
          }),
        });
        if (!res.ok) throw new Error(`AI verification failed: ${await res.text()}`);
        const ai = await res.json();
        if (!Array.isArray(ai.evaluations) || ai.evaluations.length === 0) throw new Error('AI returned no evaluations');
        // A partial result for an open exercise would replace the exercise's ratings with a subset.
        if (!isClosed && Number(ai.unevaluated_count) > 0) throw new Error(`AI left ${ai.unevaluated_count} item(s) unevaluated`);

        const write = computeHomeworkWrite({
          exerciseType: row.exercise_type,
          exercise,
          answers,
          storedItemEvaluations: row.item_evaluations,
          evaluations: ai.evaluations,
          transcribed: (q) => !!transcriptions[q],
        });
        const mergedAnswers: Record<string, unknown> = { ...answers };
        for (const [q, t] of Object.entries(transcriptions)) mergedAnswers[`_transcription_${q}`] = t.text;

        const patch: Record<string, unknown> = {
          answers: mergedAnswers,
          ai_evaluation: write.ai_evaluation,
          eval_trigger: 'submit_homework',
          ...(write.item_evaluations ? { item_evaluations: write.item_evaluations } : {}),
          ...(write.mastery !== null ? { mastery: write.mastery } : {}),
        };
        // Only while nobody else finished it and the answers are the ones evaluated.
        const { data: written, error: updateError } = await supabase
          .from('homework_student_answers')
          .update(patch)
          .eq('id', row.id)
          .is('ai_evaluation', null)
          .eq('last_saved_at', row.last_saved_at)
          .select('id');
        if (updateError) throw updateError;
        if (Array.isArray(written) && written.length > 0) result.processed++; else result.skipped++;
      } catch (e) {
        result.failed++;
        console.error(`[homework-ai] ${row.id} failed:`, (e as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, () => work()));
  console.log(`[homework-ai] ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`);
  return result;
}
