import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Open-ended exercise types that need AI evaluation
const OPEN_ENDED_EXERCISE_TYPES = [
  'reading', 'dialogue', 'discussion', 'answer-questions',
  'answer-questions-audio', 'answer-questions-picture',
  'listening-comprehension', 'describe-picture',
  'paraphrasing', 'sentence-transformation'
];

serve(async (req) => {
  console.log('[process-pending-ai-evaluations] Function invoked');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let worksheetIdFilter: string | null = null;
    let triggerSource: string | null = null;
    try {
      const body = await req.json();
      worksheetIdFilter = body?.worksheet_id || null;
      triggerSource = body?.trigger_source || null;
    } catch {
      // No body provided - process all pending
    }
    
    console.log(`[process-pending] trigger_source: ${triggerSource}, worksheet_id: ${worksheetIdFilter}`);

    // === Auto-queue for create_homework ===
    if (triggerSource === 'create_homework' && worksheetIdFilter) {
      await autoQueueForCreateHomework(supabase, worksheetIdFilter);
    }

    // Get pending evaluations (limit to avoid timeout)
    let query = supabase
      .from('pending_worksheet_ai_evaluations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);
    
    if (worksheetIdFilter) {
      query = query.eq('worksheet_id', worksheetIdFilter);
    }

    const { data: pendingEvals, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!pendingEvals || pendingEvals.length === 0) {
      console.log('[process-pending] No pending evaluations found');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending evaluations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-pending] Found ${pendingEvals.length} pending evaluations`);

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const pending of pendingEvals) {
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

        const answers = pending.answers || {};
        const context = pending.context || {};
        const questionItems = context.questions || [];
        const effectiveTriggerSource = triggerSource || context.trigger_source || null;
        
        // Fetch audio answers from the source table
        let audioAnswers: Record<string, string> = {};
        try {
          const { data: answerRow } = await supabase
            .from('worksheet_student_answers')
            .select('audio_answers')
            .eq('worksheet_id', pending.worksheet_id)
            .eq('student_email', pending.student_email)
            .eq('exercise_index', pending.exercise_index)
            .maybeSingle();
          
          if (answerRow?.audio_answers && typeof answerRow.audio_answers === 'object') {
            audioAnswers = answerRow.audio_answers as Record<string, string>;
          }
        } catch (e) {
          console.error('[process-pending] Error fetching audio_answers:', e);
        }

        console.log(`[process-pending] Written answers: ${Object.keys(answers).length}, Audio answers: ${Object.keys(audioAnswers).length}`);

        // Transcribe audio answers
        const transcriptionMap: Record<number, { text: string; wordCount: number }> = {};
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
                  wordCount: words.length
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

        for (const qIdx of allQuestionIndexes) {
          const writtenAnswer = answers[String(qIdx)];
          const transcription = transcriptionMap[qIdx];
          const hasAudioForQuestion = audioAnswers[String(qIdx)] !== undefined;

          // Effective answer: written text, or transcription if audio-only
          const effectiveStudentAnswer = writtenAnswer 
            ? String(writtenAnswer) 
            : (transcription ? transcription.text : null);

          if (!effectiveStudentAnswer || effectiveStudentAnswer.trim() === '') continue;

          const questionItem = questionItems[qIdx] || {};
          const questionText = questionItem?.question || questionItem?.text || questionItem?.prompt || questionItem?.expression || `Question ${qIdx + 1}`;
          const suggestedAnswer = questionItem?.answer || questionItem?.suggested_answer || questionItem?.paraphrase || '';

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
            english_level: pending.english_level || 'Intermediate',
            context: context.title || `Exercise ${pending.exercise_index + 1}`
          })
        });

        if (!verifyResponse.ok) {
          throw new Error(`AI verification failed: ${await verifyResponse.text()}`);
        }

        const aiResult = await verifyResponse.json();
        console.log(`[process-pending] AI returned ${aiResult.evaluations?.length || 0} evaluations`);
        
        // ========= BUILD CANONICAL ai_evaluation (same as homework) =========
        const questionEvaluations = (aiResult.evaluations || []).map((e: any) => {
          const qIdx = e.question_index;
          const hasAudio = !!transcriptionMap[qIdx];
          const hasWritten = !!(answers[String(qIdx)] && String(answers[String(qIdx)]).trim());
          
          return {
            question_index: qIdx,
            is_acceptable: e.is_acceptable ?? ((e.quality_score || 0) >= 0.5),
            quality_score: e.quality_score ?? 0,
            feedback: e.feedback || '',
            // Only include writing_score if student provided written text
            writing_score: hasWritten ? e.writing_score : undefined,
            // Only include speaking_score if student provided audio
            speaking_score: hasAudio ? e.speaking_score : undefined,
          };
        });

        const aiEvaluation = { question_evaluations: questionEvaluations };

        // ========= BUILD item_evaluations for DSLM (derived from canonical) =========
        // Iterate ALL nano_skills per question (not just the first one)
        const itemEvaluations: any[] = [];
        for (const e of (aiResult.evaluations || [])) {
          const qIdx = e.question_index;
          const questionItem = questionItems[qIdx] || {};
          let nanoSkills = questionItem?.nano_skill;
          
          // Normalize to array
          if (!nanoSkills) nanoSkills = [];
          if (!Array.isArray(nanoSkills)) nanoSkills = [nanoSkills];
          
          const hasAudio = !!transcriptionMap[qIdx];
          const hasWritten = !!(answers[String(qIdx)] && String(answers[String(qIdx)]).trim());
          
          // Filter out empty nano_skills
          const validSkills = nanoSkills.filter((ns: any) => ns && ns.name);
          
          if (validSkills.length === 0) {
            // No nano_skills — skip (don't create junk question_* metrics)
            console.warn(`[process-pending] Question ${qIdx}: no nano_skills, skipping item_evaluation`);
            continue;
          }
          
          // Create evaluation for EACH nano_skill
          for (const ns of validSkills) {
            const nsName = (ns.name || '').toLowerCase();
            let mastery: number;
            
            // Map writing_score/speaking_score to matching nano_skills
            if ((nsName.includes('.writing.') || nsName.includes('.wr.')) && hasWritten && e.writing_score !== undefined) {
              mastery = Math.round(e.writing_score * 100);
            } else if ((nsName.includes('.speaking.') || nsName.includes('.sp.')) && hasAudio && e.speaking_score !== undefined) {
              mastery = Math.round(e.speaking_score * 100);
            } else if ((nsName.includes('.speaking.') || nsName.includes('.sp.')) && !hasAudio) {
              // No audio submitted — don't evaluate speaking skill
              mastery = -1;
            } else {
              mastery = Math.round((e.quality_score || 0.7) * 100);
            }
            
            // Adjust confidence based on answer type
            let confidence = ns.confidence || 0.90;
            if (nsName.includes('.speaking.') || nsName.includes('.sp.')) {
              confidence = hasAudio ? 0.90 : 0.30;
            } else if (nsName.includes('.writing.') || nsName.includes('.wr.')) {
              confidence = hasWritten ? 0.90 : 0.70;
            }
            
            itemEvaluations.push({
              question_index: qIdx,
              name: ns.name,
              reason: ns.reason || '',
              mastery,
              hasValue: mastery >= 0,
              confidence,
              feedback: e.feedback || '',
              response_type: hasAudio ? 'audio' : 'written',
              writing_score: hasWritten ? e.writing_score : undefined,
              speaking_score: hasAudio ? e.speaking_score : undefined,
            });
          }
        }

        const validEvaluations = itemEvaluations.filter((e: any) => e.hasValue && e.mastery >= 0);
        const overallMastery = validEvaluations.length > 0
          ? Math.round(validEvaluations.reduce((sum: number, e: any) => sum + e.mastery, 0) / validEvaluations.length)
          : null;

        console.log(`[process-pending] Mastery: ${overallMastery}% for ${itemEvaluations.length} items (${audioQuestionsSentToAi} audio)`);

        // Update worksheet_student_answers with BOTH ai_evaluation and item_evaluations
        const updateData: Record<string, unknown> = {
          ai_evaluation: aiEvaluation,
          item_evaluations: itemEvaluations,
          mastery: overallMastery,
          last_ai_eval_at: new Date().toISOString()
        };
        
        if (effectiveTriggerSource) {
          updateData.eval_trigger = effectiveTriggerSource;
        }
        
        const { error: updateError } = await supabase
          .from('worksheet_student_answers')
          .update(updateData)
          .eq('worksheet_id', pending.worksheet_id)
          .eq('student_email', pending.student_email)
          .eq('exercise_index', pending.exercise_index);

        if (updateError) throw updateError;

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

    console.log(`[process-pending] Finished: ${processed} processed, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed, skipped, failed, total: pendingEvals.length }),
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
async function autoQueueForCreateHomework(supabase: any, worksheetId: string) {
  console.log(`[auto-queue] Fetching answers for worksheet ${worksheetId}`);
  
  const { data: studentAnswers, error } = await supabase
    .from('worksheet_student_answers')
    .select('*')
    .eq('worksheet_id', worksheetId);
  
  if (error) {
    console.error('[auto-queue] Error fetching answers:', error);
    return;
  }
  
  if (!studentAnswers || studentAnswers.length === 0) {
    console.log('[auto-queue] No student answers found');
    return;
  }
  
  let queued = 0;
  
  for (const answer of studentAnswers) {
    if (!OPEN_ENDED_EXERCISE_TYPES.includes(answer.exercise_type)) continue;
    
    const { data: needsEval } = await supabase.rpc('needs_ai_evaluation', {
      p_worksheet_id: worksheetId,
      p_student_email: answer.student_email,
      p_exercise_index: answer.exercise_index
    });
    
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
    
    let context: Record<string, unknown> = { trigger_source: 'create_homework' };
    try {
      const { data: worksheet } = await supabase
        .from('worksheets')
        .select('ai_response')
        .eq('id', worksheetId)
        .single();
      
      if (worksheet?.ai_response) {
        const parsed = typeof worksheet.ai_response === 'string' 
          ? JSON.parse(worksheet.ai_response) 
          : worksheet.ai_response;
        const exercises = parsed?.exercises || [];
        const exercise = exercises[answer.exercise_index];
        if (exercise) {
          context.title = exercise.title || `Exercise ${answer.exercise_index + 1}`;
          context.questions = exercise.questions || exercise.prompts || exercise.sentences || exercise.expressions || exercise.items || [];
        }
      }
    } catch (e) {
      console.error(`[auto-queue] Error parsing worksheet context:`, e);
    }
    
    const { error: insertError } = await supabase
      .from('pending_worksheet_ai_evaluations')
      .insert({
        worksheet_id: worksheetId,
        student_email: answer.student_email,
        exercise_index: answer.exercise_index,
        exercise_type: answer.exercise_type,
        answers: answer.answers,
        english_level: 'Intermediate',
        context,
        status: 'pending'
      });
    
    if (insertError) {
      console.error(`[auto-queue] Error queuing exercise ${answer.exercise_index}:`, insertError);
    } else {
      queued++;
      console.log(`[auto-queue] Queued exercise ${answer.exercise_index} (${answer.exercise_type})`);
    }
  }
  
  console.log(`[auto-queue] Queued ${queued} evaluations for create_homework`);
}
