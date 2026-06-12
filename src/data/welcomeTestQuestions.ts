/**
 * Welcome Test Questions - 45 predefined questions across 7 sections
 * This is the FULL version (largest of 3 planned options)
 *
 * Plan v6.0 — Question Map (58 questions across 5 learning-design goals)
 * ────────────────────────────────────────────────────────────────────────
 * Goal A — Latent learning goal: q3, q3c, q17b, q41, q41b
 * Goal B — Skill diagnosis: q1, q16-q19, q16s, q18l, q20-q40 (skill items)
 * Goal C — Engagement / effort: q5, q5c, q9, q10, q13b, q43
 * Goal D — Learning Pacing profile: q4, q5b, q7, q13b, q13c, q14, q41b
 * Goal E — Teacher pedagogy hints: q7b, q8, q12, q13, q40, q42, q44, q45
 *
 * Triangulation rules (anti-social-desirability — applied in
 * supabase/functions/process-welcome-test/index.ts):
 *   - q3c (latent_goal) overrides q3 (motivation_type) on conflict
 *   - q5c (homework_commitment) overrides q5 (weekly_study_time) on conflict
 *   - q17b (career_english_importance) added as weight to learning_path scoring
 *   - Behavioral signals (q5b, q5c, q13b, q13c) weighted 2x over self-report
 */

import type { WelcomeTestQuestionDef, WelcomeTestSectionDef } from '@/types/welcomeTest';

// =====================================================
// SECTION 1: About You (Q1-Q8)
// =====================================================

const aboutYouQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q1',
    section: 'about_you',
    question_type: 'self_assessment',
    question_text: 'How would you describe your English right now?',
    description: 'Pick the option that fits you best today.',
    options: [
      'I can do basic things, like ordering food or asking for directions',
      'I can have simple talks about everyday topics, but harder ideas are tough',
      'I can talk about most topics, but I make grammar mistakes and miss some words',
      'I speak fluently most of the time, but I want to sound more natural',
      'I feel comfortable in English, but I want to master advanced or work language',
    ],
    scoring_logic: 'Self-awareness: compare with actual grammar/vocab scores to detect over/underestimation',
    detected_trait: {
      trait_name: 'self_assessed_level',
      mapping: {
        '0': 'A1-A2',
        '1': 'A2-B1',
        '2': 'B1-B2',
        '3': 'B2-C1',
        '4': 'C1-C2',
      },
    },
  },
  {
    id: 'wt_q2',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'When you speak English, what frustrates you the most?',
    description: 'Select all that apply.',
    multi_select: true,
    options: [
      'I know what I want to say but can\'t find the right words',
      'I make grammar mistakes that I know are wrong',
      'I can\'t understand native speakers when they talk fast',
      'I feel nervous and forget everything I know',
      'I can\'t express complex ideas - I simplify too much',
      'My pronunciation makes people ask me to repeat',
    ],
    scoring_logic: 'Identifies main barriers + emotional relationship with errors (fixed vs growth mindset signals)',
  },
  {
    id: 'wt_q3',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'What is your main reason for learning English?',
    options: [
      'I need it for work — meetings, emails, presentations',
      'I am preparing for an exam (IELTS, Cambridge, etc.)',
      'I want to travel and talk freely',
      'I want to watch films and read books without subtitles',
      'I want to feel confident with English speakers',
      'I want a promotion that needs English',
      'I am moving to an English-speaking country',
    ],
    scoring_logic: 'Motivation type: instrumental (work, exam) vs integrative (travel, movies, confidence)',
    detected_trait: {
      trait_name: 'motivation_type',
      mapping: {
        '0': 'instrumental',
        '1': 'instrumental',
        '2': 'integrative',
        '3': 'integrative',
        '4': 'integrative',
        '5': 'instrumental',
        '6': 'instrumental',
      },
    },
  },
  // Q3b: Usage context (Learning Path Signal - professional context)
  {
    id: 'wt_q3b',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'Where do you use (or want to use) English the most?',
    multi_select: true,
    max_selections: 2,
    options: [
      'At work - emails, meetings, calls',
      'Traveling - airports, hotels, restaurants',
      'Online - social media, forums, gaming',
      'With friends/family who speak English',
      'Consuming content - movies, books, podcasts',
      'In my professional field (medical, legal, IT, etc.)',
    ],
    scoring_logic: 'Usage context determines vocabulary domain, register priority, and skill balance. Work-heavy = formal register. Travel = survival phrases. Online = informal. Professional field = ESP.',
    detected_trait: {
      trait_name: 'usage_context',
      mapping: { '0': 'work_formal', '1': 'travel', '2': 'online_informal', '3': 'social', '4': 'content_consumption', '5': 'professional_field' },
    },
  },
  // Q3c: Latent goal — indirect triangulation (gap A1, social-desirability bypass)
  {
    id: 'wt_q3c',
    section: 'about_you',
    question_type: 'scenario_reaction',
    question_text: 'Imagine you wake up 2 years from now and your English is amazing. Which scenario would feel MOST satisfying?',
    description: 'Pick the one that genuinely feels most rewarding — not the one that sounds most impressive.',
    options: [
      'I confidently lead meetings with international clients',
      'I watch Netflix shows without subtitles, effortlessly',
      'I feel like a local when I travel anywhere in the world',
      'I got promoted to a position that requires English',
      'I read books in the original language for pleasure',
    ],
    scoring_logic: 'Indirect/projected goal. Reveals latent motivation when direct answers (Q3) are filtered by social desirability. AI weights this above Q3 when they conflict.',
    detected_trait: {
      trait_name: 'latent_goal',
      mapping: { '0': 'career_critical', '1': 'lifestyle', '2': 'travel_lifestyle', '3': 'career_critical', '4': 'lifestyle' },
    },
  },
  {
    id: 'wt_q4',
    section: 'about_you',
    question_type: 'scenario_reaction',
    question_text: 'How do you usually react when you don\'t understand something in English?',
    options: [
      'I ask the person to repeat or explain',
      'I pretend I understood and hope for the best',
      'I try to guess from context',
      'I get stressed and switch to my language',
      'I look it up immediately on my phone',
    ],
    scoring_logic: 'Tolerance of ambiguity (Ely, 1995) - key predictor of language learning success',
    detected_trait: {
      trait_name: 'ambiguity_tolerance',
      mapping: {
        '0': 'high',
        '1': 'low',
        '2': 'high',
        '3': 'low',
        '4': 'medium',
      },
    },
  },
  {
    id: 'wt_q5',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'How much time can you realistically spend on English per week (outside lessons)?',
    options: [
      'Almost none - I only have lesson time',
      '15-30 minutes a few times a week',
      'About 1 hour spread across the week',
      '2-3 hours - I\'m committed',
      'More than 3 hours - English is my priority',
    ],
    scoring_logic: 'Available time budget - directly affects strategy selection (spaced repetition intervals, homework load)',
    detected_trait: {
      trait_name: 'weekly_study_time',
      mapping: {
        '0': 'none',
        '1': '15_30_min',
        '2': '1_hour',
        '3': '2_3_hours',
        '4': '3_plus_hours',
      },
    },
  },
  // Q5b: Deadline response (Learning Path Signal - urgency behavior)
  {
    id: 'wt_q5b',
    section: 'about_you',
    question_type: 'scenario_reaction',
    question_text: 'Imagine this: your boss just told you that in 3 weeks, you\'ll need to lead a meeting in English with international clients. How do you react?',
    options: [
      'I\'d panic at first, but then prepare intensively every day until the meeting',
      'I\'d feel nervous but would ask a colleague for help and practice the key phrases',
      'I\'d ask to postpone or let someone else handle it',
      'I\'d feel fairly confident - I\'d just review some vocabulary beforehand',
    ],
    scoring_logic: 'Behavioral response to urgent deadline reveals stress tolerance and action orientation. Option 0 = intense preparation. Option 1 = pragmatic coping. Option 2 = avoidance. Option 3 = confident.',
    detected_trait: {
      trait_name: 'deadline_response',
      mapping: { '0': 'intense_preparation', '1': 'pragmatic_coping', '2': 'avoidance', '3': 'confident' },
    },
  },
  // Q5c: Homework commitment under low motivation (gap C1)
  {
    id: 'wt_q5c',
    section: 'about_you',
    question_type: 'scenario_reaction',
    question_text: "It's Wednesday evening. You had a tough day at work, and you have your English homework due tomorrow. What usually happens?",
    options: [
      'I do it quickly just to get it off my plate',
      'I do it carefully, even if it takes an hour',
      'I message the teacher that I didn\'t make it and will do it later',
      'I start it but stop after about 10 minutes',
      'I already did it earlier — I don\'t leave things until the last minute',
    ],
    scoring_logic: 'Real behavior under low-motivation pressure. Stronger predictor of homework completion than self-rated commitment.',
    detected_trait: {
      trait_name: 'homework_commitment',
      mapping: { '0': 'pragmatic', '1': 'high', '2': 'avoidant', '3': 'low', '4': 'proactive' },
    },
  },
  {
    id: 'wt_q6',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'Which learning activities do you enjoy? Pick all that apply.',
    multi_select: true,
    options: [
      'Watching videos or films in English',
      'Reading articles or books',
      'Having conversations',
      'Doing grammar exercises',
      'Learning new words with flashcards',
      'Listening to podcasts',
      'Writing texts (emails, stories)',
      'Playing language games or quizzes',
      'Singing English songs',
    ],
    scoring_logic: 'Preferred input channels (Visual/Auditory/Kinesthetic + Active/Passive). Krashen\'s Input Hypothesis.',
  },
  {
    id: 'wt_q7',
    section: 'about_you',
    question_type: 'self_assessment',
    question_text: 'How do you feel about making mistakes in English?',
    options: [
      'I do not mind — that is how you learn',
      'I prefer not to, but I can handle it',
      'I feel shy, but I keep going',
      'I avoid speaking because I fear mistakes',
      'I get very frustrated with myself',
    ],
    scoring_logic: 'Error anxiety level (Horwitz Foreign Language Anxiety Scale)',
    detected_trait: {
      trait_name: 'anxiety_level',
      mapping: {
        '0': 'low',
        '1': 'low',
        '2': 'medium',
        '3': 'high',
        '4': 'high',
      },
    },
  },
  // Q7b: Correction preference (gap E1 — how teacher should correct speech)
  {
    id: 'wt_q7b',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'When you make a mistake while speaking, how do you want your teacher to react?',
    options: [
      'Correct me immediately — I want to know right away',
      'Take notes and tell me after I finish my thought',
      'Only correct serious mistakes — small ones discourage me',
      'Explain the rule every time I make a mistake',
      'Send me a written summary after the lesson',
    ],
    scoring_logic: 'Correction preference during speech production. Drives teacher pedagogy + AI live-feedback timing.',
    detected_trait: {
      trait_name: 'correction_preference',
      mapping: { '0': 'immediate', '1': 'delayed', '2': 'selective', '3': 'rule_based', '4': 'written_summary' },
    },
  },
  {
    id: 'wt_q8',
    section: 'about_you',
    question_type: 'preference_choice',
    question_text: 'When you learn a new word, what helps you remember it best?',
    options: [
      'Seeing it written down with a definition',
      'Hearing it in a sentence',
      'Using it in my own sentence right away',
      'Connecting it to a picture or image',
      'Repeating it many times',
      'Understanding the word parts (prefix, root, suffix)',
    ],
    scoring_logic: 'Dominant memory encoding strategy (Dual Coding Theory, Paivio)',
    detected_trait: {
      trait_name: 'preferred_input_channel',
      mapping: {
        '0': 'visual',
        '1': 'auditory',
        '2': 'kinesthetic',
        '3': 'visual',
        '4': 'auditory',
        '5': 'visual',
      },
    },
  },
];

