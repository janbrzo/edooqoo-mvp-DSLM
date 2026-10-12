import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/aiChat.ts";
import { NO_EM_DASH_RULE } from "../_shared/writingStyle.ts";
import { resolveCaller, authorizedTeacherId } from "../_shared/auth.ts";
import { answersFromQuestionRows, reconstructTraits } from "../_shared/welcomeTestTraits.ts";
import { computeLearningPathScore } from "../_shared/learningPathScore.ts";
import {
  answerBehaviour,
  computeDivergences,
  divergencePromptLines,
  type Divergence,
} from "../_shared/welcomeTestSignals.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const HAS_DIRECT_AI_PROVIDER = Boolean(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('OPENAI_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // v6.9.50: extracted, idempotent. Applies skill ratings to learning
  // elements and promotes status to 'reviewed'. Safe to call multiple times.
  // Returns final status string for the response payload.
  async function applyAndPromote(supabase: any, p_test_id: string, p_student_id: string): Promise<'reviewed' | 'completed'> {
    try {
      const { data: skillResults } = await supabase
        .from('test_skill_results')
        .select('id, element_type, applied_to_element_id, suggested_rating, applied_at')
        .eq('test_id', p_test_id);
      if (skillResults && skillResults.length > 0) {
        for (const r of skillResults as any[]) {
          if (r.applied_at) continue; // already applied
          if (r.suggested_rating == null) continue;
          let elementId: string | null = r.applied_to_element_id ?? null;
          if (!elementId && r.element_type) {
            const { data: existingEl } = await supabase
              .from('student_learning_elements')
              .select('id')
              .eq('student_id', p_student_id)
              .eq('element_type', r.element_type)
              .is('deleted_at', null)
              .maybeSingle();
            if (existingEl?.id) elementId = existingEl.id;
          }
          if (elementId) {
            await supabase
              .from('student_learning_elements')
              .update({ current_rating: r.suggested_rating, last_rated_at: new Date().toISOString() })
              .eq('id', elementId);
            await supabase
              .from('test_skill_results')
              .update({ applied_at: new Date().toISOString(), applied_to_element_id: elementId })
              .eq('id', r.id);
          } else {
            await supabase
              .from('test_skill_results')
              .update({ applied_at: new Date().toISOString() })
              .eq('id', r.id);
          }
        }
      }
      await supabase
        .from('student_tests')
        .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
        .eq('id', p_test_id)
        .neq('status', 'reviewed');
      return 'reviewed';
    } catch (err) {
      console.error('[process-welcome-test v6.9.50] applyAndPromote failed', err);
      return 'completed';
    }
  }

  try {
    const body = await req.json();
    const { test_id, student_id: bodyStudentId, teacher_id: bodyTeacherId, detected_traits, answered_count, force, integrity, share_token: bodyShareToken } = body || {};
    let answers = (body && body.answers) || null;
    let student_id = bodyStudentId;
    let teacher_id = bodyTeacherId;

    if (!test_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The test row decides whose profile is written: a body student_id or
    // teacher_id that does not match it is rejected, so a caller cannot write
    // another student's profile with a known test id.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: testOwnerRow } = await supabaseAdmin
      .from('student_tests')
      .select('student_id, teacher_id, share_token, attempt_number')
      .eq('id', test_id)
      .maybeSingle();
    if (!testOwnerRow) {
      return new Response(JSON.stringify({ error: 'Test not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if ((student_id && student_id !== (testOwnerRow as any).student_id)
        || (teacher_id && teacher_id !== (testOwnerRow as any).teacher_id)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    student_id = (testOwnerRow as any).student_id;
    teacher_id = (testOwnerRow as any).teacher_id;

    const caller = await resolveCaller(req);
    const isOwnerOrService = !!authorizedTeacherId(caller, teacher_id);

    // v6.9.48: "force" re-run (teacher "Apply to Progress") rewrites the profile
    // from stored answers, so only the owning teacher or the service role may ask.
    if (force && !isOwnerOrService) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Which attempt the stored profile currently describes.
    const { data: profileOwnerRow } = await supabaseAdmin
      .from('student_learning_profiles')
      .select('welcome_test_id')
      .eq('student_id', student_id)
      .eq('teacher_id', teacher_id)
      .maybeSingle();
    const profileTestId: string | null = (profileOwnerRow as any)?.welcome_test_id ?? null;

    // A student proves access with the test link token. A call without it (a
    // client released before the token was sent) is accepted only for the first
    // processing of this test, so a known test id cannot be replayed to rewrite
    // the profile, re-send emails and spend AI calls.
    if (!force && !isOwnerOrService) {
      const tokenOk = typeof bodyShareToken === 'string' && !!bodyShareToken
        && bodyShareToken === (testOwnerRow as any).share_token;
      if (!tokenOk && profileTestId === test_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Apply to Progress on an attempt that is not the one the profile describes
    // (e.g. attempt 1 stuck after attempt 2 was processed): apply its skill
    // results only, never rewrite the profile of the newer attempt with it.
    if (force && profileTestId && profileTestId !== test_id) {
      const { data: profileTest } = await supabaseAdmin
        .from('student_tests')
        .select('attempt_number')
        .eq('id', profileTestId)
        .maybeSingle();
      const profileAttempt = Number((profileTest as any)?.attempt_number ?? 0);
      const thisAttempt = Number((testOwnerRow as any).attempt_number ?? 0);
      if (profileAttempt > thisAttempt) {
        const status = await applyAndPromote(supabaseAdmin, test_id, student_id);
        return new Response(JSON.stringify({ success: true, status, profile_unchanged: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Force re-run without answers: rebuild them from student_test_questions,
    // keyed by the real question id of each question_index (wt_q3b, wt_q3c...).
    if (force && (!answers || Object.keys(answers).length === 0)) {
      const { data: persistedQs } = await supabaseAdmin
        .from('student_test_questions')
        .select('student_answer, question_index')
        .eq('test_id', test_id);
      const map = answersFromQuestionRows((persistedQs || []) as any[]);
      if (Object.keys(map).length > 0) answers = map;
    }

    if (!test_id || !student_id || !teacher_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all questions with answers
    const { data: questions } = await supabase
      .from('student_test_questions')
      .select('*')
      .eq('test_id', test_id)
      .order('question_index', { ascending: true });

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate scores by element_type
    const scoresByType: Record<string, { correct: number; total: number }> = {};
    for (const q of questions) {
      if (q.element_type && q.is_correct !== null) {
        if (!scoresByType[q.element_type]) scoresByType[q.element_type] = { correct: 0, total: 0 };
        scoresByType[q.element_type].total++;
        if (q.is_correct) scoresByType[q.element_type].correct++;
      }
    }

    const calcPercent = (type: string) => {
      const s = scoresByType[type];
      return s ? Math.round((s.correct / s.total) * 100) : null;
    };

    const grammarScore = calcPercent('grammar');
    const vocabularyScore = calcPercent('vocabulary');
    const readingScore = calcPercent('reading');
    const writingScore = calcPercent('writing');

    // Determine strongest/weakest
    const scores = [
      { skill: 'grammar', score: grammarScore },
      { skill: 'vocabulary', score: vocabularyScore },
      { skill: 'reading', score: readingScore },
      { skill: 'writing', score: writingScore },
    ].filter(s => s.score !== null);

    const strongest = scores.length > 0 ? scores.reduce((a, b) => (a.score! > b.score! ? a : b)).skill : null;
    const weakest = scores.length > 0 ? scores.reduce((a, b) => (a.score! < b.score! ? a : b)).skill : null;

    // v6.9.56: IDK signal aggregation. Promoted from "ignored sentinel" to
    // a pedagogical metacognition metric. We measure on skill questions
    // (grammar/vocabulary/reading/listening) where the student had a defined
    // correct_answer. self_awareness_score = % of "should have admitted not
    // knowing" cases (wrong-or-IDK on skill questions) where the student
    // actually chose IDK instead of guessing. NULL when there is no signal
    // (student answered every skill question correctly).
    let idkCountTotal = 0;
    let idkCountSkill = 0;
    let skillWrongOrIdk = 0;
    const SKILL_ELEMENT_TYPES = new Set(['grammar', 'vocabulary', 'reading', 'listening']);
    if (answers && typeof answers === 'object') {
      for (const v of Object.values(answers)) {
        if (v === '__IDK__') idkCountTotal++;
      }
    }
    for (const q of questions as any[]) {
      if (!SKILL_ELEMENT_TYPES.has(q.element_type)) continue;
      const sa = q.student_answer;
      if (sa === '__IDK__') { idkCountSkill++; skillWrongOrIdk++; }
      else if (q.is_correct === false) { skillWrongOrIdk++; }
    }
    const selfAwarenessScore = skillWrongOrIdk > 0
      ? Math.round((idkCountSkill / skillWrongOrIdk) * 100)
      : null;

    // Estimate level from grammar + vocabulary scores
    const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score!, 0) / scores.length : 0;
    let estimatedLevel = 'A2';
    if (avgScore >= 90) estimatedLevel = 'C1';
    else if (avgScore >= 75) estimatedLevel = 'B2';
    else if (avgScore >= 55) estimatedLevel = 'B1';
    else if (avgScore >= 35) estimatedLevel = 'A2';
    else estimatedLevel = 'A1';

    // Traits from the answers (option string -> value), then the client's
    // detected_traits for anything the answers do not resolve.
    const traits: Record<string, string> = reconstructTraits(answers, detected_traits);

    const selfAssessedLevel = traits.self_assessed_level || null;

    // Level confidence
    const levelMap: Record<string, number> = { 'A1': 1, 'A1-A2': 1.5, 'A2': 2, 'A2-B1': 2.5, 'B1': 3, 'B1-B2': 3.5, 'B2': 4, 'B2-C1': 4.5, 'C1': 5, 'C1-C2': 5.5 };
    const estNum = levelMap[estimatedLevel] || 3;
    const selfNum = (selfAssessedLevel ? levelMap[selfAssessedLevel] : undefined) || estNum;
    const levelConfidence = Math.abs(estNum - selfNum) <= 0.5 ? 'accurate' : selfNum > estNum ? 'overestimates' : 'underestimates';

    // Extract preferred activities from answers (Q6)
    const preferredActivities = Array.isArray(answers?.wt_q6) ? answers.wt_q6 : [];
    const interestTopics = Array.isArray(answers?.wt_q43) ? answers.wt_q43 : [];

    // Extract confidence matrix (Q44)
    const matrix = answers?.wt_q44 || {};

    // PROBLEM 3 (v6.2): Snapshot previous profile BEFORE upsert so we can
    // generate an evolution_summary comparing this attempt to the prior one.
    // The upsert below will overwrite the row, so we must capture it first.
    const { data: previousProfile } = await supabase
      .from('student_learning_profiles')
      .select('*')
      .eq('student_id', student_id)
      .eq('teacher_id', teacher_id)
      .maybeSingle();

    // v6.9.48: fetch current student level early so we can attach a
    // level_change_suggestion to raw_answers when it differs from estimate.
    const { data: studentLevelRow } = await supabase
      .from('students')
      .select('english_level')
      .eq('id', student_id)
      .maybeSingle();
    const currentStudentLevel = ((studentLevelRow as any)?.english_level || '').toString().trim();
    const hasMeaningfulCurrent = currentStudentLevel && currentStudentLevel.toLowerCase() !== 'unknown';
    const levelChangeSuggestion = hasMeaningfulCurrent && currentStudentLevel !== estimatedLevel
      ? { current: currentStudentLevel, estimated: estimatedLevel, created_at: new Date().toISOString() }
      : null;

    const enrichedAnswers: Record<string, unknown> = { ...(answers || {}) };
    delete enrichedAnswers.learning_path; // recomputed below
    if (levelChangeSuggestion) {
      enrichedAnswers.level_change_suggestion = levelChangeSuggestion;
    }
    // v6.9.56: integrity snapshot (tab-blur count + recent events) captured
    // client-side. Surfaces as a teacher-only signal of potential outside
    // help (translator/AI) during the placement test.
    if (integrity && typeof integrity === 'object') {
      enrichedAnswers.__integrity__ = integrity;
    }

    // Signals computed in code before any AI step (they must not depend on it).
    const behaviour = answerBehaviour(questions as any[]);
    const learningPath = computeLearningPathScore(traits, answers);
    enrichedAnswers.learning_path = learningPath; // older readers look in raw_answers
    let divergences: Divergence[] = computeDivergences({
      traits,
      estimatedLevel,
      selfAssessedLevel,
      confidenceMatrix: matrix,
      readingScore,
      writingScore,
      speakingScore: null,
      selfAwarenessScore,
      skillWrongOrIdk,
      behaviour,
    });

    // Shown until the AI analysis replaces it (and kept, flagged, when the AI step
    // is unavailable), so a retake never shows the previous attempt's analysis.
    const deterministicSummary = () => JSON.stringify({
      summary: `Deterministic profile: estimated CEFR ${estimatedLevel} (self-assessed ${selfAssessedLevel || 'unknown'}, ${levelConfidence}). Strongest skill ${strongest || 'n/a'}, weakest ${weakest || 'n/a'}. Motivation ${traits.motivation_type || 'unknown'}, anxiety ${traits.anxiety_level || 'unknown'}, feedback preference ${traits.feedback_preference || 'unknown'}.`,
      recommendations: [
        weakest ? `Prioritise targeted practice on ${weakest} to lift overall CEFR confidence.` : 'Confirm weakest skill in the next lesson before locking the curriculum.',
        'Anchor lessons in the surfaced interest topics to sustain motivation week over week.',
        traits.feedback_preference ? `Match correction style to the student\u2019s preferred feedback mode: ${traits.feedback_preference}.` : 'Calibrate feedback style during the first live session.',
      ],
      writing_quality: 'unknown',
      key_observations: [
        `Estimated level ${estimatedLevel}; self-assessed ${selfAssessedLevel || 'unknown'} (${levelConfidence}).`,
        `Weekly study time: ${traits.weekly_study_time || 'unknown'}; learning timeline: ${traits.learning_timeline || 'unknown'}.`,
      ],
      fallback: true,
    });

    // Upsert learning profile
    const profileData: Record<string, unknown> = {
      student_id,
      teacher_id,
      welcome_test_id: test_id,
      estimated_level: estimatedLevel,
      self_assessed_level: selfAssessedLevel,
      level_confidence: levelConfidence,
      motivation_type: traits.motivation_type || null,
      anxiety_level: traits.anxiety_level || null,
      ambiguity_tolerance: traits.ambiguity_tolerance || null,
      error_attitude: traits.error_attitude || null,
      preferred_activities: preferredActivities,
      preferred_input_channel: traits.preferred_input_channel || null,
      feedback_preference: traits.feedback_preference || null,
      interest_topics: interestTopics,
      weekly_study_time: traits.weekly_study_time || null,
      grammar_score: grammarScore,
      vocabulary_score: vocabularyScore,
      reading_score: readingScore,
      writing_score: writingScore,
      communication_score: null,
      strongest_skill: strongest,
      weakest_skill: weakest,
      confidence_speaking: matrix['Speaking with strangers'] || null,
      confidence_writing: matrix['Writing formal emails'] || null,
      confidence_listening: matrix['Understanding movies without subtitles'] || null,
      confidence_reading: matrix['Reading news articles'] || null,
      confidence_presenting: matrix['Giving presentations'] || null,
      confidence_small_talk: matrix['Small talk at parties'] || null,
      raw_answers: enrichedAnswers,
      idk_count_total: idkCountTotal,
      idk_count_skill: idkCountSkill,
      self_awareness_score: selfAwarenessScore,
      // Results of the previous attempt must not survive into this one.
      ai_summary: deterministicSummary(),
      speaking_score: null,
      evolution_summary: null,
      updated_at: new Date().toISOString(),
    };

    // A teacher's force re-run rebuilds from stored rows, which can lack what
    // only the original submission carried (client traits, integrity): never
    // replace a known value with nothing.
    const rerunOfSameAttempt = (previousProfile as any)?.welcome_test_id === test_id;
    if (force && previousProfile && rerunOfSameAttempt) {
      const prev = previousProfile as Record<string, unknown>;
      for (const key of [
        'self_assessed_level', 'motivation_type', 'anxiety_level', 'ambiguity_tolerance', 'error_attitude',
        'preferred_input_channel', 'feedback_preference', 'weekly_study_time',
        'confidence_speaking', 'confidence_writing', 'confidence_listening', 'confidence_reading',
        'confidence_presenting', 'confidence_small_talk',
      ]) {
        if ((profileData[key] === null || profileData[key] === undefined) && prev[key] !== null && prev[key] !== undefined) {
          profileData[key] = prev[key];
        }
      }
      for (const key of ['preferred_activities', 'interest_topics']) {
        const v = profileData[key];
        if (Array.isArray(v) && v.length === 0 && Array.isArray(prev[key]) && (prev[key] as unknown[]).length > 0) {
          profileData[key] = prev[key];
        }
      }
      if (prev.raw_answers && typeof prev.raw_answers === 'object') {
        profileData.raw_answers = { ...(prev.raw_answers as Record<string, unknown>), ...enrichedAnswers };
      }
      if (prev.speaking_score !== null && prev.speaking_score !== undefined) profileData.speaking_score = prev.speaking_score;
    }
    // A re-run of the same attempt (teacher force or a client retry) keeps its
    // analyses until this run replaces them; the evolution report is not regenerated.
    if (rerunOfSameAttempt && previousProfile) {
      const prev = previousProfile as Record<string, unknown>;
      if (prev.ai_summary) profileData.ai_summary = prev.ai_summary;
      if (prev.evolution_summary) profileData.evolution_summary = prev.evolution_summary;
    }

    const v2Columns = {
      traits: { version: 1, ...traits },
      learning_path: learningPath,
      divergences,
      answer_behaviour: behaviour,
      signal_coverage: learningPath.coverage,
    };
    let { error: upsertError } = await supabase
      .from('student_learning_profiles')
      .upsert({ ...profileData, ...v2Columns }, { onConflict: 'student_id,teacher_id' });
    let hasV2Columns = true;
    if (upsertError && isMissingColumnError(upsertError)) {
      // Migration 20261012180000 not applied yet: same profile without the new columns.
      hasV2Columns = false;
      ({ error: upsertError } = await supabase
        .from('student_learning_profiles')
        .upsert(profileData, { onConflict: 'student_id,teacher_id' }));
    }

    if (upsertError) {
      console.error('Error upserting learning profile:', upsertError);
      throw upsertError;
    }

    // Keep the profile this run replaced (written after a successful upsert, so a
    // failed run that is retried does not store duplicates).
    if (previousProfile) {
      const { error: versionError } = await supabase
        .from('student_learning_profile_versions')
        .insert({
          student_id,
          teacher_id,
          welcome_test_id: (previousProfile as any).welcome_test_id ?? null,
          snapshot: previousProfile,
        });
      if (versionError) console.warn('[process-welcome-test] profile version not saved:', versionError.message);
    }


    // Update student_tests with answered_count
    if (answered_count !== undefined) {
      await supabase
        .from('student_tests')
        .update({ answered_count })
        .eq('id', test_id);
    }

    // WT-4 (v6.9.27): explicitly mark the test completed so the UI never gets
    // stuck on 'assigned'/'in_progress' if calculate_test_results silently
    // fails. Skip 'reviewed' rows (teacher already actioned them).
    try {
      await supabase
        .from('student_tests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', test_id)
        .neq('status', 'reviewed');
    } catch (statusErr) {
      console.error('[process-welcome-test] WT-4 status update failed', statusErr);
    }

    // v6.9.50: initial auto-apply pass (idempotent, helper handles errors).
    // A second pass runs at the very end of the function so that any later
    // calls to `calculate_test_results` (AI rescoring path) cannot leave us
    // with applied_at=NULL on the regenerated skill rows.
    await applyAndPromote(supabase, test_id, student_id);

    // v6.9.39 P5: Auto-fill student level + suggest goals from Welcome Test.
    // v6.9.40 P4: Also auto-fill students.main_goal when missing/unknown,
    // and ALWAYS insert 2-3 goal suggestions tied to this specific test_id
    // (skip when suggestions for the same test already exist).
    try {
      const { data: studentRowForAutoFill } = await supabase
        .from('students')
        .select('english_level, main_goal')
        .eq('id', student_id)
        .maybeSingle();
      const currentLevel = (studentRowForAutoFill as any)?.english_level;
      const isMissingLevel =
        !currentLevel || String(currentLevel).trim() === '' || String(currentLevel).trim().toLowerCase() === 'unknown';
      if (isMissingLevel) {
        await supabase
          .from('students')
          .update({ english_level: estimatedLevel })
          .eq('id', student_id);
      }

      // v6.9.40: derive a suggested main_goal from motivation/interests and
      // auto-apply when students.main_goal is missing. Custom-only/empty are
      // treated as missing; otherwise we keep teacher's choice.
      const VALID_MAIN_GOALS = new Set([
        'work','exam','general','travel','academic',
        'social-conversation','personal-development','fun-entertainment',
      ]);
      const motivation = String(traits.motivation_type || '').toLowerCase();
      const career = String(traits.career_english_importance || '').toLowerCase();
      const timeline = String(traits.learning_timeline || '').toLowerCase();
      const interestsLower = (interestTopics || []).map((t: any) => String(t).toLowerCase());
      let suggestedMainGoal = 'general';
      if (timeline === 'urgent_specific' && /exam|ielts|cambridge|toefl/i.test(JSON.stringify(answers || {}))) {
        suggestedMainGoal = 'exam';
      } else if (career === 'critical' || career === 'high' || motivation === 'instrumental') {
        suggestedMainGoal = 'work';
      } else if (interestsLower.some((t: string) => /travel/.test(t))) {
        suggestedMainGoal = 'travel';
      } else if (interestsLower.some((t: string) => /academ|study|university/.test(t))) {
        suggestedMainGoal = 'academic';
      } else if (motivation === 'integrative') {
        suggestedMainGoal = 'social-conversation';
      }
      if (!VALID_MAIN_GOALS.has(suggestedMainGoal)) suggestedMainGoal = 'general';
      const currentMainGoal = (studentRowForAutoFill as any)?.main_goal;
      const isMissingMainGoal =
        !currentMainGoal ||
        String(currentMainGoal).trim() === '' ||
        String(currentMainGoal).trim().toLowerCase() === 'custom';
      if (isMissingMainGoal) {
        await supabase
          .from('students')
          .update({ main_goal: suggestedMainGoal })
          .eq('id', student_id);
      }

      // Skip insert if we already created suggestions for this exact test_id
      // (prevents duplicates when process-welcome-test reruns).
      const { count: existingForThisTest } = await supabase
        .from('student_progress_goals')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student_id)
        .eq('source', 'welcome_test_auto')
        .contains('metadata', { test_id });

      // v6.9.48: `force` lets the teacher repair stuck tests; suggestions are
      // not regenerated to avoid duplicates, only auto-apply + status promotion.
      if ((existingForThisTest ?? 0) === 0) {
        // Build 2-3 suggested goals from the just-computed profile signals.
        const suggestions: Array<{ goal_type: string; title: string; description: string; meta: Record<string, unknown> }> = [];
        const skillLabel = (s: string | null) => {
          if (!s) return 'core skill';
          const map: Record<string, string> = {
            grammar: 'grammar accuracy', vocabulary: 'vocabulary range',
            reading: 'reading comprehension', writing: 'writing fluency',
            speaking: 'speaking fluency', listening: 'listening comprehension',
          };
          return map[s] || s;
        };
        if (weakest) {
          suggestions.push({
            goal_type: 'supporting',
            title: `Improve ${skillLabel(weakest)}`,
            description: `Welcome Test marked ${skillLabel(weakest)} as the weakest skill. Focused practice should lift overall CEFR confidence.`,
            meta: { from: 'welcome_test', test_id, signal: 'weakest_skill', value: weakest, estimated_level: estimatedLevel, suggested_main_goal: suggestedMainGoal },
          });
        }
        if (strongest && strongest !== weakest) {
          suggestions.push({
            goal_type: 'supporting',
            title: `Build confidence from ${skillLabel(strongest)}`,
            description: `Welcome Test marked ${skillLabel(strongest)} as the strongest skill. Use it as a confidence anchor while building weaker areas.`,
            meta: { from: 'welcome_test', test_id, signal: 'strongest_skill', value: strongest, estimated_level: estimatedLevel, suggested_main_goal: suggestedMainGoal },
          });
        }
        if (Array.isArray(interestTopics) && interestTopics.length > 0) {
          const topic = String(interestTopics[0]);
          suggestions.push({
            goal_type: 'additional',
            title: `Practice English around ${topic}`,
            description: `Welcome Test surfaced "${topic}" as an interest area. Anchoring lessons here boosts motivation.`,
            meta: { from: 'welcome_test', test_id, signal: 'interest_topic', value: topic, estimated_level: estimatedLevel, suggested_main_goal: suggestedMainGoal },
          });
        }

        if (suggestions.length > 0) {
          const rows = suggestions.map((s, i) => ({
            student_id,
            teacher_id,
            goal_type: s.goal_type,
            title: s.title,
            description: s.description,
            display_order: i,
            source: 'welcome_test_auto',
            metadata: s.meta,
          }));
          await supabase.from('student_progress_goals').insert(rows);
        }
      }
    } catch (autoLevelErr) {
      console.error('[process-welcome-test] level/goal auto-suggest failed', autoLevelErr);
    }

    // v6.9.29: Fire-and-forget thank-you email to the student. Idempotent server-side.
    try {
      const { data: studentRow } = await supabase
        .from('students')
        .select('name, student_email')
        .eq('id', student_id)
        .maybeSingle();
      const { data: teacherRow } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', teacher_id)
        .maybeSingle();
      const studentEmail = studentRow?.student_email;
      if (studentEmail) {
        const teacherName = [teacherRow?.first_name, teacherRow?.last_name].filter(Boolean).join(' ').trim() || 'your teacher';
        fetch(`${supabaseUrl}/functions/v1/send-welcome-test-completion-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            testId: test_id,
            studentEmail,
            studentName: studentRow?.name || 'there',
            teacherName,
            teacherEmail: teacherRow?.email || null,
          }),
        }).catch((e: any) => console.warn('[process-welcome-test] thank-you email dispatch failed', e));
      }
    } catch (mailErr) {
      console.warn('[process-welcome-test] thank-you email pre-dispatch failed', mailErr);
    }

    // Note: welcome_test_completed event removed - only test_answer_submitted events are logged per-question

    // --- Point 6: Create notification for teacher ---
    try {
      // Get student name
      const { data: studentData } = await supabase
        .from('students')
        .select('name')
        .eq('id', student_id)
        .single();

      const studentName = studentData?.name || 'Student';

      await supabase.from('homework_notifications').insert({
        homework_id: null,
        student_id,
        teacher_id,
        notification_type: 'welcome_test_completed',
        message: `${studentName} completed the Welcome Test (Level: ${estimatedLevel})`,
        is_read: false,
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Non-critical, don't fail
    }

    // --- Point 8: Email teacher on completion ---
    if (RESEND_API_KEY) {
      try {
        const { data: teacherData } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('id', teacher_id)
          .single();

        const { data: studentData } = await supabase
          .from('students')
          .select('name')
          .eq('id', student_id)
          .single();

        if (teacherData?.email) {
          const studentName = studentData?.name || 'Student';
          const teacherFirstName = teacherData.first_name || 'Teacher';

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #7c3aed;">✅ Welcome Test Completed!</h2>
              <p>Hi ${teacherFirstName},</p>
              <p><strong>${studentName}</strong> has completed the Welcome Test. Here's a quick summary:</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                  <div style="text-align: center; flex: 1; min-width: 100px;">
                    <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${estimatedLevel}</div>
                    <div style="font-size: 12px; color: #6b7280;">Estimated Level</div>
                  </div>
                  ${grammarScore !== null ? `<div style="text-align: center; flex: 1; min-width: 100px;">
                    <div style="font-size: 24px; font-weight: bold;">${grammarScore}%</div>
                    <div style="font-size: 12px; color: #6b7280;">Grammar</div>
                  </div>` : ''}
                  ${vocabularyScore !== null ? `<div style="text-align: center; flex: 1; min-width: 100px;">
                    <div style="font-size: 24px; font-weight: bold;">${vocabularyScore}%</div>
                    <div style="font-size: 12px; color: #6b7280;">Vocabulary</div>
                  </div>` : ''}
                </div>
                ${strongest ? `<p style="margin-top: 12px; font-size: 14px; color: #374151;">
                  <strong>Strongest:</strong> ${strongest} | <strong>Weakest:</strong> ${weakest || '-'}
                </p>` : ''}
                ${selfAssessedLevel ? `<p style="font-size: 14px; color: #374151;">
                  <strong>Self-assessed:</strong> ${selfAssessedLevel} (${levelConfidence})
                </p>` : ''}
              </div>
              <p>View the full learning profile in the student's profile page:</p>
              <a href="${Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'}/student/${student_id}?tab=tests" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin: 10px 0; font-weight: bold;">View Results →</a>
              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                edooqoo
              </p>
            </div>
          `;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'edooqoo <noreply@edooqoo.com>',
              to: [teacherData.email],
              subject: `${studentName} completed the Welcome Test (${estimatedLevel})`,
              html: emailHtml,
            }),
          });

          console.log('[process-welcome-test] Teacher notification email sent to:', teacherData.email);
        }
      } catch (emailError) {
        console.error('Error sending teacher email:', emailError);
        // Non-critical
      }
    }

    // --- Point 15: AI Analysis of open answers (including speaking transcriptions) ---
    let aiSummary: string | null = null;
    let aiWritingScore: number | null = null;
    let aiSpeakingScore: number | null = null;
    if (HAS_DIRECT_AI_PROVIDER) {
      try {
        const openQuestionIds = ['wt_q12', 'wt_q13', 'wt_q16', 'wt_q17', 'wt_q36', 'wt_q37', 'wt_q40', 'wt_q41', 'wt_q45'];
        const speakingQuestionIds = ['wt_q16s', 'wt_q36s', 'wt_q41s'];
        
        // Transcribe speaking answers before AI analysis
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        const transcriptions: Record<string, string> = {};
        
        // Build question index map: answer_id -> question_index
        const questionIndexMap: Record<string, number> = {};
        for (let i = 0; i < questions.length; i++) {
          // Map question_index to the question's ID from the welcomeTestQuestions
          // speakingQuestionIds are like wt_q16s, wt_q36s, wt_q41s
          // openQuestionIds are like wt_q12, wt_q16, wt_q17, etc.
          // We need to find which question_index corresponds to which answer_id
          // The answer_id is stored in event_payload, but here we work with questions array
          // Question index i maps to ALL_WELCOME_TEST_QUESTIONS[i].id
        }
        // Build map from answers keys that match question indices
        const allAnswerKeys = Object.keys(answers || {});
        
        if (OPENAI_API_KEY) {
          for (const sqId of speakingQuestionIds) {
            const audioUrl = answers?.[sqId];
            if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http') && (audioUrl.includes('r2.dev') || audioUrl.startsWith('https://pub-'))) {
              try {
                console.log(`[process-welcome-test] Transcribing speaking answer: ${sqId}`);
                const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ audio_url: audioUrl }),
                });
                
                if (transcribeResponse.ok) {
                  const transcribeData = await transcribeResponse.json();
                  if (transcribeData.transcription) {
                    transcriptions[sqId] = transcribeData.transcription;
                    console.log(`[process-welcome-test] Transcribed ${sqId}: ${transcribeData.transcription.substring(0, 50)}...`);
                    
                    // PROBLEM 1: Save transcription to question_data for teacher auto-view
                    // Find the question index for this speaking question
                    const speakingQ = questions.find((q: any) => {
                      const sa = String(q.student_answer || '');
                      return sa === audioUrl;
                    });
                    if (speakingQ) {
                      const existingData = (speakingQ.question_data || {}) as Record<string, unknown>;
                      await supabase
                        .from('student_test_questions')
                        .update({
                          question_data: { ...existingData, transcription: transcribeData.transcription },
                        })
                        .eq('id', speakingQ.id);
                      console.log(`[process-welcome-test] Saved transcription to question_data for ${sqId}`);
                    }
                  }
                }
              } catch (transcribeErr) {
                console.error(`[process-welcome-test] Failed to transcribe ${sqId}:`, transcribeErr);
              }
            }
          }
        }
        
        // Build open answers including transcriptions and time info for AI context
        const allAnswerIds = [...openQuestionIds, ...speakingQuestionIds];
        const openAnswers = allAnswerIds
          .filter(id => {
            if (transcriptions[id]) return true; // has transcription
            return answers?.[id] && answers[id] !== '__IDK__' && !String(answers[id]).startsWith('http');
          })
          .map(id => {
            // Find matching question to get time_spent_seconds
            const matchQ = questions.find((q: any) => {
              const sa = String(q.student_answer || '');
              return sa === String(answers?.[id]);
            });
            const timeSec = matchQ?.time_spent_seconds || null;
            const timeInfo = timeSec ? ` [recording/answering time: ${timeSec}s]` : '';
            
            if (transcriptions[id]) {
              const wordCount = transcriptions[id].split(/\s+/).filter(Boolean).length;
              return `${id} (speaking - transcribed, ${wordCount} words${timeInfo}): "${transcriptions[id]}"`;
            }
            return `${id}${timeInfo}: "${answers[id]}"`;
          })
          .join('\n');

        // v6.9.47: when no open/speaking answers exist, generate AI Analysis
        // from the deterministic profile + scenario answers so the teacher
        // never sees an empty "AI Analysis" section after completion/review.
        const integrityBlur = (enrichedAnswers as any).__integrity__?.blur_count;
        const integrityLine = typeof integrityBlur === 'number' && integrityBlur > 0
          ? `- Integrity signal: tab-blur count = ${integrityBlur}. >3 suggests the student likely consulted an external translator/AI during open-ended items; downweight those answers and verify level in the first live session.`
          : `- Integrity signal: no tab-blur events detected.`;
        const idkSummaryLine = selfAwarenessScore === null
          ? `- IDK signal: no metacognition signal (no incorrect/IDK on skill items).`
          : `- IDK signal: self-awareness ${selfAwarenessScore}% (admitted "I don't know" on ${idkCountSkill}/${skillWrongOrIdk} skill items where they were uncertain; ${idkCountTotal} IDK overall). High = honest metacognition, prefer scaffolding before harder content. Low = compulsive guessing, recalibrate confidence and add formative checks.`;
        const profileAnswerSummary = `Profile snapshot (deterministic):\n- Estimated level: ${estimatedLevel}\n- Self-assessed level: ${selfAssessedLevel || 'unknown'} (${levelConfidence})\n- Skill scores: grammar=${grammarScore ?? '-'}%, vocabulary=${vocabularyScore ?? '-'}%, reading=${readingScore ?? '-'}%, writing=${writingScore ?? '-'}%\n- Strongest skill: ${strongest || 'n/a'}; weakest: ${weakest || 'n/a'}\n${idkSummaryLine}\n${integrityLine}\n- Motivation type: ${traits.motivation_type || 'unknown'}; latent goal: ${traits.latent_goal || 'unknown'}\n- Anxiety: ${traits.anxiety_level || 'unknown'}; ambiguity tolerance: ${traits.ambiguity_tolerance || 'unknown'}; error attitude: ${traits.error_attitude || 'unknown'}\n- Feedback preference: ${traits.feedback_preference || 'unknown'}; correction preference: ${traits.correction_preference || 'unknown'}\n- Weekly study time: ${traits.weekly_study_time || 'unknown'}; homework commitment: ${traits.homework_commitment || 'unknown'}\n- Deadline response: ${traits.deadline_response || 'unknown'}; learning timeline: ${traits.learning_timeline || 'unknown'}; persistence: ${traits.persistence_level || 'unknown'}; plateau response: ${traits.plateau_response || 'unknown'}\n- Career importance: ${traits.career_english_importance || 'unknown'}; usage context: ${traits.usage_context || 'unknown'}\n- Interest topics: ${(interestTopics || []).join(', ') || 'none'}; preferred activities: ${(preferredActivities || []).join(', ') || 'none'}\n- Confidence matrix (1-5): speaking=${matrix['Speaking with strangers'] ?? '-'}, writing=${matrix['Writing formal emails'] ?? '-'}, listening=${matrix['Understanding movies without subtitles'] ?? '-'}, reading=${matrix['Reading news articles'] ?? '-'}, presenting=${matrix['Giving presentations'] ?? '-'}, small_talk=${matrix['Small talk at parties'] ?? '-'}`;
        // The scenario traits and the declared-vs-measured pairs are sent on every
        // run (before, only when there were no open answers, so the model could not
        // triangulate in the normal case). The pairs are computed in code; the
        // model only explains them.
        const divergenceBlock = `Declared vs measured (computed deterministically; explain these, do not invent others):\n${divergencePromptLines(divergences)}`;
        const answeredLine = `- Questions answered: ${questions.filter((q: any) => q.student_answer !== null).length}/${questions.length}`;
        const userPromptBody = openAnswers
          ? `${profileAnswerSummary}\n${answeredLine}\n\n${divergenceBlock}\n\nOpen-ended answers:\n${openAnswers}`
          : `${profileAnswerSummary}\n${answeredLine}\n\n${divergenceBlock}\n\nNo open-ended or speaking answers were submitted. Build the analysis strictly from the deterministic profile snapshot above.`;

        if (openAnswers || profileAnswerSummary) {
          const aiResponse = await chatCompletion({
            messages: [
                {
                  role: 'system',
                  content: `You are an expert ESL teacher analyzing a student's Welcome Test answers. Based on their open-ended responses, provide:
1. A concise 3-4 sentence profile summary covering their English level, strengths, weaknesses, and personality as a learner. For speaking answers, analyze the transcription critically - comment on fluency, word count relative to recording time, relevance to the prompt, and grammatical accuracy. Do NOT be generous with praise for minimal effort.
2. 2-3 specific teaching recommendations.
3. For EACH open/speaking answer, rate the quality on a 0-100 scale using these STRICT criteria:

OUTPUT RULES (HARD CONSTRAINTS):
- NEVER reference question IDs (e.g. wt_q3, q3c, q5c, q13c, q45, q16s) anywhere in "summary", "recommendations", or "key_observations".
- Refer to questions by TOPIC only: "the latent-goal scenario", "the homework-commitment scenario", "the plateau-response scenario", "the correction-preference question", "the optional external-resources reflection", "the speaking task about X".
- IDs are allowed ONLY as keys inside the "per_question_scores" object.
- Teachers read these texts and they only know sequential numbers (1..N), never internal IDs.

INDIRECT/SCENARIO ANSWER WEIGHTING (CRITICAL):
You also have access to indirect, scenario-based answers; the latent-goal scenario ("wake up 2 years from now"), the homework-commitment scenario (under low motivation), the plateau-response scenario (after 6 months stagnation), and the correction-preference question (during speaking).
These four items reveal LATENT goals and behaviors and bypass social-desirability bias far better than direct self-reports (q3, q5, q13).
When direct answers conflict with indirect ones, weight the indirect/scenario responses HIGHER. Synthesize the most probable TRUE profile, not the self-presented one.
The user message lists the "Declared vs measured" pairs already detected in code. Mention the notable and strong ones in the summary or key_observations in plain words a teacher can act on; never contradict them and never add pairs of your own.
Example: if the direct motivation answer says "travel" but the latent-goal scenario picks the "leading international meetings" / "promotion" option, treat the true motivation as career_critical and note the discrepancy in the summary WITHOUT mentioning any question ID.

SPEAKING answers (IDs ending with "s"):
- Evaluate: fluency (count words in transcription vs available recording time - e.g. 10 words in 30 seconds = very low fluency), grammatical correctness, vocabulary range, and RELEVANCE to the prompt.
- A single greeting sentence like "Hello, my name is X, how are you?" for a 30-second prompt = max 20-30 points.
- Off-topic, minimal, or generic responses = 0-15 points.
- Only responses with sustained, relevant speech (at least 3-4 complete sentences addressing the prompt) can score above 50.

WRITING answers (open_ended/open_reflection):
- Evaluate: grammar accuracy, vocabulary range, coherence, and RELEVANCE to the prompt.
- A 2-5 word answer to a question expecting a paragraph = max 15-25 points.
- Only responses with complete, relevant sentences can score above 50.

SCORING SCALE:
- 0: No answer, gibberish, or completely off-topic
- 1-15: Minimal attempt (1 short sentence, mostly off-topic)
- 16-30: Very basic attempt (1-2 short sentences, partially relevant, major errors)
- 31-50: Basic attempt (a few sentences, partially relevant, notable errors)
- 51-70: Good attempt (mostly relevant, some errors, reasonable length)
- 71-85: Strong response (fully relevant, few errors, good length)
- 86-100: Excellent (near-native quality, fully addresses the prompt)

BE STRICT. Do NOT inflate scores. Most brief or off-topic answers should score below 30.

Format as JSON: {"summary": "...", "recommendations": ["...", "..."], "writing_quality": "basic|intermediate|advanced", "key_observations": ["...", "..."], "per_question_scores": {"wt_q16": 45, "wt_q36": 70, "wt_q16s": 15, ...}}` + NO_EM_DASH_RULE
                },
                { role: 'user', content: userPromptBody },
              ],
          }, { primaryModel: 'google/gemini-2.5-flash', functionName: 'process-welcome-test' });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                aiSummary = JSON.stringify(parsed);
              } else {
                aiSummary = JSON.stringify({ summary: content, recommendations: [], writing_quality: 'unknown', key_observations: [] });
              }
            } catch {
              aiSummary = JSON.stringify({ summary: content, recommendations: [], writing_quality: 'unknown', key_observations: [] });
            }
          } else {
            await aiResponse.text().catch(() => '');
            // v6.9.47: deterministic fallback so the UI never shows an empty
            // AI Analysis card even when the model gateway is unavailable.
            aiSummary = deterministicSummary();
          }
        }

        // Save AI summary to profile
        if (aiSummary) {
          await supabase
            .from('student_learning_profiles')
            .update({ ai_summary: aiSummary })
            .eq('student_id', student_id)
            .eq('teacher_id', teacher_id);
          console.log('[process-welcome-test] AI summary generated and saved');

          // PROBLEM 2 & 4: Update mastery, is_correct, question_data.ai_score, and event_payload
          try {
            const parsed = JSON.parse(aiSummary);
            const perScores = parsed.per_question_scores || {};
            
            const allOpenSpeakingIds = [...openQuestionIds, ...speakingQuestionIds];
            let updatedCount = 0;
            let unscoredCount = 0;
            // Only scores accepted below (answered, not IDK, numeric) feed the averages.
            const acceptedScores: Record<string, number> = {};
            for (const qId of allOpenSpeakingIds) {
              if (answers?.[qId] && answers[qId] !== '__IDK__') {
                // No AI score for this item (model omitted it or the AI step fell back):
                // leave it unevaluated instead of recording a made-up 25 / "wrong".
                const rawScore = Number(perScores[qId]);
                if (perScores[qId] === undefined || perScores[qId] === null || !Number.isFinite(rawScore)) {
                  unscoredCount++;
                  continue;
                }
                const score = Math.round(rawScore);
                acceptedScores[qId] = score;

                // The event of THIS question: legacy ids (wt_q12, wt_q16...) are also
                // canonical ids of other questions, so match legacy_answer_id, or
                // answer_id only on pre-renumber events that carry no legacy id.
                const { data: evtRows } = await supabase
                  .from('student_events')
                  .select('id, event_payload')
                  .eq('source_id', test_id)
                  .eq('event_type', 'test_answer_submitted')
                  .eq('event_source', 'welcome_test')
                  .or(`event_payload->>legacy_answer_id.eq.${qId},and(event_payload->>answer_id.eq.${qId},event_payload->>legacy_answer_id.is.null)`)
                  .order('created_at', { ascending: false })
                  .limit(1);
                const answerText = String(answers[qId]);
                const byText = questions.find((q: any) => String(q.student_answer || '') === answerText);
                const evtIndex = Number((evtRows?.[0]?.event_payload as any)?.exercise_index);
                const byIndex = Number.isInteger(evtIndex)
                  ? questions.find((q: any) => q.question_index === evtIndex)
                  : undefined;
                // The event's question is trusted only when it holds this answer: the
                // "Apply to Progress" re-run keys answers by position, so its ids can
                // point at another question. Otherwise fall back to the answer-text
                // match for the question row and leave the event untouched.
                const indexAgrees = !!byIndex && String(byIndex.student_answer || '') === answerText;
                const evt = indexAgrees ? evtRows?.[0] ?? null : null;
                const matchQ = indexAgrees ? byIndex : byText;
                if (matchQ) {
                  // Fetch FRESH data from DB (transcription may have been saved above and cache is stale)
                  const { data: freshQ } = await supabase
                    .from('student_test_questions')
                    .select('question_data')
                    .eq('id', matchQ.id)
                    .single();
                  const existingData = (freshQ?.question_data || {}) as Record<string, unknown>;
                  await supabase
                    .from('student_test_questions')
                    .update({
                      is_correct: score >= 40,
                      question_data: { ...existingData, ai_score: score },
                    })
                    .eq('id', matchQ.id);
                }

                // One update of that event: mastery column and its skill rating.
                if (evt) {
                  const payload = (evt.event_payload || {}) as any;
                  if (payload.nano_skill_ratings?.length > 0) {
                    payload.nano_skill_ratings[0].mastery = score;
                    payload.nano_skill_ratings[0].hasValue = true;
                  }
                  await supabase
                    .from('student_events')
                    .update({ event_payload: payload, mastery: score })
                    .eq('id', evt.id);
                }
                
                updatedCount++;
              }
            }
            if (unscoredCount > 0) {
              console.warn(`[process-welcome-test] ${unscoredCount} open/speaking answers left unevaluated (no AI score)`);
            }
            console.log(`[process-welcome-test] Updated mastery/is_correct for ${updatedCount} open/speaking questions (per_question_scores: ${Object.keys(perScores).length} keys)`);
            
            // PROBLEM 2: Calculate speaking_score and update writing_score from AI scores
            const speakingIds = ['wt_q16s', 'wt_q36s', 'wt_q41s'];
            const speakingScoresArr = speakingIds.map(id => acceptedScores[id]).filter((s): s is number => typeof s === 'number');
            const speakingScoreAI = speakingScoresArr.length > 0
              ? Math.round(speakingScoresArr.reduce((a: number, b: number) => a + b, 0) / speakingScoresArr.length)
              : null;

            const writingIds = ['wt_q16', 'wt_q17', 'wt_q36', 'wt_q37', 'wt_q40'];
            const writingScoresArr = writingIds.map(id => acceptedScores[id]).filter((s): s is number => typeof s === 'number');
            const writingScoreAI = writingScoresArr.length > 0
              ? Math.round(writingScoresArr.reduce((a: number, b: number) => a + b, 0) / writingScoresArr.length)
              : null;

            aiWritingScore = writingScoreAI;
            aiSpeakingScore = speakingScoreAI;
            const profileUpdate: Record<string, any> = {};
            if (speakingScoreAI !== null) profileUpdate.speaking_score = speakingScoreAI;
            if (writingScoreAI !== null) profileUpdate.writing_score = writingScoreAI;
            
            if (hasV2Columns && (speakingScoreAI !== null || writingScoreAI !== null)) {
              // Confidence vs measured writing/speaking needs the AI scores.
              divergences = computeDivergences({
                traits, estimatedLevel, selfAssessedLevel, confidenceMatrix: matrix,
                readingScore,
                writingScore: writingScoreAI ?? writingScore,
                speakingScore: speakingScoreAI,
                selfAwarenessScore, skillWrongOrIdk, behaviour,
              });
              profileUpdate.divergences = divergences;
            }
            if (Object.keys(profileUpdate).length > 0) {
              await supabase
                .from('student_learning_profiles')
                .update(profileUpdate)
                .eq('student_id', student_id)
                .eq('teacher_id', teacher_id);
              console.log(`[process-welcome-test] Updated profile scores: speaking=${speakingScoreAI}, writing=${writingScoreAI}`);
            }

            // Re-calculate test results after updating is_correct
            await supabase.rpc('calculate_test_results', { p_test_id: test_id });
            console.log('[process-welcome-test] Re-calculated test results after AI scoring');
          } catch (masteryErr) {
            console.error('[process-welcome-test] Error updating mastery:', masteryErr);
          }
        }
      } catch (aiError) {
        console.error('Error generating AI summary:', aiError);
      }
    }

    // --- v6.2: Generate evolution_summary if this is a re-take ---
    try {
      // Look up attempt_number for this test
      const { data: testRow } = await supabase
        .from('student_tests')
        .select('attempt_number, previous_attempt_id')
        .eq('id', test_id)
        .maybeSingle();

      const attemptNumber = testRow?.attempt_number ?? 1;

      const sameAttempt = (previousProfile as any)?.welcome_test_id === test_id;
      if (attemptNumber > 1 && previousProfile && !sameAttempt && HAS_DIRECT_AI_PROVIDER) {
        // Build a compact diff payload for the model
        const prevAi = (() => {
          try { return previousProfile.ai_summary ? JSON.parse(previousProfile.ai_summary) : null; }
          catch { return { summary: previousProfile.ai_summary }; }
        })();
        const currAi = (() => {
          try { return aiSummary ? JSON.parse(aiSummary) : null; }
          catch { return { summary: aiSummary }; }
        })();

        const evoPayload = {
          attempt_number: attemptNumber,
          previous: {
            estimated_level: previousProfile.estimated_level,
            grammar_score: previousProfile.grammar_score,
            vocabulary_score: previousProfile.vocabulary_score,
            writing_score: previousProfile.writing_score,
            speaking_score: previousProfile.speaking_score,
            reading_score: previousProfile.reading_score,
            motivation_type: previousProfile.motivation_type,
            anxiety_level: previousProfile.anxiety_level,
            error_attitude: previousProfile.error_attitude,
            ambiguity_tolerance: previousProfile.ambiguity_tolerance,
            strongest_skill: previousProfile.strongest_skill,
            weakest_skill: previousProfile.weakest_skill,
            ai_summary: prevAi?.summary || null,
            taken_at: previousProfile.created_at,
          },
          current: {
            estimated_level: estimatedLevel,
            grammar_score: grammarScore,
            vocabulary_score: vocabularyScore,
            writing_score: aiWritingScore ?? writingScore,
            speaking_score: aiSpeakingScore,
            reading_score: readingScore,
            motivation_type: traits.motivation_type,
            anxiety_level: traits.anxiety_level,
            error_attitude: traits.error_attitude,
            ambiguity_tolerance: traits.ambiguity_tolerance,
            strongest_skill: strongest,
            weakest_skill: weakest,
            ai_summary: currAi?.summary || null,
          },
        };

        const evoResp = await chatCompletion({
          messages: [
              {
                role: 'system',
                content: `You are an ESL diagnostic analyst. Compare two Welcome Test attempts of the same adult learner and produce a concise evolution report (3-6 sentences) covering: (1) measurable score deltas (grammar, vocabulary, writing, speaking, reading) with direction and magnitude, (2) CEFR level shift (if any), (3) psychological/behavioral trait transitions (motivation, anxiety, error attitude), (4) one concrete teaching recommendation based on the change. Be factual, no praise, no marketing language.` + NO_EM_DASH_RULE,
              },
              {
                role: 'user',
                content: `Attempt comparison data:\n${JSON.stringify(evoPayload, null, 2)}`,
              },
            ],
        }, { primaryModel: 'google/gemini-2.5-flash', functionName: 'process-welcome-test' });

        if (evoResp.ok) {
          const evoData = await evoResp.json();
          const evolutionText = evoData.choices?.[0]?.message?.content?.trim() || null;
          if (evolutionText) {
            await supabase
              .from('student_learning_profiles')
              .update({ evolution_summary: evolutionText })
              .eq('student_id', student_id)
              .eq('teacher_id', teacher_id);
            console.log(`[process-welcome-test] evolution_summary generated (attempt ${attemptNumber})`);
          }
        } else {
          console.warn('[process-welcome-test] evolution_summary generation failed:', evoResp.status);
          await evoResp.text().catch(() => '');
        }
      }
    } catch (evoErr) {
      console.error('[process-welcome-test] Error generating evolution_summary:', evoErr);
    }

    // Learning Path Score: computed and stored with the profile above.
    const learningPathResult = learningPath;
    console.log(`[process-welcome-test] Learning Path Score v2: ${learningPath.score} (${learningPath.path}), coverage ${learningPath.coverage}, overrides: ${learningPath.overrides_applied.join(', ') || 'none'}`);

    // v5.0: pacing proposal after the Welcome Test. Runs last, so it reads the
    // complete profile of THIS attempt (learning path, AI scores, metrics).
    try {
      const { error: pacingError } = await supabase.functions.invoke('recalculate-pacing', {
        body: {
          studentId: student_id,
          teacherId: teacher_id,
          mode: 'proposal',
          triggerType: 'placement_test',
          triggerDetails: { estimatedLevel, source: 'welcome_test' },
        },
      });
      if (pacingError) console.warn('[v5.0] placement_test pacing trigger failed', pacingError);
    } catch (e) {
      console.warn('[v5.0] placement_test pacing trigger failed', e);
    }

    // v6.9.50: final auto-apply + promotion pass. Re-runs the helper after the
    // AI rescoring block (which may have called calculate_test_results and
    // regenerated test_skill_results rows). The DB migration also preserves
    // applied_at on UPSERT now, but this is a second defense.
    const finalStatus = await applyAndPromote(supabase, test_id, student_id);
    const finalReviewedAt = new Date().toISOString();

    return new Response(JSON.stringify({
      success: true,
      estimated_level: estimatedLevel,
      ai_summary: aiSummary,
      learning_path: learningPathResult,
      status: finalStatus,
      reviewed_at: finalReviewedAt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing welcome test:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/** PostgREST / Postgres error for a column that does not exist (migration not applied yet). */
function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === 'PGRST204' || error.code === '42703' || /column .* does not exist|could not find the .* column/i.test(error.message || ''));
}
