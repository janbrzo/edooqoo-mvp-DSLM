import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { isClosedType } from "../_shared/closedEvaluation.ts";
import { buildClosedItemContext } from "../_shared/closedItemContext.ts";
import { scoreToMastery, aiAlternativeMastery, applyAiAlternatives, isOpenExerciseType, calculateExerciseMastery } from "../_shared/itemMastery.ts";
import { DEFAULT_ENGLISH_LEVEL, resolveEnglishLevel } from "../_shared/englishLevel.ts";
import { resolveCaller } from "../_shared/auth.ts";
import { hasWorksheetStudentAccess, userOwnsWorksheet } from "../_shared/evaluationAccess.ts";
import { hasValidCronSecret } from "../_shared/cronAuth.ts";
import { buildOpenAnswerContext, openExerciseContextString, openExerciseItems } from "../_shared/openAnswerContext.ts";
import { buildOpenItemEvaluations, buildQuestionEvaluations } from "./itemBuilder.ts";
import { processHomeworkAiEvaluations } from "./homeworkEval.ts";

// Supabase Edge runtime hook for work that continues after the response.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** Parallel queue rows per run (each row is one AI call). */
const QUEUE_CONCURRENCY = 3;

/** Submitted homework answers evaluated per scheduled run (the tab fast path handles most). */
const HOMEWORK_ROWS_PER_RUN = 6;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[process-pending-ai-evaluations] Function invoked');
  learnerLevelCache.clear(); // levels are cached per run only
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let worksheetIdFilter: string | null = null;
    let triggerSource: string | null = null;
    let exerciseIndexFilter: number | null = null;
    let body: Record<string, unknown> | null = null;
    try {
      body = await req.json();
      worksheetIdFilter = typeof body?.worksheet_id === 'string' ? body.worksheet_id : null;
      triggerSource = typeof body?.trigger_source === 'string' ? body.trigger_source : null;
      exerciseIndexFilter = typeof body?.exercise_index === 'number' ? body.exercise_index : null;
    } catch {
      // No body provided - process all pending (service callers only)
    }

    // Access: the service role may drain the whole queue; a signed-in user only
    // worksheets they own; a student only their own rows of one shared worksheet
    // (share token + assigned email) and never the teacher-only triggers.
    let studentEmailFilter: string | null = null;
    const caller = await resolveCaller(req);
    // pg_cron authenticates with CRON_SECRET (same as send-homework-reminders).
    const isCron = hasValidCronSecret(req.headers.get('x-cron-secret'), Deno.env.get('CRON_SECRET'));
    const isServiceLike = isCron || caller.kind === 'service';
    if (!isServiceLike) {
      const isOwner = await userOwnsWorksheet(supabase, caller, worksheetIdFilter);
      if (!isOwner) {
        const isStudent = triggerSource !== 'create_homework' && triggerSource !== 'mark_done' &&
          await hasWorksheetStudentAccess(supabase, worksheetIdFilter, body);
        if (!isStudent) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        studentEmailFilter = String(body?.student_email ?? '').trim().toLowerCase();
      }
    }
    
    console.log(`[process-pending] trigger_source: ${triggerSource}, worksheet_id: ${worksheetIdFilter}`);

    // === Auto-queue for create_homework ===
    if ((triggerSource === 'create_homework' || triggerSource === 'mark_done') && worksheetIdFilter) {
      await autoQueueForCreateHomework(supabase, worksheetIdFilter, triggerSource, exerciseIndexFilter);
    }

    const isScheduledRun0 = isServiceLike && !worksheetIdFilter;
    // Scheduled run: queue saved answers that still need evaluation (the
    // student's tab may have been closed before the 10-minute client timer).
    if (isServiceLike && !worksheetIdFilter) {
      await queueStaleWorksheetAnswers(supabase);
    }

    // Scheduled run: homework submitted 3+ minutes ago whose AI evaluation never
    // arrived (student closed the tab). Failures never block the worksheet queue.
    let homeworkResult: { processed: number; failed: number; skipped: number } | null = null;
    if (isScheduledRun0) {
      try {
        homeworkResult = await processHomeworkAiEvaluations(
          supabase, supabaseUrl, supabaseServiceKey, HOMEWORK_ROWS_PER_RUN,
        );
      } catch (e) {
        console.error('[process-pending] homework AI pass failed:', (e as Error).message);
      }
    }

    // Rows are claimed one at a time per worker (atomic; also recovers stale
    // 'processing' rows and retries 'failed' ones), so rows a run never reaches
    // stay 'pending'. While the claim migration is missing, the previous select
    // of 'pending' rows is used as a prefetched list.
    const maxRows = worksheetIdFilter ? 25 : 10;
    const isScheduledRun = isServiceLike && !worksheetIdFilter;
    let claimedCount = 0;
    let prefetched: any[] | null = null;
    const nextPending = async (): Promise<any | null> => {
      if (claimedCount >= maxRows) return null;
      if (prefetched) {
        const row = prefetched.shift() ?? null;
        if (row) claimedCount++;
        return row;
      }
      const res = await claimPendingEvaluations(supabase, 1, worksheetIdFilter, studentEmailFilter, maxRows);
      if (!res.atomic) prefetched = res.rows;
      const row = res.atomic ? (res.rows[0] ?? null) : (prefetched?.shift() ?? null);
      if (row) claimedCount++;
      return row;
    };

    const firstPending = await nextPending();
    if (!firstPending) {
      console.log('[process-pending] No pending evaluations found');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending evaluations', ...(homeworkResult ? { homework: homeworkResult } : {}) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    let processed = 0;
    let failed = 0;
    let skipped = 0;
    
    let seed: any | null = firstPending;
    const runWorker = async () => {
    while (true) {
      const pending = seed ?? await nextPending();
      seed = null;
      if (!pending) break;
      try {
        // Check if AI eval is actually needed
        const { data: needsEval } = await supabase.rpc('needs_ai_evaluation', {
          p_worksheet_id: pending.worksheet_id,
          p_student_email: pending.student_email,
          p_exercise_index: pending.exercise_index
        });
        
        if (!needsEval) {
          console.log(`[process-pending] Skipping ${pending.id} - already evaluated`);
          await supabase
            .from('pending_worksheet_ai_evaluations')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', pending.id);
          skipped++;
          continue;
        }
        
        // Mark as processing
        await supabase
          .from('pending_worksheet_ai_evaluations')
          .update({ status: 'processing' })
          .eq('id', pending.id);

        let answers = pending.answers || {};
        let context = pending.context || {};
        let questionItems: any[] = Array.isArray(context.questions) ? context.questions : [];
        const effectiveTriggerSource = triggerSource || context.trigger_source || (isScheduledRun ? '10min_inactivity' : null);
        
        // Fetch audio answers from the source table
        let audioAnswers: Record<string, string> = {};
        let storedItemEvaluations: any[] | null = null;
        // Version of the stored row the closed raise is computed from (see the write below).
        let readLastSavedAt: string | null = null;
        // A save made after this read must still count as not evaluated, so
        // last_ai_eval_at is the time the answers were read, not when the write ends.
        const answersReadAt = new Date().toISOString();
        try {
          const { data: answerRow } = await supabase
            .from('worksheet_student_answers')
            .select('answers, audio_answers, item_evaluations, last_saved_at')
            .eq('worksheet_id', pending.worksheet_id)
            .eq('student_email', pending.student_email)
            .eq('exercise_index', pending.exercise_index)
            .maybeSingle();
          readLastSavedAt = answerRow?.last_saved_at ?? null;
          
          if (answerRow?.audio_answers && typeof answerRow.audio_answers === 'object') {
            audioAnswers = answerRow.audio_answers as Record<string, string>;
          }
          if (Array.isArray(answerRow?.item_evaluations)) {
            storedItemEvaluations = answerRow.item_evaluations as any[];
          }
          // Evaluate what is stored now, not the copy queued earlier (another tab or
          // device may have saved since); closed items are rebuilt for those answers.
          const stored = answerRow?.answers;
          if (stored && typeof stored === 'object' && Object.keys(stored).length > 0
              && JSON.stringify(stored) !== JSON.stringify(answers)) {
            answers = stored as Record<string, unknown>;
            if (Array.isArray(context.closed_items)) {
              const rebuilt = await buildClosedItemsFromWorksheet(
                supabase, pending.worksheet_id, pending.exercise_index, pending.exercise_type, answers,
              );
              if (rebuilt) context = { ...context, closed_items: rebuilt };
            }
          }
        } catch (e) {
          console.error('[process-pending] Error fetching audio_answers:', e);
        }

        // Open exercises: questions, key and source text (passage, transcript, image)
        // come from the worksheet when the queued context lacks them (title-only rows).
        let worksheetExercise: any | null = null;
        let worksheetAudioTranscript: string | null = null;
        const closedPendingEarly = Array.isArray(context.closed_items) && context.closed_items.length > 0;
        if (!closedPendingEarly) {
          const src = await loadWorksheetSource(supabase, pending.worksheet_id, pending.exercise_index);
          worksheetExercise = src.exercise;
          worksheetAudioTranscript = src.audioTranscript;
          if (questionItems.length === 0) questionItems = openExerciseItems(worksheetExercise);
        }
        const openExercise = {
          ...(worksheetExercise || {}),
          ...(questionItems.length > 0 ? { questions: questionItems } : {}),
          title: worksheetExercise?.title || context.title,
        };
        console.log(`[process-pending] Written answers: ${Object.keys(answers).length}, Audio answers: ${Object.keys(audioAnswers).length}`);

        // Transcribe audio answers
        const transcriptionMap: Record<number, { text: string; wordCount: number; duration?: number }> = {};
        for (const [qIdxStr, audioUrl] of Object.entries(audioAnswers)) {
          if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) continue;
          const qIdx = parseInt(qIdxStr);
          try {
            const transcResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({ audio_url: audioUrl })
            });
            if (transcResponse.ok) {
              const transcData = await transcResponse.json();
              if (transcData.transcription) {
                const words = transcData.transcription.split(/\s+/).filter((w: string) => w.length > 0);
                transcriptionMap[qIdx] = {
                  text: transcData.transcription,
                  wordCount: words.length,
                  // Seconds, only when transcribe-audio reports it (never guessed).
                  ...(typeof transcData.duration === 'number' && transcData.duration > 0 ? { duration: transcData.duration } : {}),
                };
                console.log(`[process-pending] Transcribed q${qIdx}: ${words.length} words`);
              }
            } else {
              const errText = await transcResponse.text();
              console.error(`[process-pending] Transcription HTTP error for q${qIdx}:`, errText);
            }
          } catch (e) {
            console.error(`[process-pending] Transcription failed for q${qIdx}:`, e);
          }
        }

        console.log(`[process-pending] Transcriptions: ${Object.keys(transcriptionMap).length}/${Object.keys(audioAnswers).length} audio questions transcribed`);

        // Persist transcriptions to worksheet_student_answers.answers so they survive across sessions
        if (Object.keys(transcriptionMap).length > 0) {
          try {
            const { data: currentRow } = await supabase
              .from('worksheet_student_answers')
              .select('answers')
              .eq('worksheet_id', pending.worksheet_id)
              .eq('student_email', pending.student_email)
              .eq('exercise_index', pending.exercise_index)
              .maybeSingle();
            
            const existingAnswers = (currentRow?.answers && typeof currentRow.answers === 'object') ? currentRow.answers : {};
            const updatedAnswers: Record<string, any> = { ...(existingAnswers as Record<string, any>) };
            for (const [qIdx, trans] of Object.entries(transcriptionMap)) {
              updatedAnswers[`_transcription_${qIdx}`] = trans.text;
            }
            
            await supabase
              .from('worksheet_student_answers')
              .update({ answers: updatedAnswers })
              .eq('worksheet_id', pending.worksheet_id)
              .eq('student_email', pending.student_email)
              .eq('exercise_index', pending.exercise_index);
            
            console.log(`[process-pending] Persisted ${Object.keys(transcriptionMap).length} transcriptions to DB`);
          } catch (e) {
            console.error('[process-pending] Error persisting transcriptions:', e);
          }
        }

        // Build union of all question indexes from written + audio answers
        const allQuestionIndexes = new Set<number>();
        for (const qIdxStr of Object.keys(answers)) {
          allQuestionIndexes.add(parseInt(qIdxStr));
        }
        for (const qIdxStr of Object.keys(audioAnswers)) {
          allQuestionIndexes.add(parseInt(qIdxStr));
        }

        // Build answersToVerify from the union
        const answersToVerify: any[] = [];
        let audioQuestionsSentToAi = 0;

        // Closed items arrive with the answer key precomputed client-side
        // (src/lib/answers/closedItemContext.ts) in context.closed_items.
        const closedItems: any[] = Array.isArray(context.closed_items) ? context.closed_items : [];
        const isClosedPending = closedItems.length > 0;
        if (isClosedPending) {
          for (const ci of closedItems) {
            if (!ci || typeof ci.question_index !== 'number' || !ci.student_answer) continue;
            answersToVerify.push({
              exercise_index: pending.exercise_index,
              question_index: ci.question_index,
              question_text: String(ci.question_text || ''),
              student_answer: String(ci.student_answer),
              suggested_answer: String(ci.suggested_answer || ''),
              key_verdict: ['correct', 'wrong', 'review'].includes(ci.key_verdict) ? ci.key_verdict : undefined,
              exercise_type: pending.exercise_type,
            });
          }
        }

        for (const qIdx of (isClosedPending ? [] : allQuestionIndexes)) {
          const writtenAnswer = answers[String(qIdx)];
          const transcription = transcriptionMap[qIdx];
          const hasAudioForQuestion = audioAnswers[String(qIdx)] !== undefined;

          // Effective answer: written text, or transcription if audio-only
          const effectiveStudentAnswer = writtenAnswer 
            ? String(writtenAnswer) 
            : (transcription ? transcription.text : null);

          if (!effectiveStudentAnswer || effectiveStudentAnswer.trim() === '') continue;

          const octx = buildOpenAnswerContext({
            exercise: openExercise,
            questionIndex: qIdx,
            worksheetAudioTranscript,
          });
          const questionText = octx.question_text;
          const suggestedAnswer = octx.suggested_answer;

          const entry: any = {
            exercise_index: pending.exercise_index,
            question_index: qIdx,
            question_text: questionText,
            student_answer: writtenAnswer ? String(writtenAnswer) : '',
            suggested_answer: suggestedAnswer,
            exercise_type: pending.exercise_type,
          };

          // Add transcription data if available
          if (transcription) {
            entry.audio_transcription = transcription.text;
            entry.audio_word_count = transcription.wordCount;
            if (transcription.duration) entry.audio_duration_seconds = transcription.duration;
            audioQuestionsSentToAi++;
          }

          answersToVerify.push(entry);
        }

        console.log(`[process-pending] answersToVerify: ${answersToVerify.length} total, ${audioQuestionsSentToAi} with audio transcription`);

        // Guard: if audio answers exist but none were transcribed/sent, mark as failed
        const audioCount = Object.keys(audioAnswers).length;
        if (audioCount > 0 && audioQuestionsSentToAi === 0 && answersToVerify.length === 0) {
          throw new Error(`Audio evaluation failed: ${audioCount} audio answers found but none could be transcribed or evaluated`);
        }

        if (answersToVerify.length === 0) {
          console.log(`[process-pending] No valid answers for ${pending.id}`);
          await supabase
            .from('pending_worksheet_ai_evaluations')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', pending.id);
          skipped++;
          continue;
        }

        // Call verify-open-answers
        const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-open-answers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            answers: answersToVerify,
            english_level: await learnerLevel(supabase, pending.worksheet_id, pending.english_level),
            context: isClosedPending
              ? (context.title || `Exercise ${pending.exercise_index + 1}`)
              : openExerciseContextString(openExercise, `Exercise ${pending.exercise_index + 1}`, { worksheetAudioTranscript })
          })
        });

        if (!verifyResponse.ok) {
          throw new Error(`AI verification failed: ${await verifyResponse.text()}`);
        }

        const aiResult = await verifyResponse.json();
        console.log(`[process-pending] AI returned ${aiResult.evaluations?.length || 0} evaluations`);
        if (!Array.isArray(aiResult.evaluations) || aiResult.evaluations.length === 0) {
          // Nothing evaluated: keep the stored answer row untouched (an empty write
          // would wipe earlier evaluations) and leave this row failed for a retry.
          throw new Error('AI returned no evaluations');
        }
        if (!isClosedPending && Number(aiResult.unevaluated_count) > 0) {
          // Partial result for an open exercise: writing it would replace the whole
          // exercise's item evaluations with a subset. Keep the row and mark it failed.
          throw new Error(`AI left ${aiResult.unevaluated_count} item(s) unevaluated`);
        }
        
        // ========= BUILD CANONICAL ai_evaluation (same as homework) =========
        const hasAudioFor = (q: number) => !!transcriptionMap[q];
        const aiEvaluation = buildQuestionEvaluations({ evaluations: aiResult.evaluations || [], answers, hasAudio: hasAudioFor });

        // ========= BUILD item_evaluations for DSLM (derived from canonical) =========
        // Iterate ALL nano_skills per question (not just the first one)
        const itemEvaluations: any[] = buildOpenItemEvaluations({
          evaluations: aiResult.evaluations || [],
          questionItems,
          answers,
          hasAudio: hasAudioFor,
        });

        const validEvaluations = itemEvaluations.filter((e: any) => e.hasValue && e.mastery >= 0);
        const overallMastery = validEvaluations.length > 0
          ? Math.round(validEvaluations.reduce((sum: number, e: any) => sum + e.mastery, 0) / validEvaluations.length)
          : null;

        console.log(`[process-pending] Mastery: ${overallMastery}% for ${itemEvaluations.length} items (${audioQuestionsSentToAi} audio)`);

        // Update worksheet_student_answers with BOTH ai_evaluation and item_evaluations
        // Closed items: AI adds feedback only; DSLM mastery stays the deterministic
        // score already saved by the client (item_evaluations/mastery untouched).
        // Decision D1: the AI may only raise a typed closed answer that the key marks
        // wrong or uncertain; the key verdict of each item comes from closed_items.
        const closedRaised: Record<number, number> = {};
        if (isClosedPending) {
          const keyByQuestion = new Map<number, number | null>();
          for (const ci of closedItems) {
            if (typeof ci?.question_index !== 'number') continue;
            keyByQuestion.set(ci.question_index, ci.key_verdict === 'correct' ? 100 : ci.key_verdict === 'wrong' ? 0 : null);
          }
          for (const e of (aiResult.evaluations || [])) {
            if (typeof e?.question_index !== 'number' || !keyByQuestion.has(e.question_index)) continue;
            const up = aiAlternativeMastery(
              pending.exercise_type, keyByQuestion.get(e.question_index) ?? null, e, answers[String(e.question_index)],
            );
            if (up !== null) closedRaised[e.question_index] = up;
          }
        }
        // Raised item ratings and the exercise mastery recomputed over ALL items of
        // the exercise (as the client does), so a raise can only move it up.
        let raisedFields: Record<string, unknown> | null = null;
        if (isClosedPending && Object.keys(closedRaised).length > 0) {
          const exercise = await loadWorksheetExercise(supabase, pending.worksheet_id, pending.exercise_index);
          const exerciseMastery = exercise
            ? calculateExerciseMastery(pending.exercise_type, exercise, answers as Record<string, unknown>, closedRaised)
            : null;
          const raisedItems = storedItemEvaluations ? applyAiAlternatives(storedItemEvaluations, closedRaised) : null;
          raisedFields = {
            ...(raisedItems?.changed ? { item_evaluations: raisedItems.items } : {}),
            ...(exerciseMastery !== null ? { mastery: exerciseMastery } : {}),
          };
          if (Object.keys(raisedFields).length === 0) raisedFields = null;
        }

        // An open exercise with no nano skill still gets the model feedback in
        // ai_evaluation; there is nothing to rate, so item_evaluations and mastery stay.
        const updateData: Record<string, unknown> = (isClosedPending || itemEvaluations.length === 0)
          ? {
              ai_evaluation: aiEvaluation,
              last_ai_eval_at: answersReadAt,
            }
          : {
              ai_evaluation: aiEvaluation,
              item_evaluations: itemEvaluations,
              mastery: overallMastery,
              last_ai_eval_at: answersReadAt
            };
        
        if (effectiveTriggerSource) {
          updateData.eval_trigger = effectiveTriggerSource;
        }
        
        let wroteRaise = false;
        if (raisedFields) {
          // Only onto the row version the raise was computed from: a save made while
          // the model ran carries new key-based ratings that must not be overwritten.
          let guarded = supabase
            .from('worksheet_student_answers')
            .update({ ...updateData, ...raisedFields })
            .eq('worksheet_id', pending.worksheet_id)
            .eq('student_email', pending.student_email)
            .eq('exercise_index', pending.exercise_index);
          guarded = readLastSavedAt ? guarded.eq('last_saved_at', readLastSavedAt) : guarded.is('last_saved_at', null);
          const { data: guardedRows, error: guardedError } = await guarded.select('id');
          if (guardedError) throw guardedError;
          wroteRaise = Array.isArray(guardedRows) && guardedRows.length > 0;
          if (!wroteRaise) console.log(`[process-pending] ${pending.id}: answers changed during evaluation, raise not applied`);
        }
        if (!wroteRaise) {
          const { error: updateError } = await supabase
            .from('worksheet_student_answers')
            .update(updateData)
            .eq('worksheet_id', pending.worksheet_id)
            .eq('student_email', pending.student_email)
            .eq('exercise_index', pending.exercise_index);

          if (updateError) throw updateError;
        }

        // Mark as completed
        await supabase
          .from('pending_worksheet_ai_evaluations')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', pending.id);

        processed++;
        console.log(`[process-pending] Completed ${pending.id}, mastery=${overallMastery}%`);

      } catch (evalError: any) {
        console.error(`[process-pending] Error processing ${pending.id}:`, evalError);
        failed++;
        await supabase
          .from('pending_worksheet_ai_evaluations')
          .update({ 
            status: 'failed',
            error_message: evalError.message || 'Unknown error',
            processed_at: new Date().toISOString()
          })
          .eq('id', pending.id);
      }
    }
    };

    const runAll = async () => {
      await Promise.all(Array.from({ length: QUEUE_CONCURRENCY }, () => runWorker()));
      console.log(`[process-pending] Finished: ${processed} processed, ${skipped} skipped, ${failed} failed`);
    };

    // A student's tab only needs the work started (the page polls for results);
    // answering at once avoids the ~30 s client timeout on long worksheets.
    if (studentEmailFilter && typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(runAll());
      return new Response(
        JSON.stringify({ accepted: true }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await runAll();

    return new Response(
      JSON.stringify({ processed, skipped, failed, total: processed + skipped + failed, ...(homeworkResult ? { homework: homeworkResult } : {}) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[process-pending] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Auto-queue evaluations for all open-ended exercises
 * when teacher clicks Create Homework.
 */
async function autoQueueForCreateHomework(
  supabase: any,
  worksheetId: string,
  triggerSource: string = 'create_homework',
  exerciseIndexFilter: number | null = null,
  studentEmailFilter: string | null = null,
  outcome: { uncertain: number } = { uncertain: 0 },
): Promise<number> {
  console.log(`[auto-queue] Fetching answers for worksheet ${worksheetId}`);
  
  const { data: studentAnswers, error } = await supabase
    .from('worksheet_student_answers')
    .select('*')
    .eq('worksheet_id', worksheetId);
  
  if (error) {
    console.error('[auto-queue] Error fetching answers:', error);
    return -1; // could not read answers: do not mark anything
  }
  
  if (!studentAnswers || studentAnswers.length === 0) {
    console.log('[auto-queue] No student answers found');
    return 0;
  }
  
  let queued = 0;
  
  for (const answer of studentAnswers) {
    if (exerciseIndexFilter !== null && answer.exercise_index !== exerciseIndexFilter) continue;
    if (studentEmailFilter !== null && answer.student_email !== studentEmailFilter) continue;
    const isClosed = isClosedType(answer.exercise_type);
    if (!isClosed && !isOpenExerciseType(answer.exercise_type)) continue;
    
    const { data: needsEval, error: needsEvalError } = await supabase.rpc('needs_ai_evaluation', {
      p_worksheet_id: worksheetId,
      p_student_email: answer.student_email,
      p_exercise_index: answer.exercise_index
    });
    
    if (needsEvalError) {
      outcome.uncertain++;
      console.warn(`[auto-queue] needs_ai_evaluation failed for exercise ${answer.exercise_index}:`, needsEvalError.message);
      continue;
    }
    if (!needsEval) {
      console.log(`[auto-queue] Skipping exercise ${answer.exercise_index} - already evaluated`);
      continue;
    }
    
    await supabase
      .from('pending_worksheet_ai_evaluations')
      .delete()
      .eq('worksheet_id', worksheetId)
      .eq('student_email', answer.student_email)
      .eq('exercise_index', answer.exercise_index)
      .in('status', ['completed', 'failed']);
    
    const { data: existing } = await supabase
      .from('pending_worksheet_ai_evaluations')
      .select('id')
      .eq('worksheet_id', worksheetId)
      .eq('student_email', answer.student_email)
      .eq('exercise_index', answer.exercise_index)
      .in('status', ['pending', 'processing'])
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log(`[auto-queue] Exercise ${answer.exercise_index} already in queue`);
      continue;
    }
    
    let context: Record<string, unknown> = { trigger_source: triggerSource };
    try {
      const { data: worksheet, error: worksheetError } = await supabase
        .from('worksheets')
        .select('ai_response')
        .eq('id', worksheetId)
        .single();
      if (worksheetError) throw worksheetError;
      
      if (worksheet?.ai_response) {
        const parsed = typeof worksheet.ai_response === 'string' 
          ? JSON.parse(worksheet.ai_response) 
          : worksheet.ai_response;
        const exercises = parsed?.exercises || [];
        const exercise = exercises[answer.exercise_index];
        if (exercise) {
          context.title = exercise.title || `Exercise ${answer.exercise_index + 1}`;
          context.questions = exercise.questions || exercise.prompts || exercise.sentences || exercise.expressions || exercise.items || [];
          if (isClosed) {
            // Same extractor as the client (src/lib/answers/closedItemContext.ts re-exports it).
            const studentAnswers = answer.answers || {};
            const idx = new Set<number>();
            for (const k of Object.keys(studentAnswers)) {
              if (k.startsWith('_')) continue;
              const n = parseInt(k);
              if (!isNaN(n)) idx.add(n);
            }
            const closedItems: any[] = [];
            for (const q of [...idx].sort((a, b) => a - b)) {
              const ctx = buildClosedItemContext(answer.exercise_type, exercise, q, studentAnswers);
              if (ctx) closedItems.push({ question_index: q, ...ctx });
            }
            context.closed_items = closedItems;
          }
        }
      }
    } catch (e) {
      // Read or parse failure: the skip below is not a property of the answer.
      outcome.uncertain++;
      console.error(`[auto-queue] Error parsing worksheet context:`, e);
      if (isClosed) continue;
    }
    if (isClosed && !(Array.isArray(context.closed_items) && context.closed_items.length > 0)) {
      console.log(`[auto-queue] Skipping closed exercise ${answer.exercise_index} - no resolvable items`);
      continue;
    }
    
    const { error: insertError } = await supabase
      .from('pending_worksheet_ai_evaluations')
      .insert({
        worksheet_id: worksheetId,
        student_email: answer.student_email,
        exercise_index: answer.exercise_index,
        exercise_type: answer.exercise_type,
        answers: answer.answers,
        english_level: DEFAULT_ENGLISH_LEVEL, // resolved from the student/worksheet when processed
        context,
        status: 'pending'
      });
    
    if (insertError) {
      outcome.uncertain++;
      console.error(`[auto-queue] Error queuing exercise ${answer.exercise_index}:`, insertError);
    } else {
      queued++;
      console.log(`[auto-queue] Queued exercise ${answer.exercise_index} (${answer.exercise_type})`);
    }
  }
  
  console.log(`[auto-queue] Queued ${queued} evaluations for create_homework`);
  return queued;
}

/**
 * Atomically claim queue rows (claim_pending_ai_evaluations). Until that
 * migration is applied the RPC is missing and the previous select of 'pending'
 * rows is used; the caller still marks rows 'processing' itself.
 */
async function claimPendingEvaluations(
  supabase: any,
  limit: number,
  worksheetId: string | null,
  studentEmail: string | null,
  fallbackLimit: number,
): Promise<{ rows: any[]; atomic: boolean }> {
  const { data, error } = await supabase.rpc('claim_pending_ai_evaluations', {
    p_limit: limit,
    p_worksheet_id: worksheetId,
    p_student_email: studentEmail,
  });
  if (!error) return { rows: data || [], atomic: true };
  const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
  if (!missing) throw error;

  let query = supabase
    .from('pending_worksheet_ai_evaluations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(fallbackLimit);
  if (worksheetId) query = query.eq('worksheet_id', worksheetId);
  if (studentEmail) query = query.eq('student_email', studentEmail);
  const { data: rows, error: fetchError } = await query;
  if (fetchError) throw fetchError;
  return { rows: rows || [], atomic: false };
}

/**
 * Queue saved worksheet answers that still need AI evaluation (last save 10+
 * minutes ago, not evaluated since, within 7 days). Context is rebuilt from the
 * worksheet server-side, exactly like Create Homework.
 */
async function queueStaleWorksheetAnswers(supabase: any): Promise<void> {
  const { data: rows, error } = await supabase.rpc('list_worksheet_answers_needing_ai_evaluation', { p_limit: 20 });
  if (error) {
    console.warn('[process-pending] stale answer scan unavailable:', error.message);
    return;
  }
  for (const row of rows || []) {
    try {
      const outcome = { uncertain: 0 };
      const queued = await autoQueueForCreateHomework(
        supabase, row.worksheet_id, '10min_inactivity', row.exercise_index, row.student_email, outcome,
      );
      // Mark the save as handled only when nothing was queued for a certain
      // reason (unsupported type, no resolvable closed items, already queued or
      // evaluated). A transient read or insert failure leaves it for the next run.
      if (queued === 0 && outcome.uncertain === 0) {
        await markNotEvaluable(supabase, row);
      }
    } catch (e) {
      console.error('[process-pending] stale answer queue failed:', (e as Error).message);
    }
  }
}

/** Closed items (answer key context) for the given answers, built from the worksheet. */
async function buildClosedItemsFromWorksheet(
  supabase: any,
  worksheetId: string,
  exerciseIndex: number,
  exerciseType: string,
  answers: Record<string, unknown>,
): Promise<any[] | null> {
  try {
    const exercise = await loadWorksheetExercise(supabase, worksheetId, exerciseIndex);
    if (!exercise) return null;
    const idx = new Set<number>();
    for (const k of Object.keys(answers)) {
      if (k.startsWith('_')) continue;
      const n = parseInt(k);
      if (!isNaN(n)) idx.add(n);
    }
    const items: any[] = [];
    for (const q of [...idx].sort((a, b) => a - b)) {
      const ctx = buildClosedItemContext(exerciseType, exercise, q, answers as Record<string | number, any>);
      if (ctx) items.push({ question_index: q, ...ctx });
    }
    return items.length > 0 ? items : null;
  } catch (e) {
    console.error('[process-pending] closed item rebuild failed:', (e as Error).message);
    return null;
  }
}

/**
 * Level of the worksheet's student (CEFR), else the worksheet level, else the
 * level stored on the queue row. Old clients queued every row as 'Intermediate'.
 */
const learnerLevelCache = new Map<string, Promise<string>>();
function learnerLevel(supabase: any, worksheetId: string, queuedLevel: unknown): Promise<string> {
  const key = `${worksheetId}|${queuedLevel ?? ''}`;
  if (!learnerLevelCache.has(key)) {
    learnerLevelCache.set(key, (async () => {
      try {
        const { data: ws } = await supabase
          .from('worksheets')
          .select('student_id, form_data')
          .eq('id', worksheetId)
          .maybeSingle();
        let studentLevel: unknown = null;
        if (ws?.student_id) {
          const { data: st } = await supabase
            .from('students')
            .select('english_level')
            .eq('id', ws.student_id)
            .maybeSingle();
          studentLevel = st?.english_level;
        }
        return resolveEnglishLevel(studentLevel, ws?.form_data?.englishLevel, queuedLevel);
      } catch (e) {
        console.warn('[process-pending] level lookup failed:', (e as Error).message);
        return resolveEnglishLevel(queuedLevel);
      }
    })());
  }
  return learnerLevelCache.get(key)!;
}

/**
 * Record a save that cannot be evaluated so the stale scan does not offer it
 * again. The RPC never overwrites a pending or processing row, so a student
 * queueing the same exercise at the same moment wins; until that migration is
 * applied, an upsert guarded by a fresh active-row check is used.
 */
async function markNotEvaluable(
  supabase: any,
  row: { worksheet_id: string; student_email: string; exercise_index: number; exercise_type: string },
): Promise<void> {
  const { error } = await supabase.rpc('mark_worksheet_answer_not_evaluable', {
    p_worksheet_id: row.worksheet_id,
    p_student_email: row.student_email,
    p_exercise_index: row.exercise_index,
    p_exercise_type: row.exercise_type,
  });
  if (!error) return;
  const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
  if (!missing) throw error;
  const { data: active } = await supabase
    .from('pending_worksheet_ai_evaluations')
    .select('id')
    .eq('worksheet_id', row.worksheet_id)
    .eq('student_email', row.student_email)
    .eq('exercise_index', row.exercise_index)
    .in('status', ['pending', 'processing'])
    .limit(1);
  if (active && active.length > 0) return;
  await supabase
    .from('pending_worksheet_ai_evaluations')
    .upsert({
      worksheet_id: row.worksheet_id,
      student_email: row.student_email,
      exercise_index: row.exercise_index,
      exercise_type: row.exercise_type,
      answers: {},
      status: 'completed',
      error_message: 'not evaluable',
      created_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }, { onConflict: 'worksheet_id,student_email,exercise_index' });
}

/** Exercise plus the worksheet-level listening transcript (not stored on the exercise). */
async function loadWorksheetSource(
  supabase: any, worksheetId: string, exerciseIndex: number,
): Promise<{ exercise: any | null; audioTranscript: string | null }> {
  try {
    const { data: worksheet } = await supabase.from('worksheets').select('ai_response').eq('id', worksheetId).single();
    if (!worksheet?.ai_response) return { exercise: null, audioTranscript: null };
    const parsed = typeof worksheet.ai_response === 'string' ? JSON.parse(worksheet.ai_response) : worksheet.ai_response;
    const transcript = typeof parsed?.audio_transcript === 'string' && parsed.audio_transcript.trim() ? parsed.audio_transcript : null;
    return { exercise: (parsed?.exercises || [])[exerciseIndex] ?? null, audioTranscript: transcript };
  } catch (e) {
    console.error('[process-pending] worksheet source read failed:', (e as Error).message);
    return { exercise: null, audioTranscript: null };
  }
}

/** One exercise of a worksheet's generated content, or null when unavailable. */
async function loadWorksheetExercise(supabase: any, worksheetId: string, exerciseIndex: number): Promise<any | null> {
  try {
    const { data: worksheet } = await supabase
      .from('worksheets')
      .select('ai_response')
      .eq('id', worksheetId)
      .single();
    if (!worksheet?.ai_response) return null;
    const parsed = typeof worksheet.ai_response === 'string' ? JSON.parse(worksheet.ai_response) : worksheet.ai_response;
    return (parsed?.exercises || [])[exerciseIndex] ?? null;
  } catch (e) {
    console.error('[process-pending] worksheet exercise read failed:', (e as Error).message);
    return null;
  }
}