// =====================================================
// SECTION 2: Your English Experience (Q9-Q13)
// =====================================================

const experienceQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q9',
    section: 'experience',
    question_type: 'preference_choice',
    question_text: 'How long have you been learning English?',
    options: [
      'Less than 1 year',
      '1-3 years',
      '3-5 years',
      '5-10 years',
      'More than 10 years',
    ],
    scoring_logic: 'Learning duration context - longer learners may have fossilized errors',
  },
  {
    id: 'wt_q10',
    section: 'experience',
    question_type: 'preference_choice',
    question_text: 'Where have you mainly learned English so far?',
    description: 'Select all that apply.',
    multi_select: true,
    options: [
      'School (as a subject)',
      'University',
      'Private lessons with a teacher',
      'Language school/course',
      'Self-study (apps, books, YouTube)',
      'Living/working in an English-speaking country',
      'Through work (using English daily)',
    ],
    scoring_logic: 'Learning context affects fossilized errors - YouTube self-learner vs Cambridge course student have different patterns',
  },
  {
    id: 'wt_q11',
    section: 'experience',
    question_type: 'preference_choice',
    question_text: 'Have you ever taken an official English exam?',
    options: [
      'No, never',
      'Yes - school/university exam',
      'Yes - Cambridge (FCE/CAE/CPE)',
      'Yes - IELTS',
      'Yes - TOEFL',
      'Yes - other',
    ],
    scoring_logic: 'Exam experience indicates familiarity with structured assessment and formal English',
  },
  {
    id: 'wt_q12',
    section: 'experience',
    question_type: 'open_reflection',
    question_text: 'What\'s the biggest challenge you\'ve faced learning English?',
    description: 'In 1-2 sentences, describe your biggest frustration or challenge with English.',
    scoring_logic: 'Narrative self-assessment. Sentiment analysis + keywords reveal emotional relationship with learning.',
  },
  {
    id: 'wt_q13',
    section: 'experience',
    question_type: 'open_reflection',
    question_text: 'Is there anything specific your previous teachers did that worked really well for you?',
    description: 'Tell us what methods or approaches helped you learn best.',
    scoring_logic: 'What worked before = what will likely work again. Practical pedagogical intelligence.',
  },
  // Q13b: Persistence/Grit (Learning Path Signal - behavioral transfer)
  {
    id: 'wt_q13b',
    section: 'experience',
    question_type: 'scenario_reaction',
    question_text: 'Think about the last time you tried to learn something new (not English - anything: cooking, a sport, a skill). What happened?',
    options: [
      'I stuck with it and got pretty good at it',
      'I practiced for a while but eventually moved on to something else',
      'I started enthusiastically but lost motivation after a few weeks',
      'I\'m still learning it - I haven\'t given up yet',
    ],
    scoring_logic: 'Transfer of persistence patterns from other domains (Duckworth Grit Scale proxy). Measures actual behavior, not self-image. Option 0 = high grit. Option 1 = medium. Option 2 = low. Option 3 = high (ongoing).',
    detected_trait: {
      trait_name: 'persistence_level',
      mapping: { '0': 'high', '1': 'medium', '2': 'low', '3': 'high' },
    },
  },
  // Q13c: Plateau response — CRITICAL for Pacing (gap D1, B1-B2 wall behavior)
  {
    id: 'wt_q13c',
    section: 'experience',
    question_type: 'scenario_reaction',
    question_text: "You've been studying English for 6 months and you feel like you're not improving. What do you do?",
    options: [
      'Push harder — more hours, more material',
      'Change the method, teacher, or approach',
      'Take a break for a week or two',
      'Accept the plateau as part of the process and keep going',
      'Start to doubt whether this is really for me',
    ],
    scoring_logic: 'Plateau-response pattern. Direct input to Pacing Path scoring: doubt_prone → comfort, intensity_response+high_persistence → accelerated, adaptive → guided, resilient+intense_prep → target.',
    detected_trait: {
      trait_name: 'plateau_response',
      mapping: { '0': 'intensity_response', '1': 'adaptive', '2': 'rest_response', '3': 'resilient', '4': 'doubt_prone' },
    },
  },
];

