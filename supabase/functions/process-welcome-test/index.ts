import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// Learning Path Score Algorithm (deterministic)
// Uses 15 signals: 5 new behavioral + 10 existing questions
// =====================================================

function calculateLearningPathScore(
  traits: Record<string, string>,
  answers: Record<string, any> | null,
  questions: any[]
): { score: number; path: string; component_scores: Record<string, number>; overrides_applied: string[] } {
  const FALLBACK = 50;
  const overrides: string[] = [];

  // --- 5 NEW BEHAVIORAL QUESTIONS (weight: 0.50) ---

  // Q5b - deadline_response (weight 0.10)
  const deadlineMap: Record<string, number> = { intense_preparation: 80, pragmatic_coping: 60, avoidance: 20, confident: 50 };
  const deadlineScore = deadlineMap[traits.deadline_response] ?? FALLBACK;

  // Q41b - learning_timeline (weight 0.15)
  const timelineMap: Record<string, number> = { urgent_specific: 95, ongoing_important: 60, long_term_steady: 25, hobby_growth: 10 };
  const timelineScore = timelineMap[traits.learning_timeline] ?? FALLBACK;

  // Q13b - persistence_level (weight 0.10)
  const persistenceMap: Record<string, number> = { high: 80, medium: 50, low: 20 };
  const persistenceScore = persistenceMap[traits.persistence_level] ?? FALLBACK;

  // Q17b - career_english_importance (weight 0.10)
  const importanceMap: Record<string, number> = { critical: 90, high: 70, moderate: 40, not_career: 15 };
  const importanceScore = importanceMap[traits.career_english_importance] ?? FALLBACK;

  // Q3b - usage_context (weight 0.05) - multi-select: take highest
  const contextMap: Record<string, number> = { work_formal: 70, professional_field: 80, travel: 40, social: 35, online_informal: 30, content_consumption: 25 };
  let contextScore = FALLBACK;
  const usageCtx = traits.usage_context;
  if (usageCtx) {
    // Could be single value or comma-separated from multi-select
    const ctxValues = usageCtx.split(',').map(v => v.trim());
    const ctxScores = ctxValues.map(v => contextMap[v] ?? FALLBACK);
    contextScore = Math.max(...ctxScores);
  }
  // Also check raw answer array for multi-select
  const q3bAnswer = answers?.wt_q3b;
  if (Array.isArray(q3bAnswer)) {
    const q3bOptions = [
      'At work - emails, meetings, calls',
      'Traveling - airports, hotels, restaurants',
      'Online - social media, forums, gaming',
      'With friends/family who speak English',
      'Consuming content - movies, books, podcasts',
      'In my professional field (medical, legal, IT, etc.)',
    ];
    const q3bContextMap: Record<number, number> = { 0: 70, 1: 40, 2: 30, 3: 35, 4: 25, 5: 80 };
    const rawScores = q3bAnswer.map(a => {
      const idx = q3bOptions.indexOf(a);
      return idx >= 0 ? (q3bContextMap[idx] ?? FALLBACK) : FALLBACK;
    });
    if (rawScores.length > 0) contextScore = Math.max(...rawScores);
  }

  // --- 10 EXISTING QUESTIONS (weight: 0.50) ---

  // Q3 - motivation_type (weight 0.06)
  const motivationMap: Record<string, number> = { instrumental: 70, integrative: 30, mixed: 50 };
  const motivationScore = motivationMap[traits.motivation_type] ?? FALLBACK;

  // Q4 - ambiguity_tolerance (weight 0.06)
  const ambiguityMap: Record<string, number> = { high: 75, medium: 45, low: 15 };
  const ambiguityScore = ambiguityMap[traits.ambiguity_tolerance] ?? FALLBACK;

  // Q5 - weekly_study_time (weight 0.07)
  const studyTimeMap: Record<string, number> = { none: 10, '15_30_min': 25, '1_hour': 45, '2_3_hours': 70, '3_plus_hours': 90 };
  const studyTimeScore = studyTimeMap[traits.weekly_study_time] ?? FALLBACK;

  // Q7 - anxiety_level (weight 0.06) - INVERTED
  const anxietyMap: Record<string, number> = { low: 70, medium: 40, high: 10 };
  const anxietyScore = anxietyMap[traits.anxiety_level] ?? FALLBACK;

  // Q9 - learning_duration (weight 0.04) - read from answer index
  const q9Options = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', 'More than 10 years'];
  const durationIndexMap: Record<number, number> = { 0: 70, 1: 60, 2: 45, 3: 30, 4: 15 };
  let durationScore = FALLBACK;
  let durationIndex = -1;
  const q9Answer = answers?.wt_q9;
  if (typeof q9Answer === 'string') {
    const idx = q9Options.indexOf(q9Answer);
    if (idx >= 0) { durationScore = durationIndexMap[idx] ?? FALLBACK; durationIndex = idx; }
  }

  // Q10 - learning_autonomy (weight 0.04) - multi-select
  const q10Options = ['School (as a subject)', 'University', 'Private lessons with a teacher', 'Language school/course', 'Self-study (apps, books, YouTube)', 'Living/working in an English-speaking country', 'Through work (using English daily)'];
  let autonomyScore = FALLBACK;
  const q10Answer = answers?.wt_q10;
  if (Array.isArray(q10Answer)) {
    const indices = q10Answer.map(a => q10Options.indexOf(a));
    if (indices.includes(5)) autonomyScore = 80; // Living/working abroad
    else if (indices.includes(4) || indices.includes(6)) autonomyScore = 70; // Self-study or through work
    else if (indices.length === 1 && indices[0] === 0) autonomyScore = 20; // Only school
    else autonomyScore = 40;
  }

  // Q14 - error_attitude (weight 0.05)
  const errorMap: Record<string, number> = { comfortable: 75, cautious: 40, avoidant: 10 };
  const errorScore = errorMap[traits.error_attitude] ?? FALLBACK;

  // Q15 - reading_strategy (weight 0.04) - now uses reconstructed trait
  const readingStratTraitMap: Record<string, number> = {
    careful_lookup: 50,
    clarification_seeker: 55,
    context_guesser: 75,
    struggles_translates: 25,
    avoids_uses_ai: 35,
  };
  const readingStratScore = readingStratTraitMap[traits.reading_strategy] ?? FALLBACK;

  // Q42 - feedback_preference (weight 0.04)
  const feedbackMap: Record<string, number> = { immediate: 65, delayed_discussion: 45, major_only: 35, written_review: 50, self_correct: 70 };
  const feedbackScore = feedbackMap[traits.feedback_preference] ?? FALLBACK;

  // Q44 - confidence_matrix (weight 0.04) - average of 6 values scaled 0-100
  let confidenceScore = FALLBACK;
  const q44Answer = answers?.wt_q44;
  if (q44Answer && typeof q44Answer === 'object') {
    const values = Object.values(q44Answer).filter(v => typeof v === 'number') as number[];
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      confidenceScore = (avg - 1) * 25; // 1->0, 2->25, 3->50, 4->75, 5->100
      confidenceScore = Math.max(0, Math.min(100, confidenceScore));
    }
  }

  // --- WEIGHTED SUM ---
  let score = (
    deadlineScore     * 0.10 +
    timelineScore     * 0.15 +
    persistenceScore  * 0.10 +
    importanceScore   * 0.10 +
    contextScore      * 0.05 +
    motivationScore   * 0.06 +
    ambiguityScore    * 0.06 +
    studyTimeScore    * 0.07 +
    anxietyScore      * 0.06 +
    durationScore     * 0.04 +
    autonomyScore     * 0.04 +
    errorScore        * 0.05 +
    readingStratScore * 0.04 +
    feedbackScore     * 0.04 +
    confidenceScore   * 0.04
  );

  // --- OVERRIDE RULES ---

  // Rule 1: Urgent deadline + critical career = ALWAYS target path
  if (traits.learning_timeline === 'urgent_specific' && traits.career_english_importance === 'critical') {
    if (score < 85) { score = Math.max(score, 85); overrides.push('urgent_critical_override'); }
  }

  // Rule 2: Low persistence + hobby = ALWAYS comfort path
  if (traits.persistence_level === 'low' && traits.learning_timeline === 'hobby_growth') {
    if (score > 25) { score = Math.min(score, 25); overrides.push('lazy_hobby_override'); }
  }

  // Rule 3: Urgent deadline + low persistence = deadline boosts motivation
  if (traits.learning_timeline === 'urgent_specific' && traits.persistence_level === 'low') {
    if (score < 70) { score = Math.max(score, 70); overrides.push('urgent_lazy_override'); }
  }

  // Rule 4: High anxiety + no study time = forced comfort
  if (traits.anxiety_level === 'high' && traits.weekly_study_time === 'none') {
    if (score > 20) { score = Math.min(score, 20); overrides.push('anxious_notime_override'); }
  }

  // Rule 5: 10+ years learning + low grit = fossilization risk
  if (durationIndex === 4 && traits.persistence_level === 'low') {
    if (score > 30) { score = Math.min(score, 30); overrides.push('fossilization_override'); }
  }

  // --- v5.4: plateau_response weights (Pacing-critical) ---
  if (traits.plateau_response === 'doubt_prone') {
    score -= 8; overrides.push('plateau_doubt_prone');
  } else if (traits.plateau_response === 'intensity_response' && traits.persistence_level === 'high') {
    score += 8; overrides.push('plateau_intensity_high_grit');
  } else if (traits.plateau_response === 'adaptive') {
    score += 4; overrides.push('plateau_adaptive');
  } else if (traits.plateau_response === 'resilient' && traits.deadline_response === 'intense_preparation') {
    score += 6; overrides.push('plateau_resilient_intense');
  }

  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine path
  let path = 'comfort';
  if (score >= 76) path = 'target';
  else if (score >= 51) path = 'accelerated';
  else if (score >= 26) path = 'guided';

  return {
    score,
    path,
    component_scores: {
      deadline_response: deadlineScore,
      learning_timeline: timelineScore,
      persistence_level: persistenceScore,
      career_importance: importanceScore,
      usage_context: contextScore,
      motivation_type: motivationScore,
      ambiguity_tolerance: ambiguityScore,
      weekly_study_time: studyTimeScore,
      anxiety_level: anxietyScore,
      learning_duration: durationScore,
      learning_autonomy: autonomyScore,
      error_attitude: errorScore,
      reading_strategy: readingStratScore,
      feedback_preference: feedbackScore,
      confidence_overall: confidenceScore,
    },
    overrides_applied: overrides,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // v6.9.50 — extracted, idempotent. Applies skill ratings to learning
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
    const { test_id, student_id: bodyStudentId, teacher_id: bodyTeacherId, detected_traits, answered_count, force } = body || {};
    let answers = (body && body.answers) || null;
    let student_id = bodyStudentId;
    let teacher_id = bodyTeacherId;

    // v6.9.48 — "force" re-run for retroactive auto-apply repair. Teacher-side
    // "Apply to Progress" can call us with just { test_id, force: true } so we
    // resolve student/teacher from the test row itself and bypass the
    // already-reviewed/dedupe guards.
    if (force && test_id && (!student_id || !teacher_id)) {
      const supabaseTmp = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: testRow } = await supabaseTmp
        .from('student_tests')
        .select('student_id, teacher_id')
        .eq('id', test_id)
        .maybeSingle();
      if (testRow) {
        student_id = student_id || (testRow as any).student_id;
        teacher_id = teacher_id || (testRow as any).teacher_id;
      }
    }

    // v6.9.48 — when caller did not provide answers (force re-run from teacher
    // UI), reconstruct them from the persisted student_test_questions.
    if (force && (!answers || Object.keys(answers).length === 0) && test_id) {
      const supabaseTmp = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: persistedQs } = await supabaseTmp
        .from('student_test_questions')
        .select('skill_tags, student_answer, question_index')
        .eq('test_id', test_id);
      const map: Record<string, unknown> = {};
      for (const q of (persistedQs || []) as any[]) {
        const qid = `wt_q${(q.question_index ?? 0) + 1}`;
        map[qid] = q.student_answer;
      }
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

    // Estimate level from grammar + vocabulary scores
    const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score!, 0) / scores.length : 0;
    let estimatedLevel = 'A2';
    if (avgScore >= 90) estimatedLevel = 'C1';
    else if (avgScore >= 75) estimatedLevel = 'B2';
    else if (avgScore >= 55) estimatedLevel = 'B1';
    else if (avgScore >= 35) estimatedLevel = 'A2';
    else estimatedLevel = 'A1';

    // ===== SERVER-SIDE TRAIT RECONSTRUCTION (Issue 6B) =====
    // Reconstruct traits from answers instead of relying on frontend detected_traits
    // This ensures traits are correct even after page refresh/cross-device resume
    
    const TRAIT_QUESTIONS: Record<string, { questionId: string; options: string[]; mapping: Record<string, string> }> = {
      self_assessed_level: {
        questionId: 'wt_q1',
        options: [
          'I can handle basic everyday situations like ordering food or asking for directions',
          'I can have simple conversations about familiar topics but struggle with complex ideas',
          'I can discuss most topics but make grammatical mistakes and sometimes lack vocabulary',
          'I speak fluently in most situations but want to sound more natural and precise',
          "I'm comfortable in English but want to master advanced/professional language",
        ],
        mapping: { '0': 'A1-A2', '1': 'A2-B1', '2': 'B1-B2', '3': 'B2-C1', '4': 'C1-C2' },
      },
      motivation_type: {
        questionId: 'wt_q3',
        options: [
          'I need it for my job - meetings, emails, presentations',
          "I'm preparing for an exam (IELTS, Cambridge, etc.)",
          'I want to travel and communicate freely',
          'I want to watch movies/read books without subtitles',
          'I want to feel confident talking to English speakers',
          'Career advancement - I need English for promotion',
          "I'm moving to an English-speaking country",
        ],
        mapping: { '0': 'instrumental', '1': 'instrumental', '2': 'integrative', '3': 'integrative', '4': 'integrative', '5': 'instrumental', '6': 'instrumental' },
      },
      ambiguity_tolerance: {
        questionId: 'wt_q4',
        options: [
          'I ask the person to repeat or explain',
          'I pretend I understood and hope for the best',
          'I try to guess from context',
          'I get stressed and switch to my language',
          'I look it up immediately on my phone',
        ],
        mapping: { '0': 'high', '1': 'low', '2': 'high', '3': 'low', '4': 'medium' },
      },
      weekly_study_time: {
        questionId: 'wt_q5',
        options: [
          'Almost none - I only have lesson time',
          '15-30 minutes a few times a week',
          'About 1 hour spread across the week',
          "2-3 hours - I'm committed",
          'More than 3 hours - English is my priority',
        ],
        mapping: { '0': 'none', '1': '15_30_min', '2': '1_hour', '3': '2_3_hours', '4': '3_plus_hours' },
      },
      anxiety_level: {
        questionId: 'wt_q7',
        options: [
          "I don't mind at all - that's how you learn",
          'I prefer not to, but I can handle it',
          'I feel embarrassed but try to push through',
          "I avoid speaking because I'm afraid of mistakes",
          'I get really frustrated with myself',
        ],
        mapping: { '0': 'low', '1': 'low', '2': 'medium', '3': 'high', '4': 'high' },
      },
      preferred_input_channel: {
        questionId: 'wt_q8',
        options: [
          'Seeing it written down with a definition',
          'Hearing it in a sentence',
          'Using it in my own sentence right away',
          'Connecting it to a picture or image',
          'Repeating it many times',
          'Understanding the word parts (prefix, root, suffix)',
        ],
        mapping: { '0': 'visual', '1': 'auditory', '2': 'kinesthetic', '3': 'visual', '4': 'auditory', '5': 'visual' },
      },
      error_attitude: {
        questionId: 'wt_q14',
        options: [
          'I say "Sorry, could you repeat that please?" and try again',
          'I just point at the menu and smile',
          'I use Google Translate on my phone',
          'I answer with what I think they asked',
        ],
        mapping: { '0': 'comfortable', '1': 'avoidant', '2': 'cautious', '3': 'comfortable' },
      },
      feedback_preference: {
        questionId: 'wt_q42',
        options: [
          'Correct me immediately, every time',
          'Note them down and discuss at the end',
          'Only correct major mistakes, ignore small ones',
          'Write corrections for me to review later',
          'I prefer to self-correct with hints',
        ],
        mapping: { '0': 'immediate', '1': 'delayed_discussion', '2': 'major_only', '3': 'written_review', '4': 'self_correct' },
      },
      // 5 new behavioral questions for Learning Path Score
      usage_context: {
        questionId: 'wt_q3b',
        options: [
          'At work - emails, meetings, calls',
          'Traveling - airports, hotels, restaurants',
          'Online - social media, forums, gaming',
          'With friends/family who speak English',
          'Consuming content - movies, books, podcasts',
          'In my professional field (medical, legal, IT, etc.)',
        ],
        mapping: { '0': 'work_formal', '1': 'travel', '2': 'online_informal', '3': 'social', '4': 'content_consumption', '5': 'professional_field' },
      },
      deadline_response: {
        questionId: 'wt_q5b',
        options: [
          "I'd panic at first, but then prepare intensively every day until the meeting",
          "I'd feel nervous but would ask a colleague for help and practice the key phrases",
          "I'd ask to postpone or let someone else handle it",
          "I'd feel fairly confident - I'd just review some vocabulary beforehand",
        ],
        mapping: { '0': 'intense_preparation', '1': 'pragmatic_coping', '2': 'avoidance', '3': 'confident' },
      },
      persistence_level: {
        questionId: 'wt_q13b',
        options: [
          'I stuck with it and got pretty good at it',
          'I practiced for a while but eventually moved on to something else',
          'I started enthusiastically but lost motivation after a few weeks',
          "I'm still learning it - I haven't given up yet",
        ],
        mapping: { '0': 'high', '1': 'medium', '2': 'low', '3': 'high' },
      },
      career_english_importance: {
        questionId: 'wt_q17b',
        options: [
          "This is exactly why I'm learning English - I need to be ready for opportunities like this",
          "I'd apply anyway and hope my English improves by the time they interview me",
          "I'd skip it - I'm not learning English for work reasons",
          "I'd apply and highlight my other strengths to compensate for my English",
        ],
        mapping: { '0': 'critical', '1': 'high', '2': 'not_career', '3': 'moderate' },
      },
      reading_strategy: {
        questionId: 'wt_q15',
        options: [
          'I read it carefully, look up unknown words, and reply',
          'I reply asking them to clarify the confusing parts',
          'I understand most of it and guess the rest from context',
          'I struggle to understand and need to translate most of it',
          "I don't try to understand, I use ChatGPT",
        ],
        mapping: { '0': 'careful_lookup', '1': 'clarification_seeker', '2': 'context_guesser', '3': 'struggles_translates', '4': 'avoids_uses_ai' },
      },
      learning_timeline: {
        questionId: 'wt_q41b',
        options: [
          'I have a specific event coming up soon where I need English (trip, interview, presentation)',
          'I need English regularly for my work/life, and I want to get noticeably better in the next few months',
          "I'm learning English for the long term - there's no rush, but I want steady progress",
          "English is something I enjoy learning - it's more about personal growth than a specific need",
        ],
        mapping: { '0': 'urgent_specific', '1': 'ongoing_important', '2': 'long_term_steady', '3': 'hobby_growth' },
      },
      // v5.4 — 4 new behavioral traits
      latent_goal: {
        questionId: 'wt_q3c',
        options: [
          'I confidently lead meetings with international clients',
          'I watch Netflix shows without subtitles, effortlessly',
          'I feel like a local when I travel anywhere in the world',
          'I got promoted to a position that requires English',
          'I read books in the original language for pleasure',
        ],
        mapping: { '0': 'career_critical', '1': 'lifestyle', '2': 'travel_lifestyle', '3': 'career_critical', '4': 'lifestyle' },
      },
      homework_commitment: {
        questionId: 'wt_q5c',
        options: [
          'I do it quickly just to get it off my plate',
          'I do it carefully, even if it takes an hour',
          "I message the teacher that I didn't make it and will do it later",
          'I start it but stop after about 10 minutes',
          "I already did it earlier — I don't leave things until the last minute",
        ],
        mapping: { '0': 'pragmatic', '1': 'high', '2': 'avoidant', '3': 'low', '4': 'proactive' },
      },
      plateau_response: {
        questionId: 'wt_q13c',
        options: [
          'Push harder — more hours, more material',
          'Change the method, teacher, or approach',
          'Take a break for a week or two',
          'Accept the plateau as part of the process and keep going',
          'Start to doubt whether this is really for me',
        ],
        mapping: { '0': 'intensity_response', '1': 'adaptive', '2': 'rest_response', '3': 'resilient', '4': 'doubt_prone' },
      },
      correction_preference: {
        questionId: 'wt_q7b',
        options: [
          'Correct me immediately — I want to know right away',
          'Take notes and tell me after I finish my thought',
          'Only correct serious mistakes — small ones discourage me',
          'Explain the rule every time I make a mistake',
          'Send me a written summary after the lesson',
        ],
        mapping: { '0': 'immediate', '1': 'delayed', '2': 'selective', '3': 'rule_based', '4': 'written_summary' },
      },
    };

    // Reconstruct traits from DB answers (not frontend state)
    const traits: Record<string, string> = {};
    for (const [traitName, config] of Object.entries(TRAIT_QUESTIONS)) {
      // Try from DB questions first, then from answers payload
      const dbQ = questions.find((q: any) => {
        const qIdx = q.question_index;
        // Map question_index to question_id - check all questions
        return q.student_answer !== null;
      });
      
      // Use answers payload as source (it has question IDs as keys)
      const answerVal = answers?.[config.questionId];
      if (answerVal && typeof answerVal === 'string') {
        const optIdx = config.options.indexOf(answerVal);
        if (optIdx >= 0) {
          const mapped = config.mapping[String(optIdx)];
          if (mapped) traits[traitName] = mapped;
        }
      }
    }

    // Also use frontend detected_traits as fallback
    const frontendTraits = detected_traits || {};
    for (const [key, val] of Object.entries(frontendTraits)) {
      if (!traits[key] && val) traits[key] = val as string;
    }

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

    // v6.9.48 — fetch current student level early so we can attach a
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
    if (levelChangeSuggestion) {
      enrichedAnswers.level_change_suggestion = levelChangeSuggestion;
    }

    // Upsert learning profile
    const profileData = {
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
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('student_learning_profiles')
      .upsert(profileData, { onConflict: 'student_id,teacher_id' });

    if (upsertError) {
      console.error('Error upserting learning profile:', upsertError);
      throw upsertError;
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

    // v6.9.50 — initial auto-apply pass (idempotent, helper handles errors).
    // A second pass runs at the very end of the function so that any later
    // calls to `calculate_test_results` (AI rescoring path) cannot leave us
    // with applied_at=NULL on the regenerated skill rows.
    await applyAndPromote(supabase, test_id, student_id);

    // v6.9.39 P5 — Auto-fill student level + suggest goals from Welcome Test.
    // v6.9.40 P4 — Also auto-fill students.main_goal when missing/unknown,
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

      // v6.9.40 — derive a suggested main_goal from motivation/interests and
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

      // v6.9.48 — `force` lets the teacher repair stuck tests; suggestions are
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

    // v6.9.29 — Fire-and-forget thank-you email to the student. Idempotent server-side.
    try {
      const { data: studentRow } = await supabase
        .from('students')
        .select('name, email')
        .eq('id', student_id)
        .maybeSingle();
      const { data: teacherRow } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', teacher_id)
        .maybeSingle();
      const studentEmail = studentRow?.email;
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

    // v5.0: trigger pacing proposal (B) after Welcome Test finalisation.
    // Fire-and-forget — must not block test completion or notification flow.
    try {
      supabase.functions.invoke('recalculate-pacing', {
        body: {
          studentId: student_id,
          teacherId: teacher_id,
          mode: 'proposal',
          triggerType: 'placement_test',
          triggerDetails: { estimatedLevel, source: 'welcome_test' },
        },
      }).catch((e: any) => console.warn('[v5.0] placement_test pacing trigger failed', e));
    } catch (e) {
      console.warn('[v5.0] placement_test pacing dispatch threw', e);
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
                  <strong>Strongest:</strong> ${strongest} | <strong>Weakest:</strong> ${weakest || '—'}
                </p>` : ''}
                ${selfAssessedLevel ? `<p style="font-size: 14px; color: #374151;">
                  <strong>Self-assessed:</strong> ${selfAssessedLevel} (${levelConfidence})
                </p>` : ''}
              </div>
              <p>View the full learning profile in the student's profile page:</p>
              <a href="${Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'}/student/${student_id}?tab=tests" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin: 10px 0; font-weight: bold;">View Results →</a>
              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                — edooqoo
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
    if (LOVABLE_API_KEY) {
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

        // v6.9.47 — when no open/speaking answers exist, generate AI Analysis
        // from the deterministic profile + scenario answers so the teacher
        // never sees an empty "AI Analysis" section after completion/review.
        const profileAnswerSummary = `Profile snapshot (deterministic):\n- Estimated level: ${estimatedLevel}\n- Self-assessed level: ${selfAssessedLevel || 'unknown'} (${levelConfidence})\n- Skill scores: grammar=${grammarScore ?? '-'}%, vocabulary=${vocabularyScore ?? '-'}%, reading=${readingScore ?? '-'}%, writing=${writingScore ?? '-'}%\n- Strongest skill: ${strongest || 'n/a'}; weakest: ${weakest || 'n/a'}\n- Motivation type: ${traits.motivation_type || 'unknown'}; latent goal: ${traits.latent_goal || 'unknown'}\n- Anxiety: ${traits.anxiety_level || 'unknown'}; ambiguity tolerance: ${traits.ambiguity_tolerance || 'unknown'}; error attitude: ${traits.error_attitude || 'unknown'}\n- Feedback preference: ${traits.feedback_preference || 'unknown'}; correction preference: ${traits.correction_preference || 'unknown'}\n- Weekly study time: ${traits.weekly_study_time || 'unknown'}; homework commitment: ${traits.homework_commitment || 'unknown'}\n- Deadline response: ${traits.deadline_response || 'unknown'}; learning timeline: ${traits.learning_timeline || 'unknown'}; persistence: ${traits.persistence_level || 'unknown'}; plateau response: ${traits.plateau_response || 'unknown'}\n- Career importance: ${traits.career_english_importance || 'unknown'}; usage context: ${traits.usage_context || 'unknown'}\n- Interest topics: ${(interestTopics || []).join(', ') || 'none'}; preferred activities: ${(preferredActivities || []).join(', ') || 'none'}\n- Confidence matrix (1-5): speaking=${matrix['Speaking with strangers'] ?? '-'}, writing=${matrix['Writing formal emails'] ?? '-'}, listening=${matrix['Understanding movies without subtitles'] ?? '-'}, reading=${matrix['Reading news articles'] ?? '-'}, presenting=${matrix['Giving presentations'] ?? '-'}, small_talk=${matrix['Small talk at parties'] ?? '-'}`;
        const userPromptBody = openAnswers
          ? `Student profile data:\n- Estimated level: ${estimatedLevel}\n- Grammar score: ${grammarScore}%\n- Vocabulary score: ${vocabularyScore}%\n- Motivation: ${traits.motivation_type || 'unknown'}\n- Anxiety: ${traits.anxiety_level || 'unknown'}\n- Questions answered: ${questions.filter((q: any) => q.student_answer !== null).length}/${questions.length}\n\nOpen-ended answers:\n${openAnswers}`
          : `${profileAnswerSummary}\n\nNo open-ended or speaking answers were submitted. Build the analysis strictly from the deterministic profile snapshot above.`;

        if (openAnswers || profileAnswerSummary) {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
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
You also have access to indirect, scenario-based answers — the latent-goal scenario ("wake up 2 years from now"), the homework-commitment scenario (under low motivation), the plateau-response scenario (after 6 months stagnation), and the correction-preference question (during speaking).
These four items reveal LATENT goals and behaviors and bypass social-desirability bias far better than direct self-reports (q3, q5, q13).
When direct answers conflict with indirect ones, weight the indirect/scenario responses HIGHER. Synthesize the most probable TRUE profile, not the self-presented one.
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

Format as JSON: {"summary": "...", "recommendations": ["...", "..."], "writing_quality": "basic|intermediate|advanced", "key_observations": ["...", "..."], "per_question_scores": {"wt_q16": 45, "wt_q36": 70, "wt_q16s": 15, ...}}`
                },
                { role: 'user', content: userPromptBody },
              ],
            }),
          });

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
            const errText = await aiResponse.text().catch(() => '');
            await logModelFailure({
              model: 'google/gemini-2.5-flash',
              provider: 'lovable-gateway',
              status: aiResponse.status,
              endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
              error: errText.slice(0, 500),
              functionName: 'process-welcome-test',
            });
            // v6.9.47 — deterministic fallback so the UI never shows an empty
            // AI Analysis card even when the model gateway is unavailable.
            aiSummary = JSON.stringify({
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
            const writingQuality = parsed.writing_quality;
            const fallbackMastery = writingQuality === 'advanced' ? 75 :
                                    writingQuality === 'intermediate' ? 50 : 25;
            const perScores = parsed.per_question_scores || {};
            
            const allOpenSpeakingIds = [...openQuestionIds, ...speakingQuestionIds];
            let updatedCount = 0;
            for (const qId of allOpenSpeakingIds) {
              if (answers?.[qId] && answers[qId] !== '__IDK__') {
                const score = perScores[qId] !== undefined ? Math.round(perScores[qId]) : fallbackMastery;
                
                // Update is_correct and ai_score in student_test_questions
                const matchQ = questions.find((q: any) => {
                  // Match by student_answer value for speaking, or by index position
                  const sa = String(q.student_answer || '');
                  if (qId.endsWith('s')) {
                    // Speaking question - match by audio URL
                    return sa === String(answers[qId]);
                  }
                  // Open-ended - match by answer text
                  return sa === String(answers[qId]);
                });
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

                // Update mastery column in student_events
                await supabase
                  .from('student_events')
                  .update({ mastery: score })
                  .eq('source_id', test_id)
                  .eq('event_type', 'test_answer_submitted')
                  .or(`event_payload->>answer_id.eq.${qId},event_payload->>legacy_answer_id.eq.${qId}`);
                
                // PROBLEM 4: Also update nano_skill_ratings inside event_payload
                const { data: evt } = await supabase
                  .from('student_events')
                  .select('id, event_payload')
                  .eq('source_id', test_id)
                  .eq('event_type', 'test_answer_submitted')
                  .eq('event_source', 'welcome_test')
                  .or(`event_payload->>answer_id.eq.${qId},event_payload->>legacy_answer_id.eq.${qId}`)
                  .maybeSingle();
                
                if (evt?.event_payload) {
                  const payload = evt.event_payload as any;
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
            console.log(`[process-welcome-test] Updated mastery/is_correct for ${updatedCount} open/speaking questions (per_question_scores: ${Object.keys(perScores).length} keys)`);
            
            // PROBLEM 2: Calculate speaking_score and update writing_score from AI scores
            const speakingIds = ['wt_q16s', 'wt_q36s', 'wt_q41s'];
            const speakingScoresArr = speakingIds.map(id => perScores[id]).filter((s: any) => s !== undefined);
            const speakingScoreAI = speakingScoresArr.length > 0
              ? Math.round(speakingScoresArr.reduce((a: number, b: number) => a + b, 0) / speakingScoresArr.length)
              : null;

            const writingIds = ['wt_q16', 'wt_q17', 'wt_q36', 'wt_q37', 'wt_q40'];
            const writingScoresArr = writingIds.map(id => perScores[id]).filter((s: any) => s !== undefined);
            const writingScoreAI = writingScoresArr.length > 0
              ? Math.round(writingScoresArr.reduce((a: number, b: number) => a + b, 0) / writingScoresArr.length)
              : null;

            const profileUpdate: Record<string, any> = {};
            if (speakingScoreAI !== null) profileUpdate.speaking_score = speakingScoreAI;
            if (writingScoreAI !== null) profileUpdate.writing_score = writingScoreAI;
            
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

      if (attemptNumber > 1 && previousProfile && LOVABLE_API_KEY) {
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
            motivation_type: traits.motivation_type,
            anxiety_level: traits.anxiety_level,
            error_attitude: traits.error_attitude,
            ambiguity_tolerance: traits.ambiguity_tolerance,
            strongest_skill: strongest,
            weakest_skill: weakest,
            ai_summary: currAi?.summary || null,
          },
        };

        const evoResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are an ESL diagnostic analyst. Compare two Welcome Test attempts of the same adult learner and produce a concise evolution report (3-6 sentences) covering: (1) measurable score deltas (grammar, vocabulary, writing, speaking, reading) with direction and magnitude, (2) CEFR level shift (if any), (3) psychological/behavioral trait transitions (motivation, anxiety, error attitude), (4) one concrete teaching recommendation based on the change. Be factual, no praise, no marketing language.`,
              },
              {
                role: 'user',
                content: `Attempt comparison data:\n${JSON.stringify(evoPayload, null, 2)}`,
              },
            ],
          }),
        });

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
          const errText = await evoResp.text().catch(() => '');
          await logModelFailure({
            model: 'google/gemini-2.5-flash',
            provider: 'lovable-gateway',
            status: evoResp.status,
            endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
            error: errText.slice(0, 500),
            functionName: 'process-welcome-test',
          });
        }
      }
    } catch (evoErr) {
      console.error('[process-welcome-test] Error generating evolution_summary:', evoErr);
    }

    // --- Learning Path Score calculation (deterministic, no AI needed) ---
    let learningPathResult: any = null;
    try {
      learningPathResult = calculateLearningPathScore(traits, answers, questions);
      console.log(`[process-welcome-test] Learning Path Score: ${learningPathResult.score} (${learningPathResult.path}), overrides: ${learningPathResult.overrides_applied.join(', ') || 'none'}`);

      // Save to raw_answers in learning profile
      const existingRaw = answers || {};
      existingRaw.learning_path = learningPathResult;
      await supabase
        .from('student_learning_profiles')
        .update({ raw_answers: existingRaw })
        .eq('student_id', student_id)
        .eq('teacher_id', teacher_id);
    } catch (lpError) {
      console.error('[process-welcome-test] Error calculating Learning Path Score:', lpError);
    }

    // v6.9.50 — final auto-apply + promotion pass. Re-runs the helper after the
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
