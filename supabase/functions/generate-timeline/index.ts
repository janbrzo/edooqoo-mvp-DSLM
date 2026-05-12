/**
 * generate-timeline — DSLM Pathway v4
 * Two modes:
 *  - 'next_steps' (default): generate immediate next worksheets (1-3) with V/G focus per exercise
 *  - 'phase_steps': generate worksheets for a specific curriculum phase (uses phase title/desc/focus_areas)
 * Supports teacherComment and excludeIds for guided regeneration / "generate more".
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ALL_EXERCISE_IDS } from "../_shared/exerciseTaxonomy.ts";
import {
  computePacingIndex,
  pacingLabel,
  buildScientificPrinciplesBlock,
  buildStudentProfileBlock,
  buildWeakAreasBlock,
  buildKnowledgeBlock,
  buildWorksheetHistoryBlock,
  buildGoalsBlock,
  buildExistingStepsBlock,
  getAdaptiveExerciseRules,
} from "../_shared/dslmPromptCore.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_EXERCISES = ALL_EXERCISE_IDS;

const FOCUS_VALUES = ['vocabulary', 'grammar', 'none'] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      studentId,
      teacherId,
      mode = 'next_steps',
      count: rawCount,
      phaseId = null,
      teacherComment = '',
      excludeIds = [],
    } = body;

    if (!studentId || !teacherId) {
      return new Response(
        JSON.stringify({ error: 'Missing studentId or teacherId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const count = Math.min(6, Math.max(1, Number.isInteger(rawCount) ? rawCount : 3));
    const finalMode: 'next_steps' | 'phase_steps' = mode === 'phase_steps' ? 'phase_steps' : 'next_steps';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch context
    const [studentRes, metricsRes, knowledgeRes, goalsRes, worksheetsRes, phaseRes, excludeRes, existingStepsRes] = await Promise.all([
      supabase.from('students').select('name, english_level, main_goal, main_goal_target_date, dslm_pacing_mode, dslm_use_roadmap').eq('id', studentId).eq('teacher_id', teacherId).single(),
      supabase.from('student_skill_metrics').select('skill_name, skill_category, micro_skill, current_mastery, trend, updated_at')
        .eq('student_id', studentId).eq('teacher_id', teacherId).order('current_mastery', { ascending: true }).limit(60),
      supabase.from('student_knowledge_entries').select('content, category, created_at')
        .eq('student_id', studentId).eq('teacher_id', teacherId).is('deleted_at', null).is('is_outdated', false)
        .order('created_at', { ascending: false }).limit(15),
      supabase.from('student_progress_goals').select('title, description, goal_type, is_achieved, target_date')
        .eq('student_id', studentId).eq('teacher_id', teacherId).is('deleted_at', null).eq('is_achieved', false),
      supabase.from('worksheets').select('topic, created_at').eq('student_id', studentId).eq('teacher_id', teacherId)
        .order('created_at', { ascending: false }).limit(10),
      finalMode === 'phase_steps' && phaseId
        ? supabase.from('dslm_curriculum_phases').select('id, title, description, focus_areas').eq('id', phaseId).single()
        : Promise.resolve({ data: null }),
      excludeIds.length > 0
        ? supabase.from('future_worksheet_suggestions').select('suggested_topic').in('id', excludeIds)
        : Promise.resolve({ data: [] }),
      supabase.from('future_worksheet_suggestions')
        .select('suggested_topic, suggested_grammar_focus, sequence_number, phase_id')
        .eq('student_id', studentId).eq('teacher_id', teacherId)
        .is('deleted_at', null).eq('is_used', false)
        .order('sequence_number', { ascending: true }).limit(20),
    ]);

    const student = studentRes.data;
    if (!student) {
      return new Response(JSON.stringify({ error: 'Student not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const metrics = metricsRes.data || [];
    const knowledge = knowledgeRes.data || [];
    const goals = goalsRes.data || [];
    const recentWorksheets = worksheetsRes.data || [];
    const phase: any = (phaseRes as any).data || null;
    const excludedTopics = ((excludeRes as any).data || [])
      .map((r: any) => r.suggested_topic).filter(Boolean).join(', ');
    const existingSteps = ((existingStepsRes as any)?.data) || [];

    // Compute weeks until deadline for pacing
    let weeksUntilDeadline: number | null = null;
    if ((student as any).main_goal_target_date) {
      const target = new Date((student as any).main_goal_target_date).getTime();
      const days = Math.max(0, Math.round((target - Date.now()) / 86400000));
      weeksUntilDeadline = Math.max(1, Math.round(days / 7));
    }

    const pacing = computePacingIndex(student as any, weeksUntilDeadline);
    const pLabel = pacingLabel(pacing);

    const scientificFramework = buildScientificPrinciplesBlock((student as any).english_level, pacing);
    const studentProfile = buildStudentProfileBlock(student as any, pacing);
    const weakBlock = buildWeakAreasBlock(metrics, 10);
    const knowledgeBlock = buildKnowledgeBlock(knowledge, 8);
    const goalsBlock = buildGoalsBlock(goals);
    const worksheetHistory = buildWorksheetHistoryBlock(recentWorksheets, 10);
    const existingStepsBlock = buildExistingStepsBlock(existingSteps, 20);
    const exerciseRules = getAdaptiveExerciseRules(pacing);

    const mainDeadline = (student as any).main_goal_target_date
      ? `\n- Main Goal Deadline: ${(student as any).main_goal_target_date} (~${weeksUntilDeadline} weeks away)` : '';

    // Build mode-specific prompt
    let modeBrief = '';
    if (finalMode === 'phase_steps' && phase) {
      modeBrief = `MODE: PHASE-BOUND WORKSHEETS for phase "${phase.title}".
Phase description: ${phase.description || '(none)'}.
Phase focus areas: [${(phase.focus_areas || []).join(', ')}].
These are LESSON-LEVEL steps WITHIN this phase — do NOT introduce unrelated topics.`;
    } else {
      modeBrief = `MODE: IMMEDIATE NEXT STEPS.
These are the most urgent ${count} concrete worksheets to assign THIS WEEK or NEXT.
They are NOT macro phases — they are concrete lesson plans for the very near term.`;
    }

    const LESSON_EXERCISE_COUNT = 8;

    const prompt = `You are an expert ESL curriculum planner using DSLM (Dynamic Student Learning Model).

${scientificFramework}

${modeBrief}

${studentProfile}${mainDeadline}

ACTIVE PENDING STEPS already queued for this student (do NOT duplicate, build COMPLEMENTARILY):
${existingStepsBlock}

COMPLEMENTARITY RULE: New steps must EXTEND this queue logically — fill skill gaps not yet addressed, or apply spaced practice to weak skills last touched ≥2 steps ago. NEVER repeat a topic already in the queue.

WEAK AREAS (recency-weighted — RECENT SIGNALS CARRY MORE AUTHORITY):
  ${weakBlock}

RECENCY RULE: Skill metrics updated within the last 7 days are AUTHORITATIVE. Signals older than 30 days are STALE — treat as hypotheses to verify, not facts.

GOALS (deadline-pressured ones determine pacing):
${goalsBlock}

CONTEXT NOTES (most recent first — newer notes override older):
  ${knowledgeBlock}

RECENT WORKSHEET TOPICS (do NOT repeat): ${worksheetHistory}
${excludedTopics ? `\nADDITIONALLY AVOID: ${excludedTopics}` : ''}
${teacherComment ? `\nTEACHER COMMENT (apply this guidance): "${teacherComment}"` : ''}

EXERCISE COMPOSITION RULE: ${exerciseRules}

PACING RULES:
- Goals with [DEADLINE: ...] must be addressed BEFORE that date. Distribute steps targeting that goal proportionally across the available weeks.
- The Main Goal Deadline (if any) is the hard limit for the whole roadmap.
- Pacing mode ${pacing}/100 (${pLabel}) shapes how aggressively to front-load output vs build foundation.

TBLT TITLE RULE: 'topic' is a real adult task, not a grammar label.
  WRONG: "Past Simple Practice"   RIGHT: "Reporting Last Sprint's Outcomes to Stakeholders"

Return EXACTLY ${count} suggestions. NO MORE, NO LESS. The tool call schema enforces minItems=maxItems=${count}. Each suggestion must include:
- topic (TBLT-style adult task), goal (outcome the student can perform after), additionalInfo, grammarFocus
- exercises: array of EXACTLY ${LESSON_EXERCISE_COUNT} exercise types from this list ONLY: ${VALID_EXERCISES.join(', ')}
- exerciseFocusMap: object mapping each exercise type to "vocabulary" | "grammar" | "none" (one entry PER exercise)

MEDIA FAMILY RULE: each suggestion may use AT MOST ONE media family — picture-* OR audio-* OR none. Never mix picture and audio in the same step.

FOCUS DISTRIBUTION RULE: do NOT mark all exercises as "none". When grammarFocus is set, at least 2 exercises must be tagged "grammar". At least 2 exercises must be tagged "vocabulary". Remaining may be "none".
- rationale (cite student data: weak skill, deadline, complementarity), focusSkills, difficulty (CEFR level), estimatedImpact

Adult/professional tone. No school-like content. CLT anchoring mandatory.`;

    // Tool calling for reliable JSON
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert ESL curriculum planner. Use the generate_suggestions tool to return suggestions.' },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_suggestions',
            description: 'Return worksheet suggestions',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      topic: { type: 'string' },
                      goal: { type: 'string' },
                      additionalInfo: { type: 'string' },
                      grammarFocus: { type: 'string' },
                      exercises: { type: 'array', items: { type: 'string', enum: VALID_EXERCISES }, minItems: 8, maxItems: 8 },
                      exerciseFocusMap: {
                        type: 'object',
                        additionalProperties: { type: 'string', enum: FOCUS_VALUES as unknown as string[] }
                      },
                      rationale: { type: 'string' },
                      focusSkills: { type: 'array', items: { type: 'string' } },
                      difficulty: { type: 'string' },
                      estimatedImpact: { type: 'object', additionalProperties: { type: 'string' } },
                    },
                    required: ['topic', 'exercises']
                  },
                  minItems: count,
                  maxItems: count,
                }
              },
              required: ['suggestions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_suggestions' } },
        temperature: 0.85,
        // v6.9.15a — scale token budget with requested count to avoid truncation (was hardcoded 3500).
        max_tokens: Math.min(8192, 1800 + 2000 * count)
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'AI Gateway error',
          status: aiResponse.status,
          detail: errorText.slice(0, 500),
          count,
          mode: finalMode,
          suggestions: [],
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const finishReason = aiData.choices?.[0]?.finish_reason;
    let suggestions: any[] = [];
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
      } else {
        // Fallback: try parsing content
        const content = aiData.choices?.[0]?.message?.content || '[]';
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
      }
    } catch (e) {
      console.error('Failed to parse AI response', { finishReason, error: String(e) });
      suggestions = [];
    }

    // Sanitize: enforce exactly 8 exercises per suggestion (defense in depth)
    const TARGET_EX_COUNT = 8;
    suggestions = suggestions.map((s: any) => {
      let exercises: string[] = (s.exercises || []).filter((ex: string) => VALID_EXERCISES.includes(ex));
      // Pad to TARGET_EX_COUNT with safe defaults from NO_MEDIA pool
      const NO_MEDIA_DEFAULTS = ['reading','fill-in-blanks','multiple-choice','true-false','matching','dialogue','answer-questions','discussion'];
      if (exercises.length < TARGET_EX_COUNT) {
        for (const fallback of NO_MEDIA_DEFAULTS) {
          if (exercises.length >= TARGET_EX_COUNT) break;
          if (!exercises.includes(fallback)) exercises.push(fallback);
        }
      }
      if (exercises.length > TARGET_EX_COUNT) exercises = exercises.slice(0, TARGET_EX_COUNT);

      const rawMap = (s.exerciseFocusMap && typeof s.exerciseFocusMap === 'object') ? s.exerciseFocusMap : {};
      const exerciseFocusMap: Record<string, string> = {};
      // Heuristic fallback to assign focus when AI omitted or returned all-none
      const VOCAB_PREF = new Set(['reading','matching','matching-halves','synonyms','antonyms','categorize','odd-one-out','complete-word','negative-prefixes','listening-comprehension','answer-questions-audio','describe-picture','answer-questions-picture']);
      const GRAMMAR_PREF = new Set(['fill-in-blanks','fill-in-blanks-audio','word-order','error-correction','gap-text','paraphrasing','multiple-choice','true-false','multiple-choice-picture','true-false-picture','multiple-choice-audio','true-false-audio']);
      for (const ex of exercises) {
        const v = rawMap[ex];
        if (FOCUS_VALUES.includes(v)) exerciseFocusMap[ex] = v;
        else exerciseFocusMap[ex] = 'none';
      }
      // Enforce minima: ≥2 vocabulary, ≥2 grammar (if grammarFocus present, otherwise ≥2 vocab + ≥1 grammar)
      const hasGrammarFocus = !!(s.grammarFocus && String(s.grammarFocus).trim().length > 0);
      const minGrammar = hasGrammarFocus ? 2 : 1;
      const countTag = (tag: string) => exercises.filter(e => exerciseFocusMap[e] === tag).length;
      // Promote 'none' to vocabulary
      for (const ex of exercises) {
        if (countTag('vocabulary') >= 2) break;
        if (exerciseFocusMap[ex] === 'none' && VOCAB_PREF.has(ex)) exerciseFocusMap[ex] = 'vocabulary';
      }
      for (const ex of exercises) {
        if (countTag('vocabulary') >= 2) break;
        if (exerciseFocusMap[ex] === 'none') exerciseFocusMap[ex] = 'vocabulary';
      }
      // Promote 'none' to grammar
      for (const ex of exercises) {
        if (countTag('grammar') >= minGrammar) break;
        if (exerciseFocusMap[ex] === 'none' && GRAMMAR_PREF.has(ex)) exerciseFocusMap[ex] = 'grammar';
      }
      for (const ex of exercises) {
        if (countTag('grammar') >= minGrammar) break;
        if (exerciseFocusMap[ex] === 'none') exerciseFocusMap[ex] = 'grammar';
      }
      // Enforce single media family — drop minority, refill with no-media defaults
      const PIC = ['describe-picture','answer-questions-picture','true-false-picture','multiple-choice-picture'];
      const AUD = ['listening-comprehension','answer-questions-audio','true-false-audio','multiple-choice-audio','fill-in-blanks-audio'];
      const picCount = exercises.filter(e => PIC.includes(e)).length;
      const audCount = exercises.filter(e => AUD.includes(e)).length;
      if (picCount > 0 && audCount > 0) {
        const dropFamily = picCount >= audCount ? AUD : PIC;
        exercises = exercises.filter(e => !dropFamily.includes(e));
        const refill = NO_MEDIA_DEFAULTS.filter(d => !exercises.includes(d));
        while (exercises.length < TARGET_EX_COUNT && refill.length) {
          const x = refill.shift()!;
          exercises.push(x);
          if (!exerciseFocusMap[x]) exerciseFocusMap[x] = 'none';
        }
        // Re-prune focus map
        for (const k of Object.keys(exerciseFocusMap)) {
          if (!exercises.includes(k)) delete exerciseFocusMap[k];
        }
      }
      return {
        topic: String(s.topic || '').slice(0, 200),
        goal: s.goal ? String(s.goal).slice(0, 500) : null,
        additionalInfo: s.additionalInfo ? String(s.additionalInfo).slice(0, 600) : null,
        grammarFocus: s.grammarFocus ? String(s.grammarFocus).slice(0, 300) : null,
        exercises,
        exerciseFocusMap,
        rationale: s.rationale ? String(s.rationale).slice(0, 600) : null,
        focusSkills: Array.isArray(s.focusSkills) ? s.focusSkills.map(String).slice(0, 8) : [],
        difficulty: s.difficulty || student.english_level,
        estimatedImpact: (s.estimatedImpact && typeof s.estimatedImpact === 'object') ? s.estimatedImpact : {}
      };
    }).filter((s: any) => s.topic.trim().length > 0);

    // Hard-cap to requested count (defense in depth)
    if (suggestions.length > count) suggestions = suggestions.slice(0, count);

    const generationContext = {
      mode: finalMode,
      count: suggestions.length,
      phase_id: phaseId,
      teacher_comment: teacherComment || null,
      pacing_index: pacing,
      pacing_label: pLabel,
      weeks_until_deadline: weeksUntilDeadline,
      existing_steps_count: existingSteps.length,
      metrics_count: metrics.length,
      goals_count: goals.length,
      knowledge_count: knowledge.length,
      generated_at: new Date().toISOString(),
    };

    console.log('generate-timeline:', finalMode, 'returned', suggestions.length, 'suggestions');

    return new Response(
      JSON.stringify({ suggestions, generationContext, mode: finalMode, phaseId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-timeline:', error);
    return new Response(
      JSON.stringify({ error: error.message, suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