// =====================================================
// SECTION 3: Real-Life Scenarios (Q14-Q19)
// =====================================================

const scenarioQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q14',
    section: 'scenarios',
    question_type: 'scenario_reaction',
    question_text: 'You\'re at a coffee shop abroad. The barista asks you something you don\'t fully understand. What do you do?',
    options: [
      'I say "Sorry, could you repeat that please?" and try again',
      'I just point at the menu and smile',
      'I use Google Translate on my phone',
      'I answer with what I think they asked',
    ],
    scoring_logic: 'Communication strategy under pressure - active vs avoidant coping',
    detected_trait: {
      trait_name: 'error_attitude',
      mapping: {
        '0': 'comfortable',
        '1': 'avoidant',
        '2': 'cautious',
        '3': 'comfortable',
      },
    },
  },
  {
    id: 'wt_q15',
    section: 'scenarios',
    question_type: 'scenario_reaction',
    question_text: 'Your English-speaking colleague sends you a long email about a project. Some parts are unclear. What do you do?',
    options: [
      'I read it carefully, look up unknown words, and reply',
      'I reply asking them to clarify the confusing parts',
      'I understand most of it and guess the rest from context',
      'I struggle to understand and need to translate most of it',
      'I don\'t try to understand, I use ChatGPT',
    ],
    scoring_logic: 'Behavioral: reading comprehension strategy + self-reported coping. NOT a skill test — detects reading_strategy trait for Learning Path.',
    detected_trait: {
      trait_name: 'reading_strategy',
      mapping: {
        '0': 'careful_lookup',
        '1': 'clarification_seeker',
        '2': 'context_guesser',
        '3': 'struggles_translates',
        '4': 'avoids_uses_ai',
      },
    },
  },
  {
    id: 'wt_q16',
    section: 'scenarios',
    question_type: 'open_ended',
    question_text: 'You need to describe a problem with your hotel room to the reception.',
    description: 'Write 2-3 sentences explaining that your room\'s air conditioning isn\'t working and you\'d like it fixed or to change rooms.',
    element_type: 'writing',
    scoring_logic: 'Actual writing level - grammar accuracy, vocabulary range, pragmatic appropriateness. Compare with Q1 self-assessment.',
    nano_skill: 'ns.writing.complaint_register',
  },
  {
    id: 'wt_q17',
    section: 'scenarios',
    question_type: 'open_ended',
    question_text: 'You\'re in a job interview and they ask "Tell me about a challenge you\'ve faced at work." How would you answer?',
    description: 'Write 3-4 sentences as if you\'re actually in the interview.',
    element_type: 'writing',
    scoring_logic: 'Pragmatic competence + discourse management under pressure. Formal/informal register, coherence, complexity.',
    nano_skill: 'ns.writing.formal_narrative',
  },
  // Q17b: Career English importance (Learning Path Signal - goal weight)
  {
    id: 'wt_q17b',
    section: 'scenarios',
    question_type: 'scenario_reaction',
    question_text: 'You see a perfect job posting that matches your skills exactly, but it requires "fluent English." What goes through your mind?',
    options: [
      'This is exactly why I\'m learning English - I need to be ready for opportunities like this',
      'I\'d apply anyway and hope my English improves by the time they interview me',
      'I\'d skip it - I\'m not learning English for work reasons',
      'I\'d apply and highlight my other strengths to compensate for my English',
    ],
    scoring_logic: 'Reveals goal importance (career-critical?) and urgency (take action now?). Option 0 = critical. Option 1 = high. Option 2 = not career. Option 3 = moderate.',
    detected_trait: {
      trait_name: 'career_english_importance',
      mapping: { '0': 'critical', '1': 'high', '2': 'not_career', '3': 'moderate' },
    },
  },
  {
    id: 'wt_q18',
    section: 'scenarios',
    question_type: 'multiple_choice',
    question_text: 'Read this short dialogue and answer the question below.\n\nA: "Hi, I tried logging in this morning, but the system kept saying my password was wrong."\nB: "I see — and did you try the reset link?"\nA: "Yes, three times. The reset email never arrived, and now I am locked out completely."\nB: "Okay, that explains it. I will create a new account for you and migrate your old data this afternoon."\n\nWhat will B do to solve A\'s problem?',
    options: [
      'Send another password reset email',
      'Unlock the existing account',
      'Create a new account and move A\'s data',
      'Schedule a call with technical support',
    ],
    correct_answer: 'Create a new account and move A\'s data',
    element_type: 'reading',
    difficulty_level: 2,
    scoring_logic: 'Reading comprehension - extracting main idea. Difficulty level B1-B2.',
    nano_skill: 'ns.reading.identify_main_idea',
  },
  {
    id: 'wt_q19',
    section: 'scenarios',
    question_type: 'multiple_choice',
    question_text: 'Read this text and answer the question below:\n\n"According to a recent study, more than 60% of employees prefer a hybrid work model, combining remote and office work. Researchers found that this arrangement not only improves work-life balance but also increases productivity by up to 15%. However, managers report challenges in maintaining team cohesion and ensuring equal opportunities for career advancement among remote and in-office workers."\n\nWhat does the author suggest is the main benefit of hybrid work?',
    options: [
      'It saves companies money on office space',
      'It improves work-life balance and productivity',
      'It makes managers\' jobs easier',
      'It eliminates the need for offices',
    ],
    correct_answer: 'It improves work-life balance and productivity',
    element_type: 'reading',
    difficulty_level: 3,
    scoring_logic: 'Reading comprehension - inference, not just surface-level understanding. B2 level.',
    nano_skill: 'ns.reading.inference_from_text',
  },
  // NEW: Speaking question - describe hotel problem out loud
  {
    id: 'wt_q16s',
    section: 'scenarios',
    question_type: 'speaking_record',
    question_text: 'Describe a problem with your hotel room — speaking task.\n\nImagine you are at the reception. Pick one problem (broken AC, dirty bathroom, loud neighbours, missing towels) and record yourself explaining it and asking for help.',
    description: 'Record up to 60 seconds. Speak naturally — fluency and pronunciation matter more than perfect grammar.',
    element_type: 'speaking',
    max_recording_seconds: 60,
    scoring_logic: 'Speaking fluency, pronunciation, pragmatic appropriateness. Compare with written version (Q16).',
    nano_skill: 'ns.speaking.complaint_oral',
  },
  // NEW: Listening comprehension
  {
    id: 'wt_q18l',
    section: 'scenarios',
    question_type: 'listening_comprehension',
    question_text: 'Listen to the conversation and answer: when did the customer finally book a table?',
    audio_url: 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev/audio/welcome-test-listening-1771235244954.mp3',
    audio_transcript: 'A: "Hi, I would like to book a table for Saturday evening, around eight."\nB: "Let me check… Saturday at eight is fully booked. The earliest we have is nine thirty."\nA: "Hmm, that is a bit late. Do you have anything earlier on Friday?"\nB: "Yes, we have a table for two at seven on Friday."\nA: "Perfect, let us go with that."',
    options: [
      'Saturday at eight',
      'Saturday at nine thirty',
      'Friday at seven',
      'Friday at nine thirty',
    ],
    correct_answer: 'Friday at seven',
    element_type: 'listening',
    difficulty_level: 2,
    scoring_logic: 'Listening comprehension - detail extraction from dialogue. B1 level.',
    nano_skill: 'ns.listening.detail_extraction',
  },
];
// =====================================================

const grammarQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q20',
    section: 'grammar',
    question_type: 'fill_blank',
    question_text: 'She ___ (go) to the gym every morning.',
    description: 'Write the correct form of the verb in brackets.',
    correct_answer: 'goes',
    element_type: 'grammar',
    difficulty_level: 1,
    scoring_logic: 'Present Simple 3rd person -s. A2 level grammar.',
    nano_skill: 'ns.grammar.present_simple_third_person',
  },
  {
    id: 'wt_q21',
    section: 'grammar',
    question_type: 'fill_blank',
    question_text: 'I ___ (study) English for three years.',
    description: 'Write the correct form of the verb in brackets. The action started in the past and continues now.',
    correct_answer: ['have been studying', 'have studied'],
    element_type: 'grammar',
    difficulty_level: 3,
    scoring_logic: 'Present Perfect Continuous / Present Perfect. B1-B2 level.',
    nano_skill: 'ns.grammar.present_perfect_continuous',
  },
  {
    id: 'wt_q22',
    section: 'grammar',
    question_type: 'multiple_choice',
    question_text: 'If I ___ earlier, I wouldn\'t have missed the train.',
    description: 'Pick the correct form. This is an unreal situation about the past.',
    options: [
      'leave',
      'left',
      'had left',
      'would leave',
    ],
    correct_answer: 'had left',
    element_type: 'grammar',
    difficulty_level: 4,
    scoring_logic: 'Third Conditional. B2 level grammar.',
    nano_skill: 'ns.grammar.third_conditional',
  },
  {
    id: 'wt_q23',
    section: 'grammar',
    question_type: 'multiple_choice',
    question_text: 'The report ___ by the team last week.',
    options: [
      'wrote',
      'was written',
      'has written',
      'is written',
    ],
    correct_answer: 'was written',
    element_type: 'grammar',
    difficulty_level: 3,
    scoring_logic: 'Past Simple Passive. B1-B2 level.',
    nano_skill: 'ns.grammar.passive_voice_past',
  },
  {
    id: 'wt_q24',
    section: 'grammar',
    question_type: 'multiple_choice',
    question_text: 'Find the error: "She don\'t like coffee."',
    description: 'Choose the corrected version.',
    options: [
      'She doesn\'t like coffee.',
      'She didn\'t like coffee.',
      'She not like coffee.',
      'She isn\'t like coffee.',
    ],
    correct_answer: 'She doesn\'t like coffee.',
    element_type: 'grammar',
    difficulty_level: 1,
    scoring_logic: 'Error correction - 3rd person negative. A2 level.',
    nano_skill: 'ns.grammar.negative_third_person',
  },
  {
    id: 'wt_q25',
    section: 'grammar',
    question_type: 'multiple_choice',
    question_text: 'Find the error: "I have went to London last year."',
    description: 'Choose the corrected version.',
    options: [
      'I went to London last year.',
      'I have gone to London last year.',
      'I have been to London last year.',
      'I was went to London last year.',
    ],
    correct_answer: 'I went to London last year.',
    element_type: 'grammar',
    difficulty_level: 2,
    scoring_logic: 'Error correction - Past Simple vs Present Perfect. B1 level.',
    nano_skill: 'ns.grammar.past_simple_vs_present_perfect',
  },
  {
    id: 'wt_q26',
    section: 'grammar',
    question_type: 'fill_blank',
    question_text: '"It started raining two hours ago."\n\nComplete the sentence: It ___ for two hours.',
    description: 'Fill in the blank to rewrite the sentence using the correct tense. Write only the missing words.',
    correct_answer: 'has been raining',
    element_type: 'grammar',
    difficulty_level: 3,
    scoring_logic: 'Sentence transformation - Present Perfect Continuous. B1-B2 level.',
    nano_skill: 'ns.grammar.sentence_transformation_ppc',
  },
  {
    id: 'wt_q27',
    section: 'grammar',
    question_type: 'fill_blank',
    question_text: '"People say he is very smart."\n\nComplete the sentence: He ___ very smart.',
    description: 'Fill in the blank to rewrite using a passive construction. Write only the missing words.',
    correct_answer: 'is said to be',
    element_type: 'grammar',
    difficulty_level: 4,
    scoring_logic: 'Sentence transformation - Passive reporting. B2-C1 level.',
    nano_skill: 'ns.grammar.passive_reporting',
  },
];

