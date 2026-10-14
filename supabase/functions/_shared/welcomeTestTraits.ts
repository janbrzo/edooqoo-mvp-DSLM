/**
 * Welcome Test trait reconstruction, shared by process-welcome-test and tests.
 * Pure (no Deno APIs).
 *
 * Each trait is the option index of one question mapped to a value. The option
 * strings must match src/data/welcomeTestQuestions.ts exactly (parity test:
 * src/lib/welcomeTest/__tests__/welcomeTestShared.test.ts).
 */

import { matchOptionIndex } from './welcomeTestOptionAliases.ts';

/**
 * Question id by question_index, the order of ALL_WELCOME_TEST_QUESTIONS.
 * student_test_questions stores only question_index; ids such as wt_q3b sit
 * between wt_q3 and wt_q4, so `wt_q${index + 1}` is wrong from index 3 on.
 */
export const WELCOME_TEST_QUESTION_IDS: readonly string[] = [
  'wt_q1', 'wt_q2', 'wt_q3', 'wt_q3b', 'wt_q3c', 'wt_q4', 'wt_q5', 'wt_q5b', 'wt_q5c', 'wt_q6',
  'wt_q7', 'wt_q7b', 'wt_q8', 'wt_q9', 'wt_q10', 'wt_q11', 'wt_q12', 'wt_q13', 'wt_q13b', 'wt_q13c',
  'wt_q14', 'wt_q15', 'wt_q16', 'wt_q17', 'wt_q17b', 'wt_q18', 'wt_q19', 'wt_q16s', 'wt_q18l', 'wt_q20',
  'wt_q21', 'wt_q22', 'wt_q23', 'wt_q24', 'wt_q25', 'wt_q26', 'wt_q27', 'wt_q28', 'wt_q29', 'wt_q30',
  'wt_q31', 'wt_q32', 'wt_q33', 'wt_q34', 'wt_q35', 'wt_q36', 'wt_q36s', 'wt_q37', 'wt_q38', 'wt_q39',
  'wt_q40', 'wt_q41', 'wt_q41b', 'wt_q41s', 'wt_q42', 'wt_q43', 'wt_q44', 'wt_q45',
];

/** Answers keyed by question id, rebuilt from stored rows (question_index + student_answer). */
export function answersFromQuestionRows(
  rows: ReadonlyArray<{ question_index?: number | null; student_answer?: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows || []) {
    const id = typeof r?.question_index === 'number' ? WELCOME_TEST_QUESTION_IDS[r.question_index] : undefined;
    if (id && r.student_answer !== null && r.student_answer !== undefined) out[id] = r.student_answer;
  }
  return out;
}

export const TRAIT_QUESTIONS: Record<string, { questionId: string; options: string[]; mapping: Record<string, string> }> = {
  self_assessed_level: {
    questionId: 'wt_q1',
    options: [
      'I can do basic things, like ordering food or asking for directions',
      'I can have simple talks about everyday topics, but harder ideas are tough',
      'I can talk about most topics, but I make grammar mistakes and miss some words',
      'I speak fluently most of the time, but I want to sound more natural',
      'I feel comfortable in English, but I want to master advanced or work language',
    ],
    mapping: { '0': 'A1-A2', '1': 'A2-B1', '2': 'B1-B2', '3': 'B2-C1', '4': 'C1-C2' },
  },
  motivation_type: {
    questionId: 'wt_q3',
    options: [
      'I need it for work: meetings, emails, presentations',
      'I am preparing for an exam (IELTS, Cambridge, etc.)',
      'I want to travel and talk freely',
      'I want to watch films and read books without subtitles',
      'I want to feel confident with English speakers',
      'I want a promotion that needs English',
      'I am moving to an English-speaking country',
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
      'I do not mind; that is how you learn',
      'I prefer not to, but I can handle it',
      'I feel shy, but I keep going',
      'I avoid speaking because I fear mistakes',
      'I get very frustrated with myself',
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
  // v5.4: 4 new behavioral traits
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
      "I already did it earlier; I don't leave things until the last minute",
    ],
    mapping: { '0': 'pragmatic', '1': 'high', '2': 'avoidant', '3': 'low', '4': 'proactive' },
  },
  plateau_response: {
    questionId: 'wt_q13c',
    options: [
      'Push harder: more hours, more material',
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
      'Correct me immediately: I want to know right away',
      'Take notes and tell me after I finish my thought',
      'Only correct serious mistakes, small ones discourage me',
      'Explain the rule every time I make a mistake',
      'Send me a written summary after the lesson',
    ],
    mapping: { '0': 'immediate', '1': 'delayed', '2': 'selective', '3': 'rule_based', '4': 'written_summary' },
  },
};

/**
 * Traits from the answers (option string -> mapped value), then the client's
 * detected_traits for any trait the answers do not resolve.
 */
export function reconstructTraits(
  answers: Record<string, unknown> | null | undefined,
  frontendTraits?: Record<string, unknown> | null,
): Record<string, string> {
  const traits: Record<string, string> = {};
  for (const [traitName, config] of Object.entries(TRAIT_QUESTIONS)) {
    const answerVal = answers?.[config.questionId];
    if (answerVal && typeof answerVal === 'string') {
      const optIdx = matchOptionIndex(config.questionId, config.options, answerVal);
      if (optIdx >= 0) {
        const mapped = config.mapping[String(optIdx)];
        if (mapped) traits[traitName] = mapped;
      }
    }
  }
  for (const [key, val] of Object.entries(frontendTraits || {})) {
    if (!traits[key] && typeof val === 'string' && val) traits[key] = val;
  }
  return traits;
}
