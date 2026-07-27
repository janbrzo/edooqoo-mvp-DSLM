// Smart exercise selection via direct Gemini/OpenAI provider helper.
// Returns { exercises: string[], focusMap: Record<string,'vocabulary'|'grammar'> }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatCompletion } from "../_shared/aiChat.ts";
import {
  NO_MEDIA_EXERCISE_IDS,
  PICTURE_EXERCISE_IDS,
  AUDIO_EXERCISE_IDS,
} from "../_shared/exerciseTaxonomy.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      lessonTopic = '',
      lessonGoal = '',
      grammarFocus = '',
      teachingPreferences = '',
      additionalInformation = '',
      englishLevel = 'B1/B2',
      lessonTime = '60min',
      selectedMediaTypes = [] as string[],
      // v4.7: 'auto' = let AI decide picture/audio based on topic; 'forced' = honour selectedMediaTypes; 'none' = no media.
      mediaPreference = 'forced',
    } = body || {};

    const exerciseCount = lessonTime === '45min' ? 6 : 8;
    const hasPicture = selectedMediaTypes.includes('picture');
    const hasAudio = selectedMediaTypes.includes('audio');
    const isAuto = mediaPreference === 'auto' && !hasPicture && !hasAudio;

    const allowed = isAuto
      ? [...NO_MEDIA_EXERCISE_IDS, ...PICTURE_EXERCISE_IDS, ...AUDIO_EXERCISE_IDS]
      : [
          ...NO_MEDIA_EXERCISE_IDS,
          ...(hasPicture ? PICTURE_EXERCISE_IDS : []),
          ...(hasAudio ? AUDIO_EXERCISE_IDS : []),
        ];

    const hasDirectAiProvider = Boolean(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('OPENAI_API_KEY'));
    if (!hasDirectAiProvider) throw new Error('AI provider not configured: GEMINI_API_KEY or OPENAI_API_KEY required');

    // v6.6 (2026-04-27) A/B: explicit DSLM context block prepended to recover Pro-level targeting at Flash cost.
    // Frontend currently does not pass per-student weak-skill metrics (would require studentId plumbing); we instead
    // inject the DSLM REASONING FRAME so the model interprets topic/goal/grammar through the DSLM lens
    // (skill mastery × Bloom level × pacing mode) rather than as a generic ESL lesson outline.
    const systemMsg = `You are an expert ESL curriculum designer working inside Edooqoo's Dynamic Student Learning Model (DSLM).

DSLM REASONING FRAME (apply this before picking exercises):
1. Skill axis — Every adult ESL exercise trains one of: vocabulary acquisition, grammar accuracy, listening comprehension, reading comprehension, productive speaking, productive writing, pragmatic/discourse competence. Map the lesson topic + goal + grammar focus to the 2-3 PRIMARY skills the lesson must move forward.
2. Bloom axis — Sequence from REMEMBER → UNDERSTAND → APPLY → ANALYZE → CREATE. A balanced 1-on-1 adult lesson covers at least 3 Bloom levels and ENDS in production (APPLY or higher).
3. Pacing axis — Adult learners need RECYCLING (revisit prior forms) + CHALLENGE (1 step beyond comfort). Avoid stacking 3+ low-Bloom drill exercises in a row.
4. Targeting — Treat lessonTopic + lessonGoal as the student's CURRENT learning need. The exercise mix must visibly serve THAT goal — a generic "always reading + fill-in-blanks + MCQ + T/F" template is a FAILURE.

Pick the best ${exerciseCount} exercises from the allowed list for the lesson described below.

DIVERSITY RULE (critical): Do NOT default to the first ${exerciseCount} items in the list. Vary your choice based on lesson topic, goal, level, and grammar focus. Different lessons should yield different exercise mixes.

Pedagogical sequencing: Prefer a logical progression (warm-up → controlled practice → freer practice → production). Mix receptive (reading/listening) with productive (discussion/dialogue/answer-questions) and form-focused (fill-in-blanks/error-correction) exercises so the lesson feels balanced and finishes in production.

For EACH chosen exercise, decide whether its primary focus should be "vocabulary", "grammar", or "none". Use "grammar" only if a grammar point was provided or strongly implied. Do NOT mark all exercises as "none". When a grammar focus exists, at least 2 exercises must be tagged "grammar". At least 2 exercises must be tagged "vocabulary".

Return ONLY a JSON object via the tool call.`;

    const autoMediaBlock = isAuto ? `

AUTO MEDIA MODE — IMPORTANT BIAS (v4.8):
The teacher did not pre-select audio or picture. Adult ESL lessons benefit from visual/audio anchors in MOST cases. Bias STRONGLY toward including media.
- DEFAULT (most common, ~60% of topics): include 1-2 PICTURE exercises (e.g., describe-picture, answer-questions-picture, multiple-choice-picture, true-false-picture). Pictures help visualise scenarios — appropriate for almost any topic involving people, places, objects, situations, professions, hobbies, daily life, travel, business, medicine, food, sports.
- AUDIO instead of picture (~25% of topics): when topic explicitly involves listening (podcasts, conversations, interviews, music, news, accents, pronunciation, phone calls, dictation). Include 1-2 audio exercises (listening-comprehension, answer-questions-audio, fill-in-blanks-audio, multiple-choice-audio, true-false-audio).
- NO MEDIA (rare, ~15%): ONLY when topic is purely abstract grammar mechanics (e.g., "subject-verb agreement drill", "modal verbs review") or formal academic writing with no real-world scenario.
- NEVER mix picture and audio in the same selection.
- Do NOT default to no-media for normal everyday topics like "Visiting a doctor", "Job interview", "Ordering food", "Workplace meeting" — these benefit from pictures.` : '';

    const userMsg = `LESSON TOPIC: ${lessonTopic || '(not specified)'}
LESSON GOAL: ${lessonGoal || '(not specified)'}
GRAMMAR FOCUS: ${grammarFocus || '(none)'}
TEACHING PREFERENCES: ${teachingPreferences || '(none)'}
ADDITIONAL INFO: ${additionalInformation || '(none)'}
LEVEL: ${englishLevel}
DURATION: ${lessonTime}
MEDIA: picture=${hasPicture}, audio=${hasAudio}, mode=${isAuto ? 'auto' : 'forced'}
ALLOWED EXERCISES (pick exactly ${exerciseCount}, no duplicates): ${allowed.join(', ')}
${hasPicture ? 'Include 2 picture exercises.' : ''}
${hasAudio ? 'Include 2 audio exercises.' : ''}${autoMediaBlock}`;

    const aiResp = await chatCompletion({
      messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
      tools: [{
          type: 'function',
          function: {
            name: 'select_exercises',
            description: 'Selected exercises with focus tags',
            parameters: {
              type: 'object',
              properties: {
                exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', enum: allowed },
                      focus: { type: 'string', enum: ['vocabulary', 'grammar', 'none'] },
                    },
                    required: ['id', 'focus'],
                    additionalProperties: false,
                  },
                  minItems: exerciseCount,
                  maxItems: exerciseCount,
                },
              },
              required: ['exercises'],
              additionalProperties: false,
            },
          },
        }],
      tool_choice: { type: 'function', function: { name: 'select_exercises' } },
      temperature: 0.85,
    }, { primaryModel: 'google/gemini-2.5-flash', functionName: 'suggest-exercises' });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits in Workspace Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await aiResp.text();
      console.error('AI provider error', aiResp.status, t);
      throw new Error(`AI provider ${aiResp.status}`);
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { exercises: [] };

    const seen = new Set<string>();
    const exercises: string[] = [];
    const focusMap: Record<string, 'vocabulary' | 'grammar' | 'none'> = {};
    const filteredOut: string[] = [];
    for (const e of args.exercises || []) {
      if (!allowed.includes(e.id)) {
        filteredOut.push(e.id);
        continue;
      }
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      exercises.push(e.id);
      if (e.focus === 'vocabulary' || e.focus === 'grammar' || e.focus === 'none') focusMap[e.id] = e.focus;
      else focusMap[e.id] = 'none';
    }
    if (filteredOut.length) {
      console.warn('suggest-exercises: filtered out unknown ids:', filteredOut);
    }

    // Pad if AI returned fewer than requested
    if (exercises.length < exerciseCount) {
      const fillers = NO_MEDIA_EXERCISE_IDS.filter(x => !seen.has(x));
      while (exercises.length < exerciseCount && fillers.length) {
        const x = fillers.shift()!;
        exercises.push(x);
        seen.add(x);
      }
    }

    // Hard cap to exact count
    const finalExercises = exercises.slice(0, exerciseCount);
    const finalFocus: Record<string, 'vocabulary' | 'grammar' | 'none'> = {};
    for (const id of finalExercises) {
      finalFocus[id] = focusMap[id] || 'none';
    }
    // Enforce minima: ≥2 vocabulary, ≥2 grammar (when grammarFocus present)
    const VOCAB_PREF = new Set(['reading','matching','matching-halves','synonyms','antonyms','categorize','odd-one-out','complete-word','negative-prefixes','listening-comprehension','answer-questions-audio','describe-picture','answer-questions-picture']);
    const GRAMMAR_PREF = new Set(['fill-in-blanks','fill-in-blanks-audio','word-order','error-correction','gap-text','paraphrasing','multiple-choice','true-false','multiple-choice-picture','true-false-picture','multiple-choice-audio','true-false-audio']);
    const hasGrammarFocus = !!(grammarFocus && String(grammarFocus).trim().length > 0);
    const minGrammar = hasGrammarFocus ? 2 : 1;
    const cnt = (tag: string) => finalExercises.filter(e => finalFocus[e] === tag).length;
    for (const ex of finalExercises) {
      if (cnt('vocabulary') >= 2) break;
      if (finalFocus[ex] === 'none' && VOCAB_PREF.has(ex)) finalFocus[ex] = 'vocabulary';
    }
    for (const ex of finalExercises) {
      if (cnt('vocabulary') >= 2) break;
      if (finalFocus[ex] === 'none') finalFocus[ex] = 'vocabulary';
    }
    for (const ex of finalExercises) {
      if (cnt('grammar') >= minGrammar) break;
      if (finalFocus[ex] === 'none' && GRAMMAR_PREF.has(ex)) finalFocus[ex] = 'grammar';
    }
    for (const ex of finalExercises) {
      if (cnt('grammar') >= minGrammar) break;
      if (finalFocus[ex] === 'none') finalFocus[ex] = 'grammar';
    }

    console.log('suggest-exercises: returning', finalExercises.length, 'exercises (target', exerciseCount, ')');

    // v4.7: derive recommendedMediaType from final picks so frontend can sync media tile.
    const PIC_SET = new Set(PICTURE_EXERCISE_IDS);
    const AUD_SET = new Set(AUDIO_EXERCISE_IDS);
    const picCount = finalExercises.filter(e => PIC_SET.has(e)).length;
    const audCount = finalExercises.filter(e => AUD_SET.has(e)).length;
    let recommendedMediaType: 'picture' | 'audio' | null = null;
    if (picCount > 0 && audCount === 0) recommendedMediaType = 'picture';
    else if (audCount > 0 && picCount === 0) recommendedMediaType = 'audio';

    return new Response(JSON.stringify({ exercises: finalExercises, focusMap: finalFocus, recommendedMediaType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('suggest-exercises error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