// =====================================================
// SECTION 5: Vocabulary & Expressions (Q28-Q35)
// =====================================================

const vocabularyQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q28',
    section: 'vocabulary',
    question_type: 'multiple_choice',
    question_text: 'Can you ___ me a favour?',
    options: ['do', 'make', 'give', 'take'],
    correct_answer: 'do',
    element_type: 'vocabulary',
    difficulty_level: 2,
    scoring_logic: 'Collocation: do a favour. B1 level.',
    nano_skill: 'ns.vocabulary.collocation_do_make',
  },
  {
    id: 'wt_q29',
    section: 'vocabulary',
    question_type: 'multiple_choice',
    question_text: 'She ___ a deep breath before speaking.',
    options: ['took', 'made', 'did', 'got'],
    correct_answer: 'took',
    element_type: 'vocabulary',
    difficulty_level: 2,
    scoring_logic: 'Collocation: take a breath. B1 level.',
    nano_skill: 'ns.vocabulary.collocation_take',
  },
  {
    id: 'wt_q30',
    section: 'vocabulary',
    question_type: 'fill_blank',
    question_text: 'The ___ (decide) was made yesterday.',
    description: 'Write the correct NOUN form of the word in brackets. Example: "arrive" → "arrival".',
    correct_answer: 'decision',
    element_type: 'vocabulary',
    difficulty_level: 2,
    scoring_logic: 'Word formation: verb to noun. B1 level.',
    nano_skill: 'ns.vocabulary.word_formation_noun',
  },
  {
    id: 'wt_q31',
    section: 'vocabulary',
    question_type: 'fill_blank',
    question_text: 'He spoke very ___ (confident).',
    description: 'Write the correct form of the word in brackets.',
    correct_answer: 'confidently',
    element_type: 'vocabulary',
    difficulty_level: 2,
    scoring_logic: 'Word formation: adjective to adverb. B1 level.',
    nano_skill: 'ns.vocabulary.word_formation_adverb',
  },
  {
    id: 'wt_q32',
    section: 'vocabulary',
    question_type: 'multiple_choice',
    question_text: 'The deadline is really tight. We need to ___ up.',
    options: ['hurry', 'run', 'go', 'move'],
    correct_answer: 'hurry',
    element_type: 'vocabulary',
    difficulty_level: 2,
    scoring_logic: 'Contextual vocabulary: phrasal verb meaning. B1-B2 level.',
    nano_skill: 'ns.vocabulary.phrasal_verb_contextual',
  },
  {
    id: 'wt_q33',
    section: 'vocabulary',
    question_type: 'multiple_choice',
    question_text: 'She was absolutely ___ when she heard she got the job.',
    options: ['thrilled', 'sad', 'angry', 'bored'],
    correct_answer: 'thrilled',
    element_type: 'vocabulary',
    difficulty_level: 3,
    scoring_logic: 'Nuance understanding: extreme adjectives. B2 level.',
    nano_skill: 'ns.vocabulary.extreme_adjectives',
  },
  {
    id: 'wt_q34',
    section: 'vocabulary',
    question_type: 'multiple_choice',
    question_text: 'What does "break the ice" mean?',
    options: [
      'To damage something frozen',
      'To make people feel more comfortable in a social situation',
      'To start an argument',
      'To solve a difficult problem',
    ],
    correct_answer: 'To make people feel more comfortable in a social situation',
    element_type: 'vocabulary',
    difficulty_level: 3,
    scoring_logic: 'Idiom comprehension. B2 level.',
    nano_skill: 'ns.vocabulary.idiom_comprehension',
  },
  {
    id: 'wt_q35',
    section: 'vocabulary',
    question_type: 'multiple_choice',
    question_text: 'When she heard the price, she said "That costs ___!"',
    options: [
      'an arm and a leg',
      'a hand and a foot',
      'blood and sweat',
      'a king\'s crown',
    ],
    correct_answer: 'an arm and a leg',
    element_type: 'vocabulary',
    difficulty_level: 3,
    scoring_logic: 'Idiom production/recognition. B2 level.',
    nano_skill: 'ns.vocabulary.idiom_production',
  },
];

// =====================================================
// SECTION 6: Communication Style (Q36-Q40)
// =====================================================

const communicationQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q36',
    section: 'communication',
    question_type: 'open_ended',
    question_text: 'How would you politely decline an invitation to a colleague\'s party?',
    description: 'Write 1-2 sentences.',
    element_type: 'writing',
    scoring_logic: 'Pragmatic competence - ability to use language in social context. Register, politeness strategies.',
    nano_skill: 'ns.writing.pragmatic_declining',
  },
  // NEW: Speaking question - decline invitation out loud
  {
    id: 'wt_q36s',
    section: 'communication',
    question_type: 'speaking_record',
    question_text: 'Now record yourself declining the invitation verbally.\n\nImagine your colleague just invited you. Speak naturally as if you\'re talking to them.',
    description: 'Record up to 45 seconds. Be polite but clear.',
    element_type: 'speaking',
    max_recording_seconds: 45,
    scoring_logic: 'Speaking pragmatics - politeness strategies in real-time speech.',
    nano_skill: 'ns.speaking.pragmatic_declining_oral',
  },
  {
    id: 'wt_q37',
    section: 'communication',
    question_type: 'open_ended',
    question_text: 'Rewrite this sentence to sound more formal:\n\n"Hey, just wanted to check if you got my email about the meeting thing."',
    description: 'Write the formal version.',
    element_type: 'writing',
    scoring_logic: 'Register awareness - ability to shift between formal and informal register.',
    nano_skill: 'ns.writing.register_shift',
  },
  {
    id: 'wt_q38',
    section: 'communication',
    question_type: 'multiple_choice',
    question_text: 'Which of these sounds most natural?',
    options: [
      'I want that you help me',
      'I want you to help me',
      'I want you help me',
      'I want for you to help me',
    ],
    correct_answer: 'I want you to help me',
    element_type: 'grammar',
    difficulty_level: 2,
    scoring_logic: 'Grammatical intuition (implicit knowledge vs explicit). Natural-sounding English detection.',
    nano_skill: 'ns.grammar.verb_pattern_want',
  },
  {
    id: 'wt_q39',
    section: 'communication',
    question_type: 'scenario_reaction',
    question_text: 'You need to explain why you were late to a meeting. Choose the best response:',
    options: [
      'Sorry I\'m late. Traffic.',
      'I apologize for being late. There was an accident on the highway.',
      'I\'m so sorry for the delay. Unfortunately, there was a major traffic jam due to an accident. I left early but couldn\'t avoid it.',
      'My deepest apologies for this unacceptable tardiness.',
    ],
    correct_answer: 'I\'m so sorry for the delay. Unfortunately, there was a major traffic jam due to an accident. I left early but couldn\'t avoid it.',
    element_type: 'writing',
    difficulty_level: 3,
    scoring_logic: 'Pragmatic appropriacy - not too casual, not too formal. Middle options are correct.',
    nano_skill: 'ns.writing.pragmatic_appropriacy',
  },
  {
    id: 'wt_q40',
    section: 'communication',
    question_type: 'open_reflection',
    question_text: 'Read these two versions. Which sounds better and why?\n\nVersion A: "The meeting was good. We talked about the project. Everyone agreed."\n\nVersion B: "The meeting went well - we discussed the project timeline and reached a consensus on the next steps."',
    description: 'Which version sounds better to you and why? Write 1 sentence.',
    element_type: 'writing',
    scoring_logic: 'Awareness of discourse quality - can student recognize and explain better text?',
    nano_skill: 'ns.writing.discourse_quality_awareness',
  },
];

