/**
 * GENERATED from src/data/welcomeTestQuestions.ts by
 * scripts/welcomeTest/generate-question-meta.ts. Do not edit by hand: the
 * parity test (welcomeTestEventPayload.test.ts) fails when it drifts.
 */
import type { WelcomeEventQuestion } from './welcomeTestEventPayload.ts';

export const WELCOME_TEST_EVENT_QUESTIONS: readonly WelcomeEventQuestion[] = [
  {
    "id": "wt_q1",
    "question_type": "self_assessment",
    "element_type": null,
    "nano_skill": null,
    "reason": "Self-awareness: compare with actual grammar/vocab scores to detect over/underestimation",
    "has_key": false,
    "options": [
      "I can do basic things, like ordering food or asking for directions",
      "I can have simple talks about everyday topics, but harder ideas are tough",
      "I can talk about most topics, but I make grammar mistakes and miss some words",
      "I speak fluently most of the time, but I want to sound more natural",
      "I feel comfortable in English, but I want to master advanced or work language"
    ],
    "detected_trait": {
      "trait_name": "self_assessed_level",
      "mapping": {
        "0": "A1-A2",
        "1": "A2-B1",
        "2": "B1-B2",
        "3": "B2-C1",
        "4": "C1-C2"
      }
    }
  },
  {
    "id": "wt_q2",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Identifies main barriers + emotional relationship with errors (fixed vs growth mindset signals)",
    "has_key": false
  },
  {
    "id": "wt_q3",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Motivation type: instrumental (work, exam) vs integrative (travel, movies, confidence)",
    "has_key": false,
    "options": [
      "I need it for work: meetings, emails, presentations",
      "I am preparing for an exam (IELTS, Cambridge, etc.)",
      "I want to travel and talk freely",
      "I want to watch films and read books without subtitles",
      "I want to feel confident with English speakers",
      "I want a promotion that needs English",
      "I am moving to an English-speaking country"
    ],
    "detected_trait": {
      "trait_name": "motivation_type",
      "mapping": {
        "0": "instrumental",
        "1": "instrumental",
        "2": "integrative",
        "3": "integrative",
        "4": "integrative",
        "5": "instrumental",
        "6": "instrumental"
      }
    }
  },
  {
    "id": "wt_q3b",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Usage context determines vocabulary domain, register priority, and skill balance. Work-heavy = formal register. Travel = survival phrases. Online = informal. Professional field = ESP.",
    "has_key": false,
    "options": [
      "At work - emails, meetings, calls",
      "Traveling - airports, hotels, restaurants",
      "Online - social media, forums, gaming",
      "With friends/family who speak English",
      "Consuming content - movies, books, podcasts",
      "In my professional field (medical, legal, IT, etc.)"
    ],
    "detected_trait": {
      "trait_name": "usage_context",
      "mapping": {
        "0": "work_formal",
        "1": "travel",
        "2": "online_informal",
        "3": "social",
        "4": "content_consumption",
        "5": "professional_field"
      }
    }
  },
  {
    "id": "wt_q3c",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Indirect/projected goal. Reveals latent motivation when direct answers (Q3) are filtered by social desirability. AI weights this above Q3 when they conflict.",
    "has_key": false,
    "options": [
      "I confidently lead meetings with international clients",
      "I watch Netflix shows without subtitles, effortlessly",
      "I feel like a local when I travel anywhere in the world",
      "I got promoted to a position that requires English",
      "I read books in the original language for pleasure"
    ],
    "detected_trait": {
      "trait_name": "latent_goal",
      "mapping": {
        "0": "career_critical",
        "1": "lifestyle",
        "2": "travel_lifestyle",
        "3": "career_critical",
        "4": "lifestyle"
      }
    }
  },
  {
    "id": "wt_q4",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Tolerance of ambiguity (Ely, 1995) - key predictor of language learning success",
    "has_key": false,
    "options": [
      "I ask the person to repeat or explain",
      "I pretend I understood and hope for the best",
      "I try to guess from context",
      "I get stressed and switch to my language",
      "I look it up immediately on my phone"
    ],
    "detected_trait": {
      "trait_name": "ambiguity_tolerance",
      "mapping": {
        "0": "medium",
        "1": "low",
        "2": "high",
        "3": "low",
        "4": "medium"
      }
    }
  },
  {
    "id": "wt_q5",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Available time budget - directly affects strategy selection (spaced repetition intervals, homework load)",
    "has_key": false,
    "options": [
      "Almost none - I only have lesson time",
      "15-30 minutes a few times a week",
      "About 1 hour spread across the week",
      "2-3 hours - I'm committed",
      "More than 3 hours - English is my priority"
    ],
    "detected_trait": {
      "trait_name": "weekly_study_time",
      "mapping": {
        "0": "none",
        "1": "15_30_min",
        "2": "1_hour",
        "3": "2_3_hours",
        "4": "3_plus_hours"
      }
    }
  },
  {
    "id": "wt_q5b",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Behavioral response to urgent deadline reveals stress tolerance and action orientation. Option 0 = intense preparation. Option 1 = pragmatic coping. Option 2 = avoidance. Option 3 = confident.",
    "has_key": false,
    "options": [
      "I'd panic at first, but then prepare intensively every day until the meeting",
      "I'd feel nervous but would ask a colleague for help and practice the key phrases",
      "I'd ask to postpone or let someone else handle it",
      "I'd feel fairly confident - I'd just review some vocabulary beforehand"
    ],
    "detected_trait": {
      "trait_name": "deadline_response",
      "mapping": {
        "0": "intense_preparation",
        "1": "pragmatic_coping",
        "2": "avoidance",
        "3": "confident"
      }
    }
  },
  {
    "id": "wt_q5c",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Real behavior under low-motivation pressure. Stronger predictor of homework completion than self-rated commitment.",
    "has_key": false,
    "options": [
      "I do it quickly just to get it off my plate",
      "I do it carefully, even if it takes an hour",
      "I message the teacher that I didn't make it and will do it later",
      "I start it but stop after about 10 minutes",
      "I already did it earlier; I don't leave things until the last minute"
    ],
    "detected_trait": {
      "trait_name": "homework_commitment",
      "mapping": {
        "0": "pragmatic",
        "1": "high",
        "2": "avoidant",
        "3": "low",
        "4": "proactive"
      }
    }
  },
  {
    "id": "wt_q6",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Preferred input channels (Visual/Auditory/Kinesthetic + Active/Passive). Krashen's Input Hypothesis.",
    "has_key": false
  },
  {
    "id": "wt_q7",
    "question_type": "self_assessment",
    "element_type": null,
    "nano_skill": null,
    "reason": "Error anxiety level (Horwitz Foreign Language Anxiety Scale)",
    "has_key": false,
    "options": [
      "I do not mind; that is how you learn",
      "I prefer not to, but I can handle it",
      "I feel shy, but I keep going",
      "I avoid speaking because I fear mistakes",
      "I get very frustrated with myself"
    ],
    "detected_trait": {
      "trait_name": "anxiety_level",
      "mapping": {
        "0": "low",
        "1": "low",
        "2": "medium",
        "3": "high",
        "4": "medium"
      }
    }
  },
  {
    "id": "wt_q7b",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Correction preference during speech production. Drives teacher pedagogy + AI live-feedback timing.",
    "has_key": false,
    "options": [
      "Correct me immediately: I want to know right away",
      "Take notes and tell me after I finish my thought",
      "Only correct serious mistakes, small ones discourage me",
      "Explain the rule every time I make a mistake",
      "Send me a written summary after the lesson"
    ],
    "detected_trait": {
      "trait_name": "correction_preference",
      "mapping": {
        "0": "immediate",
        "1": "delayed",
        "2": "selective",
        "3": "rule_based",
        "4": "written_summary"
      }
    }
  },
  {
    "id": "wt_q8",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Dominant memory encoding strategy (Dual Coding Theory, Paivio)",
    "has_key": false,
    "options": [
      "Seeing it written down with a definition",
      "Hearing it in a sentence",
      "Using it in my own sentence right away",
      "Connecting it to a picture or image",
      "Repeating it many times",
      "Understanding the word parts (prefix, root, suffix)"
    ],
    "detected_trait": {
      "trait_name": "preferred_input_channel",
      "mapping": {
        "0": "visual",
        "1": "auditory",
        "2": "kinesthetic",
        "3": "visual",
        "4": "auditory",
        "5": "visual"
      }
    }
  },
  {
    "id": "wt_q9",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Learning duration context - longer learners may have fossilized errors",
    "has_key": false
  },
  {
    "id": "wt_q10",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Learning context affects fossilized errors - YouTube self-learner vs Cambridge course student have different patterns",
    "has_key": false
  },
  {
    "id": "wt_q11",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Exam experience indicates familiarity with structured assessment and formal English",
    "has_key": false
  },
  {
    "id": "wt_q12",
    "question_type": "open_reflection",
    "element_type": null,
    "nano_skill": null,
    "reason": "Narrative self-assessment. Sentiment analysis + keywords reveal emotional relationship with learning.",
    "has_key": false
  },
  {
    "id": "wt_q13",
    "question_type": "open_reflection",
    "element_type": null,
    "nano_skill": null,
    "reason": "What worked before = what will likely work again. Practical pedagogical intelligence.",
    "has_key": false
  },
  {
    "id": "wt_q13b",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Transfer of persistence patterns from other domains (Duckworth Grit Scale proxy). Measures actual behavior, not self-image. Option 0 = high grit. Option 1 = medium. Option 2 = low. Option 3 = high (ongoing).",
    "has_key": false,
    "options": [
      "I stuck with it and got pretty good at it",
      "I practiced for a while but eventually moved on to something else",
      "I started enthusiastically but lost motivation after a few weeks",
      "I'm still learning it - I haven't given up yet"
    ],
    "detected_trait": {
      "trait_name": "persistence_level",
      "mapping": {
        "0": "high",
        "1": "medium",
        "2": "low",
        "3": "high"
      }
    }
  },
  {
    "id": "wt_q13c",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Plateau-response pattern. Direct input to Pacing Path scoring: doubt_prone → comfort, intensity_response+high_persistence → accelerated, adaptive → guided, resilient+intense_prep → target.",
    "has_key": false,
    "options": [
      "Push harder: more hours, more material",
      "Change the method, teacher, or approach",
      "Take a break for a week or two",
      "Accept the plateau as part of the process and keep going",
      "Start to doubt whether this is really for me"
    ],
    "detected_trait": {
      "trait_name": "plateau_response",
      "mapping": {
        "0": "intensity_response",
        "1": "adaptive",
        "2": "rest_response",
        "3": "resilient",
        "4": "doubt_prone"
      }
    }
  },
  {
    "id": "wt_q14",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Communication strategy under pressure - active vs avoidant coping",
    "has_key": false,
    "options": [
      "I say \"Sorry, could you repeat that please?\" and try again",
      "I just point at the menu and smile",
      "I use Google Translate on my phone",
      "I answer with what I think they asked"
    ],
    "detected_trait": {
      "trait_name": "error_attitude",
      "mapping": {
        "0": "comfortable",
        "1": "avoidant",
        "2": "cautious",
        "3": "comfortable"
      }
    }
  },
  {
    "id": "wt_q15",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Behavioral: reading comprehension strategy + self-reported coping. NOT a skill test, detects reading_strategy trait for Learning Path.",
    "has_key": false,
    "options": [
      "I read it carefully, look up unknown words, and reply",
      "I reply asking them to clarify the confusing parts",
      "I understand most of it and guess the rest from context",
      "I struggle to understand and need to translate most of it",
      "I don't try to understand, I use ChatGPT"
    ],
    "detected_trait": {
      "trait_name": "reading_strategy",
      "mapping": {
        "0": "careful_lookup",
        "1": "clarification_seeker",
        "2": "context_guesser",
        "3": "struggles_translates",
        "4": "avoids_uses_ai"
      }
    }
  },
  {
    "id": "wt_q16",
    "question_type": "open_ended",
    "element_type": "writing",
    "nano_skill": "ns.writing.complaint_register",
    "reason": "Actual writing level - grammar accuracy, vocabulary range, pragmatic appropriateness. Compare with Q1 self-assessment.",
    "has_key": false
  },
  {
    "id": "wt_q17",
    "question_type": "open_ended",
    "element_type": "writing",
    "nano_skill": "ns.writing.formal_narrative",
    "reason": "Pragmatic competence + discourse management under pressure. Formal/informal register, coherence, complexity.",
    "has_key": false
  },
  {
    "id": "wt_q17b",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Reveals goal importance (career-critical?) and urgency (take action now?). Option 0 = critical. Option 1 = high. Option 2 = not career. Option 3 = moderate.",
    "has_key": false,
    "options": [
      "This is exactly why I'm learning English - I need to be ready for opportunities like this",
      "I'd apply anyway and hope my English improves by the time they interview me",
      "I'd skip it - I'm not learning English for work reasons",
      "I'd apply and highlight my other strengths to compensate for my English"
    ],
    "detected_trait": {
      "trait_name": "career_english_importance",
      "mapping": {
        "0": "critical",
        "1": "high",
        "2": "not_career",
        "3": "moderate"
      }
    }
  },
  {
    "id": "wt_q18",
    "question_type": "multiple_choice",
    "element_type": "reading",
    "nano_skill": "ns.reading.identify_main_idea",
    "reason": "Reading comprehension - extracting main idea. Difficulty level B1-B2.",
    "has_key": true
  },
  {
    "id": "wt_q19",
    "question_type": "multiple_choice",
    "element_type": "reading",
    "nano_skill": "ns.reading.inference_from_text",
    "reason": "Reading comprehension - inference, not just surface-level understanding. B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q16s",
    "question_type": "speaking_record",
    "element_type": "speaking",
    "nano_skill": "ns.speaking.complaint_oral",
    "reason": "Speaking fluency, pronunciation, pragmatic appropriateness. Compare with written version (Q16).",
    "has_key": false
  },
  {
    "id": "wt_q18l",
    "question_type": "listening_comprehension",
    "element_type": "listening",
    "nano_skill": "ns.listening.detail_extraction",
    "reason": "Listening comprehension - detail extraction from dialogue. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q20",
    "question_type": "fill_blank",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.present_simple_third_person",
    "reason": "Present Simple 3rd person -s. A2 level grammar.",
    "has_key": true
  },
  {
    "id": "wt_q21",
    "question_type": "fill_blank",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.present_perfect_continuous",
    "reason": "Present Perfect Continuous / Present Perfect. B1-B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q22",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.third_conditional",
    "reason": "Third Conditional. B2 level grammar.",
    "has_key": true
  },
  {
    "id": "wt_q23",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.passive_voice_past",
    "reason": "Past Simple Passive. B1-B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q24",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.negative_third_person",
    "reason": "Error correction - 3rd person negative. A2 level.",
    "has_key": true
  },
  {
    "id": "wt_q25",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.past_simple_vs_present_perfect",
    "reason": "Error correction - Past Simple vs Present Perfect. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q26",
    "question_type": "fill_blank",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.sentence_transformation_ppc",
    "reason": "Sentence transformation - Present Perfect Continuous. B1-B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q27",
    "question_type": "fill_blank",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.passive_reporting",
    "reason": "Sentence transformation - Passive reporting. B2-C1 level.",
    "has_key": true
  },
  {
    "id": "wt_q28",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.collocation_do_make",
    "reason": "Collocation: do a favour. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q29",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.collocation_take",
    "reason": "Collocation: take a breath. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q30",
    "question_type": "fill_blank",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.word_formation_noun",
    "reason": "Word formation: verb to noun. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q31",
    "question_type": "fill_blank",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.word_formation_adverb",
    "reason": "Word formation: adjective to adverb. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q32",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.phrasal_verb_contextual",
    "reason": "Contextual vocabulary: phrasal verb meaning. B1-B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q33",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.extreme_adjectives",
    "reason": "Nuance understanding: extreme adjectives. B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q34",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.idiom_comprehension",
    "reason": "Idiom comprehension. B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q35",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.idiom_production",
    "reason": "Idiom production/recognition. B2 level.",
    "has_key": true
  },
  {
    "id": "wt_q36",
    "question_type": "open_ended",
    "element_type": "writing",
    "nano_skill": "ns.writing.pragmatic_declining",
    "reason": "Pragmatic competence - ability to use language in social context. Register, politeness strategies.",
    "has_key": false
  },
  {
    "id": "wt_q36s",
    "question_type": "speaking_record",
    "element_type": "speaking",
    "nano_skill": "ns.speaking.pragmatic_declining_oral",
    "reason": "Speaking pragmatics - politeness strategies in real-time speech.",
    "has_key": false
  },
  {
    "id": "wt_q37",
    "question_type": "open_ended",
    "element_type": "writing",
    "nano_skill": "ns.writing.register_shift",
    "reason": "Register awareness - ability to shift between formal and informal register.",
    "has_key": false
  },
  {
    "id": "wt_q38",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.verb_pattern_want",
    "reason": "Grammatical intuition (implicit knowledge vs explicit). Natural-sounding English detection.",
    "has_key": true
  },
  {
    "id": "wt_q39",
    "question_type": "scenario_reaction",
    "element_type": "writing",
    "nano_skill": "ns.writing.pragmatic_appropriacy",
    "reason": "Pragmatic appropriacy - not too casual, not too formal. Middle options are correct.",
    "has_key": true
  },
  {
    "id": "wt_q40",
    "question_type": "open_reflection",
    "element_type": "writing",
    "nano_skill": "ns.writing.discourse_quality_awareness",
    "reason": "Awareness of discourse quality - can student recognize and explain better text?",
    "has_key": false
  },
  {
    "id": "wt_q41",
    "question_type": "open_reflection",
    "element_type": null,
    "nano_skill": null,
    "reason": "Goal Setting Theory (Locke & Latham). Concrete, ambitious goals increase outcomes 20-25%.",
    "has_key": false
  },
  {
    "id": "wt_q41b",
    "question_type": "scenario_reaction",
    "element_type": null,
    "nano_skill": null,
    "reason": "Combines deadline urgency with goal importance. Option 0 = urgent + specific. Option 1 = ongoing + important. Option 2 = long-term steady. Option 3 = hobby/growth.",
    "has_key": false,
    "options": [
      "I have a specific event coming up soon where I need English (trip, interview, presentation)",
      "I need English regularly for my work/life, and I want to get noticeably better in the next few months",
      "I'm learning English for the long term - there's no rush, but I want steady progress",
      "English is something I enjoy learning - it's more about personal growth than a specific need"
    ],
    "detected_trait": {
      "trait_name": "learning_timeline",
      "mapping": {
        "0": "urgent_specific",
        "1": "ongoing_important",
        "2": "long_term_steady",
        "3": "hobby_growth"
      }
    }
  },
  {
    "id": "wt_q41s",
    "question_type": "speaking_record",
    "element_type": "speaking",
    "nano_skill": "ns.speaking.self_introduction",
    "reason": "Spontaneous speech production - fluency, complexity, accuracy baseline.",
    "has_key": false
  },
  {
    "id": "wt_q42",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Feedback preference = how to build Live Session interactions and formulate AI feedback",
    "has_key": false,
    "options": [
      "Correct me immediately, every time",
      "Note them down and discuss at the end",
      "Only correct major mistakes, ignore small ones",
      "Write corrections for me to review later",
      "I prefer to self-correct with hints"
    ],
    "detected_trait": {
      "trait_name": "feedback_preference",
      "mapping": {
        "0": "immediate",
        "1": "delayed_discussion",
        "2": "major_only",
        "3": "written_review",
        "4": "self_correct"
      }
    }
  },
  {
    "id": "wt_q43",
    "question_type": "preference_choice",
    "element_type": null,
    "nano_skill": null,
    "reason": "Content preferences for worksheet generation, flashcard sets, and lesson topics",
    "has_key": false
  },
  {
    "id": "wt_q44",
    "question_type": "self_assessment_matrix",
    "element_type": null,
    "nano_skill": null,
    "reason": "Self-efficacy map (Bandura) - perception of own abilities in different contexts. Compare with actual results.",
    "has_key": false
  },
  {
    "id": "wt_q45",
    "question_type": "open_reflection",
    "element_type": null,
    "nano_skill": null,
    "reason": "Open-ended final reflection. Catches anything the structured questions missed.",
    "has_key": false
  },
  {
    "id": "wt_q59",
    "question_type": "fill_blank",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.to_be_present_simple",
    "reason": "To be, present simple, third person. A1 level grammar.",
    "has_key": true
  },
  {
    "id": "wt_q60",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.present_simple_questions",
    "reason": "Present simple questions with do/does. A1 level grammar.",
    "has_key": true
  },
  {
    "id": "wt_q61",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.inversion_negative_adverbials",
    "reason": "Inversion after negative adverbials. C1 level grammar.",
    "has_key": true
  },
  {
    "id": "wt_q62",
    "question_type": "multiple_choice",
    "element_type": "grammar",
    "nano_skill": "ns.grammar.mixed_conditionals",
    "reason": "Mixed conditionals (past condition, present result). C1 level grammar.",
    "has_key": true
  },
  {
    "id": "wt_q63",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.everyday_clothes",
    "reason": "Everyday words: clothes. A1 level vocabulary.",
    "has_key": true
  },
  {
    "id": "wt_q64",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.days_months",
    "reason": "Days of the week and months. A1 level vocabulary.",
    "has_key": true
  },
  {
    "id": "wt_q65",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.collocation_take_make",
    "reason": "Collocation: take/make. A2 level vocabulary.",
    "has_key": true
  },
  {
    "id": "wt_q66",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.advanced_adjectives",
    "reason": "Advanced adjectives: meaning in context. C1 level vocabulary.",
    "has_key": true
  },
  {
    "id": "wt_q67",
    "question_type": "multiple_choice",
    "element_type": "vocabulary",
    "nano_skill": "ns.vocabulary.advanced_adjectives_character",
    "reason": "Advanced adjectives: character. C1 level vocabulary.",
    "has_key": true
  },
  {
    "id": "wt_q68",
    "question_type": "multiple_choice",
    "element_type": "reading",
    "nano_skill": "ns.reading.find_specific_information",
    "reason": "Reading: finding specific information. A2 level.",
    "has_key": true
  },
  {
    "id": "wt_q69",
    "question_type": "multiple_choice",
    "element_type": "reading",
    "nano_skill": "ns.reading.understand_email_requests",
    "reason": "Reading: understanding requests and offers in an email. B1 level.",
    "has_key": true
  },
  {
    "id": "wt_q70",
    "question_type": "multiple_choice",
    "element_type": "reading",
    "nano_skill": "ns.reading.inference",
    "reason": "Reading: inference from a connected argument. C1 level.",
    "has_key": true
  },
  {
    "id": "wt_q71",
    "question_type": "listening_comprehension",
    "element_type": "listening",
    "nano_skill": "ns.listening.detail_extraction",
    "reason": "Listening: detail extraction (a time). A2 level.",
    "has_key": true
  },
  {
    "id": "wt_q72",
    "question_type": "listening_comprehension",
    "element_type": "listening",
    "nano_skill": "ns.listening.reasons_and_attitude",
    "reason": "Listening: understanding reasons across a conversation. B2 level.",
    "has_key": true
  }
];
