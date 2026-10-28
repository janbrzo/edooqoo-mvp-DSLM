/**
 * Server-side AI evaluation of SUBMITTED homework answers: right after the student's submit
 * (processSubmittedHomework, the browser no longer grades) and, for rows that did not finish
 * (closed tab, model error), in the scheduled run (processHomeworkAiEvaluations).
 *
 * verify-open-answers results, scoreToMastery, aiAlternativeMastery (typed closed
 * items), averageScoredMastery / calculateExerciseMastery, written with
 * eval_trigger 'submit_homework' so the homework trigger creates the
 * submit_hw_AI_evaluation event. Idempotent: the final UPDATE only applies while
 * ai_evaluation is still NULL, so a finished row is never overwritten.
 */
import { buildClosedItemContext } from '../_shared/closedItemContext.ts';
import { buildClosedItemEvaluations } from '../_shared/closedRatings.ts';
import { selectClosedItemsForAi } from '../_shared/closedEvaluation.ts';
import {
  aiAlternativeMastery, applyAiAlternatives, averageScoredMastery, calculateExerciseMastery,
  calculateItemMastery, CLOSED_EXERCISE_TYPES, isClosedExerciseType, isOpenExerciseType, isSelectionType,
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

/**
 * Ratings and mastery of one evaluated homework exercise, exactly as the client computes them.
 * The ratings of a closed exercise are rebuilt here from the answers and the homework's exercise
 * snapshot; the browser's `storedItemEvaluations` are never the source of a closed rating.
 */
export function computeHomeworkWrite(params: {
  exerciseType: string;
  exercise: any;
  answers: Record<string, unknown>;
  evaluations: any[];
  transcribed: (q: number) => boolean;
}): HomeworkWrite {
  const { exerciseType, exercise, answers, evaluations, transcribed } = params;
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
    const base = buildClosedItemEvaluations(exerciseType, exercise, answers as any);
    const items = base === null ? null : hasRaised ? applyAiAlternatives(base, raised).items : base;
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

type RowOutcome = 'processed' | 'skipped';
type RunResult = { processed: number; failed: number; skipped: number };

/**
 * Evaluates one submitted answer row. Returns 'skipped' when another run owns it, it has nothing
 * to evaluate or the answers changed meanwhile; throws on a failure the claim retries later.
 */
async function evaluateHomeworkRow(
  supabase: any, supabaseUrl: string, serviceKey: string, row: HomeworkAnswerRow,
  metaCache: Map<string, Promise<HomeworkMeta | null>>,
): Promise<RowOutcome> {
  // Atomic attempt counter: another run (or a retry spacing) may own this row.
  const { data: claimed, error: claimError } = await supabase.rpc('claim_homework_answer_ai_attempt', { p_id: row.id });
  if (claimError) throw claimError;
  if (!claimed) return 'skipped';

  if (!metaCache.has(row.homework_id)) metaCache.set(row.homework_id, loadHomeworkMeta(supabase, row.homework_id));
  const meta = await metaCache.get(row.homework_id)!;
  const exercise = meta?.exercises?.[row.exercise_index];
  if (!meta || !exercise) {
    await supabase.rpc('mark_homework_answer_ai_not_evaluable', { p_id: row.id, p_note: 'exercise not found' });
    return 'skipped';
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
  const resolvable = isClosed
    ? buildClosedAnswersToVerify(row, exercise, answers)
    : buildOpenAnswersToVerify(row, exercise, answers, audioAnswers, transcriptions, meta.worksheetAudioTranscript);
  // D9: of the closed items only typed ones the key marks wrong or uncertain can be raised by the model.
  const toVerify = isClosed ? selectClosedItemsForAi(row.exercise_type, resolvable, answers) : resolvable;
  if (resolvable.length === 0) {
    await supabase.rpc('mark_homework_answer_ai_not_evaluable', { p_id: row.id, p_note: 'no evaluable answers' });
    return 'skipped';
  }

  // Nothing the model could change: no call, the row is still written (events, mastery) as before.
  let ai: any = { evaluations: [] };
  if (toVerify.length > 0) {
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
    ai = await res.json();
    if (!Array.isArray(ai.evaluations) || ai.evaluations.length === 0) throw new Error('AI returned no evaluations');
  }
  // A partial result for an open exercise would replace the exercise's ratings with a subset.
  if (!isClosed && Number(ai.unevaluated_count) > 0) throw new Error(`AI left ${ai.unevaluated_count} item(s) unevaluated`);

  const write = computeHomeworkWrite({
    exerciseType: row.exercise_type,
    exercise,
    answers,
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
  return Array.isArray(written) && written.length > 0 ? 'processed' : 'skipped';
}

async function evaluateRows(
  supabase: any, supabaseUrl: string, serviceKey: string, rows: HomeworkAnswerRow[], label: string,
): Promise<RunResult> {
  const result: RunResult = { processed: 0, failed: 0, skipped: 0 };
  const metaCache = new Map<string, Promise<HomeworkMeta | null>>();
  const queue: HomeworkAnswerRow[] = [...rows];
  const work = async () => {
    while (true) {
      const row = queue.shift();
      if (!row) return;
      try {
        result[await evaluateHomeworkRow(supabase, supabaseUrl, serviceKey, row, metaCache)]++;
      } catch (e) {
        result.failed++;
        console.error(`[${label}] ${row.id} failed:`, (e as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, () => work()));
  console.log(`[${label}] ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`);
  return result;
}

/** Selection types the AI never reads: their ratings come from the key alone. */
const SELECTION_TYPE_FILTER = ['multiple-choice', 'true-false', 'matching', 'categorize', 'odd-one-out']
  .map((p) => `exercise_type.like.${p}%`).join(',');

/** Every closed type (key-only ratings for unsubmitted drafts). */
const CLOSED_TYPE_FILTER = CLOSED_EXERCISE_TYPES
  .filter((t) => !t.endsWith('-audio') && !t.endsWith('-picture'))
  .map((t) => `exercise_type.like.${t}%`).join(',');

type SelectionRow = Pick<HomeworkAnswerRow, 'id' | 'homework_id' | 'exercise_index' | 'exercise_type' | 'answers' | 'last_saved_at'>;

/**
 * Closed rows are graded here from the answer key and the homework snapshot, replacing the
 * ratings the browser sent: submitted selection rows (multiple choice, true/false, matching, ...)
 * with `eval_trigger` 'submit_homework', unsubmitted drafts of any closed type with
 * '10min_inactivity' (key only, no AI), so a draft never keeps a rating the student wrote
 * himself. A student save resets the marker to NULL; the UPDATE only applies while the
 * answers and the submitted flag are the ones graded.
 */
async function finalizeClosedRows(supabase: any, rows: SelectionRow[], submitted: boolean): Promise<RunResult> {
  const result: RunResult = { processed: 0, failed: 0, skipped: 0 };
  const metaCache = new Map<string, Promise<HomeworkMeta | null>>();
  for (const row of rows) {
    try {
      if (!metaCache.has(row.homework_id)) metaCache.set(row.homework_id, loadHomeworkMeta(supabase, row.homework_id));
      const exercise = (await metaCache.get(row.homework_id))?.exercises?.[row.exercise_index];
      const answers = (row.answers && typeof row.answers === 'object' ? row.answers : {}) as Record<string, unknown>;
      if (!exercise || !(submitted ? isSelectionType(row.exercise_type) : isClosedExerciseType(row.exercise_type)) || Object.keys(answers).length === 0) { result.skipped++; continue; }
      const items = buildClosedItemEvaluations(row.exercise_type, exercise, answers as any);
      const mastery = calculateExerciseMastery(row.exercise_type, exercise, answers as any);
      const { data: written, error } = await supabase
        .from('homework_student_answers')
        .update({
          eval_trigger: submitted ? 'submit_homework' : '10min_inactivity',
          ...(items ? { item_evaluations: items } : {}),
          ...(mastery !== null ? { mastery } : {}),
        })
        .eq('id', row.id)
        .eq('is_submitted', submitted)
        .eq('last_saved_at', row.last_saved_at)
        .select('id');
      if (error) throw error;
      result[Array.isArray(written) && written.length > 0 ? 'processed' : 'skipped']++;
    } catch (e) {
      result.failed++;
      console.error(`[homework-closed] ${row.id} failed:`, (e as Error).message);
    }
  }
  if (rows.length > 0) {
    console.log(`[homework-closed] ${submitted ? 'submitted' : 'draft'}: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`);
  }
  return result;
}

const SELECTION_COLUMNS = 'id, homework_id, exercise_index, exercise_type, answers, last_saved_at';

/** Scheduled run: submitted answers whose evaluation never arrived. */
export async function processHomeworkAiEvaluations(
  supabase: any, supabaseUrl: string, serviceKey: string, limit: number,
): Promise<RunResult> {
  const { data: rows, error } = await supabase.rpc('list_homework_answers_needing_ai_evaluation', { p_limit: limit });
  if (error) {
    console.warn('[homework-ai] scan unavailable:', error.message);
    return { processed: 0, failed: 0, skipped: 0 };
  }
  const ai = await evaluateRows(supabase, supabaseUrl, serviceKey, rows || [], 'homework-ai');
  // Closed rows whose grading did not run: submitted selection rows (closed tab, function error)
  // and drafts, whose ratings the browser wrote.
  const graceMs = 3 * 60 * 1000;
  const horizonMs = 14 * 24 * 60 * 60 * 1000;
  const pendingSubmitted = await supabase
    .from('homework_student_answers')
    .select(SELECTION_COLUMNS)
    .eq('is_submitted', true)
    .or('eval_trigger.is.null,eval_trigger.eq.10min_inactivity')
    .or(SELECTION_TYPE_FILTER)
    .lte('submitted_at', new Date(Date.now() - graceMs).toISOString())
    .gte('submitted_at', new Date(Date.now() - horizonMs).toISOString())
    .order('submitted_at')
    .limit(limit);
  const pendingDrafts = await supabase
    .from('homework_student_answers')
    .select(SELECTION_COLUMNS)
    .eq('is_submitted', false)
    .is('eval_trigger', null)
    .or(CLOSED_TYPE_FILTER)
    .lte('last_saved_at', new Date(Date.now() - graceMs).toISOString())
    .gte('last_saved_at', new Date(Date.now() - horizonMs).toISOString())
    .order('last_saved_at')
    .limit(limit);
  const total: RunResult = { ...ai };
  for (const [scan, submitted] of [[pendingSubmitted, true], [pendingDrafts, false]] as const) {
    if (scan.error) {
      console.warn('[homework-closed] scan unavailable:', scan.error.message);
      continue;
    }
    const r = await finalizeClosedRows(supabase, (scan.data || []) as SelectionRow[], submitted);
    total.processed += r.processed; total.failed += r.failed; total.skipped += r.skipped;
  }
  return total;
}

/**
 * Right after the student's submit: the AI-evaluated rows of ONE homework, without the
 * 3-minute grace of the scheduled scan. The browser no longer grades anything; the same
 * claim (3 attempts, 10 minutes apart) keeps retries owned by the scheduled run.
 */
export async function processSubmittedHomework(
  supabase: any, supabaseUrl: string, serviceKey: string, homeworkId: string,
): Promise<RunResult> {
  const { data: rows, error } = await supabase
    .from('homework_student_answers')
    .select('id, homework_id, student_email, exercise_index, exercise_type, answers, audio_answers, item_evaluations, last_saved_at')
    .eq('homework_id', homeworkId)
    .eq('is_submitted', true)
    .is('ai_evaluation', null)
    .lt('ai_eval_attempts', 3)
    .order('exercise_index');
  if (error) throw error;
  const hasContent = (v: unknown) => !!v && typeof v === 'object' && Object.keys(v as object).length > 0;
  const due = ((rows || []) as HomeworkAnswerRow[]).filter(
    (r) => isHomeworkAiType(r.exercise_type) && (hasContent(r.answers) || hasContent(r.audio_answers)),
  );
  const ai = await evaluateRows(supabase, supabaseUrl, serviceKey, due, 'homework-submit');
  const selection = ((rows || []) as HomeworkAnswerRow[]).filter((r) => isSelectionType(r.exercise_type));
  const closed = await finalizeClosedRows(supabase, selection, true);
  return { processed: ai.processed + closed.processed, failed: ai.failed + closed.failed, skipped: ai.skipped + closed.skipped };
}