// =====================================================
// SECTION 7: Your Goals & Preferences (Q41-Q45)
// =====================================================

const goalsQuestions: WelcomeTestQuestionDef[] = [
  {
    id: 'wt_q41',
    section: 'goals',
    question_type: 'open_reflection',
    question_text: 'If you could achieve ONE thing in English in the next 3 months, what would it be?',
    description: 'Write freely - there are no wrong answers.',
    scoring_logic: 'Goal Setting Theory (Locke & Latham). Concrete, ambitious goals increase outcomes 20-25%.',
  },
  // Q41b: Learning timeline (Learning Path Signal - time horizon + goal weight)
  {
    id: 'wt_q41b',
    section: 'goals',
    question_type: 'scenario_reaction',
    question_text: 'Which of these situations is closest to yours right now?',
    description: 'There are no right or wrong answers.',
    options: [
      'I have a specific event coming up soon where I need English (trip, interview, presentation)',
      'I need English regularly for my work/life, and I want to get noticeably better in the next few months',
      'I\'m learning English for the long term - there\'s no rush, but I want steady progress',
      'English is something I enjoy learning - it\'s more about personal growth than a specific need',
    ],
    scoring_logic: 'Combines deadline urgency with goal importance. Option 0 = urgent + specific. Option 1 = ongoing + important. Option 2 = long-term steady. Option 3 = hobby/growth.',
    detected_trait: {
      trait_name: 'learning_timeline',
      mapping: { '0': 'urgent_specific', '1': 'ongoing_important', '2': 'long_term_steady', '3': 'hobby_growth' },
    },
  },
  // NEW: Speaking question - self-introduction
  {
    id: 'wt_q41s',
    section: 'goals',
    question_type: 'speaking_record',
    question_text: 'Record a 30-second introduction of yourself in English.\n\nSay your name, what you do, and why you\'re learning English.',
    description: 'Speak freely for up to 30 seconds. There\'s no right or wrong way!',
    element_type: 'speaking',
    max_recording_seconds: 30,
    scoring_logic: 'Spontaneous speech production - fluency, complexity, accuracy baseline.',
    nano_skill: 'ns.speaking.self_introduction',
  },
  {
    id: 'wt_q42',
    section: 'goals',
    question_type: 'preference_choice',
    question_text: 'How do you prefer to receive feedback on your mistakes?',
    options: [
      'Correct me immediately, every time',
      'Note them down and discuss at the end',
      'Only correct major mistakes, ignore small ones',
      'Write corrections for me to review later',
      'I prefer to self-correct with hints',
    ],
    scoring_logic: 'Feedback preference = how to build Live Session interactions and formulate AI feedback',
    detected_trait: {
      trait_name: 'feedback_preference',
      mapping: {
        '0': 'immediate',
        '1': 'delayed_discussion',
        '2': 'major_only',
        '3': 'written_review',
        '4': 'self_correct',
      },
    },
  },
  {
    id: 'wt_q43',
    section: 'goals',
    question_type: 'preference_choice',
    question_text: 'What topics interest you the most? Pick up to 3.',
    multi_select: true,
    max_selections: 3,
    options: [
      'Technology & Innovation',
      'Business & Finance',
      'Travel & Culture',
      'Health & Lifestyle',
      'Science & Nature',
      'Entertainment & Pop Culture',
      'Sports',
      'Food & Cooking',
      'Psychology & Self-improvement',
      'Politics & Current Events',
      'Art & Literature',
      'History',
    ],
    scoring_logic: 'Content preferences for worksheet generation, flashcard sets, and lesson topics',
  },
  {
    id: 'wt_q44',
    section: 'goals',
    question_type: 'self_assessment_matrix',
    question_text: 'How would you rate your confidence in these areas?',
    description: 'Rate each area from 1 (not confident) to 5 (very confident).',
    matrix_items: [
      'Speaking with strangers',
      'Writing formal emails',
      'Understanding movies without subtitles',
      'Reading news articles',
      'Giving presentations',
      'Small talk at parties',
    ],
    matrix_scale: { min: 1, max: 5, labels: { 1: 'Not confident', 3: 'Somewhat', 5: 'Very confident' } },
    scoring_logic: 'Self-efficacy map (Bandura) - perception of own abilities in different contexts. Compare with actual results.',
  },
  {
    id: 'wt_q45',
    section: 'goals',
    question_type: 'open_reflection',
    question_text: 'Is there anything else you\'d like your teacher to know about you or your learning?',
    description: 'This is optional - write anything you think might be helpful.',
    scoring_logic: 'Open-ended final reflection. Catches anything the structured questions missed.',
  },
];

// =====================================================
// ASSEMBLED SECTIONS
// =====================================================

export const WELCOME_TEST_SECTIONS_WITH_QUESTIONS: WelcomeTestSectionDef[] = [
  {
    id: 'about_you',
    title: 'About You',
    subtitle: 'Help us understand your learning style and preferences',
    icon: 'User',
    questions: aboutYouQuestions,
  },
  {
    id: 'experience',
    title: 'Your English Experience',
    subtitle: 'Tell us about your journey with English so far',
    icon: 'BookOpen',
    questions: experienceQuestions,
  },
  {
    id: 'scenarios',
    title: 'Real-Life Scenarios',
    subtitle: 'How would you handle these situations?',
    icon: 'MessageSquare',
    questions: scenarioQuestions,
  },
  {
    id: 'grammar',
    title: 'Grammar Check',
    subtitle: 'Let\'s see where your grammar stands',
    icon: 'PenTool',
    questions: grammarQuestions,
  },
  {
    id: 'vocabulary',
    title: 'Vocabulary & Expressions',
    subtitle: 'Test your word power and knowledge of expressions',
    icon: 'BookOpen',
    questions: vocabularyQuestions,
  },
  {
    id: 'communication',
    title: 'Communication Style',
    subtitle: 'How do you use English in real communication?',
    icon: 'MessageCircle',
    questions: communicationQuestions,
  },
  {
    id: 'goals',
    title: 'Your Goals & Preferences',
    subtitle: 'What do you want to achieve and how do you like to learn?',
    icon: 'Target',
    questions: goalsQuestions,
  },
];

// Flat list of all questions for easy access
export const ALL_WELCOME_TEST_QUESTIONS: WelcomeTestQuestionDef[] = 
  WELCOME_TEST_SECTIONS_WITH_QUESTIONS.flatMap(s => s.questions);

export const WELCOME_TEST_TOTAL_QUESTIONS = ALL_WELCOME_TEST_QUESTIONS.length;

// Short version exports removed - always full test

// =====================================================
// Plan v6.0 — EQUIVALENT-FORM SKILL VARIANTS (Form B)
// =====================================================
// Profiling questions (About You, Experience, Goals, Communication-style)
// stay identical across attempts — we want to measure trait evolution.
// Skill questions (Grammar, Vocabulary, Reading, Listening) are swapped
// for equivalent items with the same nano_skill and difficulty_level so
// the student does not face the exact same item twice (test-effect).
// =====================================================

export const WELCOME_TEST_SKILL_VARIANTS_B: Record<string, WelcomeTestQuestionDef> = {
  // Grammar
  wt_q20: {
    id: 'wt_q20', section: 'grammar', question_type: 'fill_blank',
    question_text: 'He ___ (watch) TV every evening.',
    description: 'Write the correct form of the verb in brackets.',
    correct_answer: 'watches',
    element_type: 'grammar', difficulty_level: 1,
    scoring_logic: 'Present Simple 3rd person -s. A2 level grammar.',
    nano_skill: 'ns.grammar.present_simple_third_person',
  },
  wt_q21: {
    id: 'wt_q21', section: 'grammar', question_type: 'fill_blank',
    question_text: 'She ___ (work) here since 2020.',
    description: 'Write the correct form of the verb in brackets.',
    correct_answer: ['has been working', 'has worked'],
    element_type: 'grammar', difficulty_level: 3,
    scoring_logic: 'Present Perfect Continuous / Present Perfect. B1-B2 level.',
    nano_skill: 'ns.grammar.present_perfect_continuous',
  },
  wt_q22: {
    id: 'wt_q22', section: 'grammar', question_type: 'multiple_choice',
    question_text: 'If you ___ me yesterday, I would have helped.',
    options: ['called', 'had called', 'would call', 'have called'],
    correct_answer: 'had called',
    element_type: 'grammar', difficulty_level: 4,
    scoring_logic: 'Third Conditional. B2 level grammar.',
    nano_skill: 'ns.grammar.third_conditional',
  },
  wt_q23: {
    id: 'wt_q23', section: 'grammar', question_type: 'multiple_choice',
    question_text: 'The bridge ___ in 1995.',
    options: ['built', 'was built', 'has built', 'is built'],
    correct_answer: 'was built',
    element_type: 'grammar', difficulty_level: 3,
    scoring_logic: 'Past Simple Passive. B1-B2 level.',
    nano_skill: 'ns.grammar.passive_voice_past',
  },
  wt_q24: {
    id: 'wt_q24', section: 'grammar', question_type: 'multiple_choice',
    question_text: 'Find the error: "He don\'t play football."',
    description: 'Choose the corrected version.',
    options: [
      'He doesn\'t play football.',
      'He didn\'t play football.',
      'He not play football.',
      'He isn\'t play football.',
    ],
    correct_answer: 'He doesn\'t play football.',
    element_type: 'grammar', difficulty_level: 1,
    scoring_logic: 'Error correction - 3rd person negative. A2 level.',
    nano_skill: 'ns.grammar.negative_third_person',
  },
  wt_q25: {
    id: 'wt_q25', section: 'grammar', question_type: 'multiple_choice',
    question_text: 'Find the error: "I have saw that movie last week."',
    description: 'Choose the corrected version.',
    options: [
      'I saw that movie last week.',
      'I have seen that movie last week.',
      'I had seen that movie last week.',
      'I was seen that movie last week.',
    ],
    correct_answer: 'I saw that movie last week.',
    element_type: 'grammar', difficulty_level: 2,
    scoring_logic: 'Error correction - Past Simple vs Present Perfect. B1 level.',
    nano_skill: 'ns.grammar.past_simple_vs_present_perfect',
  },
  wt_q26: {
    id: 'wt_q26', section: 'grammar', question_type: 'fill_blank',
    question_text: '"She started working here three years ago."\n\nComplete the sentence: She ___ for three years.',
    description: 'Fill in the blank to rewrite the sentence using the correct tense. Write only the missing words.',
    correct_answer: 'has been working',
    element_type: 'grammar', difficulty_level: 3,
    scoring_logic: 'Sentence transformation - Present Perfect Continuous. B1-B2 level.',
    nano_skill: 'ns.grammar.sentence_transformation_ppc',
  },
  wt_q27: {
    id: 'wt_q27', section: 'grammar', question_type: 'fill_blank',
    question_text: '"People believe she is honest."\n\nComplete the sentence: She ___ honest.',
    description: 'Fill in the blank to rewrite using a passive construction. Write only the missing words.',
    correct_answer: 'is believed to be',
    element_type: 'grammar', difficulty_level: 4,
    scoring_logic: 'Sentence transformation - Passive reporting. B2-C1 level.',
    nano_skill: 'ns.grammar.passive_reporting',
  },
  // Vocabulary
  wt_q28: {
    id: 'wt_q28', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'Could you ___ me a small favour?',
    options: ['do', 'make', 'have', 'take'],
    correct_answer: 'do',
    element_type: 'vocabulary', difficulty_level: 2,
    scoring_logic: 'Collocation: do a favour. B1 level.',
    nano_skill: 'ns.vocabulary.collocation_do_make',
  },
  wt_q29: {
    id: 'wt_q29', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'He ___ a quick shower before leaving.',
    options: ['took', 'made', 'did', 'got'],
    correct_answer: 'took',
    element_type: 'vocabulary', difficulty_level: 2,
    scoring_logic: 'Collocation: take a shower. B1 level.',
    nano_skill: 'ns.vocabulary.collocation_take',
  },
  wt_q30: {
    id: 'wt_q30', section: 'vocabulary', question_type: 'fill_blank',
    question_text: 'Her ___ (explain) was very clear.',
    description: 'Write the correct NOUN form of the word in brackets.',
    correct_answer: 'explanation',
    element_type: 'vocabulary', difficulty_level: 2,
    scoring_logic: 'Word formation: verb to noun. B1 level.',
    nano_skill: 'ns.vocabulary.word_formation_noun',
  },
  wt_q31: {
    id: 'wt_q31', section: 'vocabulary', question_type: 'fill_blank',
    question_text: 'She answered ___ (polite).',
    description: 'Write the correct form of the word in brackets.',
    correct_answer: 'politely',
    element_type: 'vocabulary', difficulty_level: 2,
    scoring_logic: 'Word formation: adjective to adverb. B1 level.',
    nano_skill: 'ns.vocabulary.word_formation_adverb',
  },
  wt_q32: {
    id: 'wt_q32', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'The meeting was cancelled — let\'s ___ it off until next week.',
    options: ['put', 'take', 'set', 'go'],
    correct_answer: 'put',
    element_type: 'vocabulary', difficulty_level: 2,
    scoring_logic: 'Contextual vocabulary: phrasal verb meaning. B1-B2 level.',
    nano_skill: 'ns.vocabulary.phrasal_verb_contextual',
  },
  wt_q33: {
    id: 'wt_q33', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'After the accident, he was absolutely ___.',
    options: ['terrified', 'happy', 'curious', 'tired'],
    correct_answer: 'terrified',
    element_type: 'vocabulary', difficulty_level: 3,
    scoring_logic: 'Nuance understanding: extreme adjectives. B2 level.',
    nano_skill: 'ns.vocabulary.extreme_adjectives',
  },
  wt_q34: {
    id: 'wt_q34', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'What does "hit the books" mean?',
    options: [
      'To physically strike a book',
      'To start studying seriously',
      'To buy new books',
      'To finish reading',
    ],
    correct_answer: 'To start studying seriously',
    element_type: 'vocabulary', difficulty_level: 3,
    scoring_logic: 'Idiom comprehension. B2 level.',
    nano_skill: 'ns.vocabulary.idiom_comprehension',
  },
  wt_q35: {
    id: 'wt_q35', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'Don\'t worry about the small stuff — it\'s a ___.',
    options: [
      'piece of cake',
      'cup of tea',
      'slice of bread',
      'bowl of soup',
    ],
    correct_answer: 'piece of cake',
    element_type: 'vocabulary', difficulty_level: 3,
    scoring_logic: 'Idiom production/recognition. B2 level.',
    nano_skill: 'ns.vocabulary.idiom_production',
  },
  // Reading
  wt_q18: {
    id: 'wt_q18', section: 'scenarios', question_type: 'multiple_choice',
    question_text: 'Read this short dialogue and answer: What is the main problem the speakers are discussing?\n\nA: "I haven\'t received the refund yet — it\'s been almost a month."\nB: "I\'m sorry to hear that. Could you give me your order number?"\nA: "I sent it twice already. Your team keeps saying it will be processed soon."\nB: "Let me speak with our finance team and get back to you today."',
    options: [
      'A delayed refund',
      'A wrong product delivered',
      'A missing receipt',
      'A defective item',
    ],
    correct_answer: 'A delayed refund',
    element_type: 'reading', difficulty_level: 2,
    scoring_logic: 'Reading comprehension - extracting main idea. Difficulty level B1-B2.',
    nano_skill: 'ns.reading.identify_main_idea',
  },
  wt_q19: {
    id: 'wt_q19', section: 'scenarios', question_type: 'multiple_choice',
    question_text: 'Read this text and answer the question below:\n\n"A new survey shows that 70% of remote workers report higher job satisfaction than their office counterparts. While productivity remains comparable, employees value the flexibility and the elimination of long commutes. However, companies are increasingly concerned about onboarding junior staff remotely, as informal mentorship and spontaneous collaboration are harder to replicate."\n\nWhat does the author identify as the main concern with remote work?',
    options: [
      'Reduced employee productivity',
      'Difficulty onboarding junior staff',
      'Higher operating costs',
      'Longer working hours',
    ],
    correct_answer: 'Difficulty onboarding junior staff',
    element_type: 'reading', difficulty_level: 3,
    scoring_logic: 'Reading comprehension - inference, not just surface-level understanding. B2 level.',
    nano_skill: 'ns.reading.inference_from_text',
  },
  // Listening — Form B reuses same audio asset; only options differ slightly to avoid memory
  wt_q18l: {
    id: 'wt_q18l', section: 'scenarios', question_type: 'listening_comprehension',
    question_text: 'Listen to this short conversation and answer: What did the customer change about their order?',
    audio_url: 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev/audio/welcome-test-listening-1771235244954.mp3',
    audio_transcript: 'A: "Excuse me, I ordered a medium latte about twenty minutes ago and I\'m still waiting."\nB: "I\'m sorry about that. Let me check with the barista. Would you like me to make you a fresh one right away?"\nA: "Yes please, and could I get it with oat milk this time instead?"',
    options: [
      'The size of the drink',
      'The type of milk',
      'The temperature',
      'The number of shots',
    ],
    correct_answer: 'The type of milk',
    element_type: 'listening', difficulty_level: 2,
    scoring_logic: 'Listening comprehension - detail extraction (variant focus). B1 level.',
    nano_skill: 'ns.listening.detail_extraction',
  },
  // Grammar verb pattern (lives in communication section)
  wt_q38: {
    id: 'wt_q38', section: 'communication', question_type: 'multiple_choice',
    question_text: 'Which of these sounds most natural?',
    options: [
      'I\'d like that he comes early',
      'I\'d like him to come early',
      'I\'d like him come early',
      'I\'d like for him come early',
    ],
    correct_answer: 'I\'d like him to come early',
    element_type: 'grammar', difficulty_level: 2,
    scoring_logic: 'Grammatical intuition. Natural-sounding English detection.',
    nano_skill: 'ns.grammar.verb_pattern_want',
  },
  // Pragmatic appropriacy
  wt_q39: {
    id: 'wt_q39', section: 'communication', question_type: 'scenario_reaction',
    question_text: 'You need to explain why you missed yesterday\'s deadline. Choose the best response:',
    options: [
      'Sorry, missed it.',
      'I apologize for missing the deadline. I had an unexpected family matter.',
      'I\'m really sorry about the deadline. There was an unexpected family emergency yesterday and I couldn\'t focus. I\'ll have the work to you by end of day.',
      'I offer my deepest apologies for this most regrettable oversight.',
    ],
    correct_answer: 'I\'m really sorry about the deadline. There was an unexpected family emergency yesterday and I couldn\'t focus. I\'ll have the work to you by end of day.',
    element_type: 'writing', difficulty_level: 3,
    scoring_logic: 'Pragmatic appropriacy - not too casual, not too formal.',
    nano_skill: 'ns.writing.pragmatic_appropriacy',
  },
};

/**
 * Returns the Welcome Test question set for a given attempt number.
 * - Attempt 1 → original (form A) questions.
 * - Attempt 2+ → for skill items defined in WELCOME_TEST_SKILL_VARIANTS_B
 *   the variant is substituted; profiling questions stay identical.
 */
export function getWelcomeTestQuestions(attemptNumber: number = 1): WelcomeTestQuestionDef[] {
  if (attemptNumber <= 1) return ALL_WELCOME_TEST_QUESTIONS;
  return ALL_WELCOME_TEST_QUESTIONS.map(q => WELCOME_TEST_SKILL_VARIANTS_B[q.id] ?? q);
}
