/**
 * GENERATED from src/lib/welcomeTest/seed.ts (bank 2, form A) by
 * scripts/welcomeTest/generate-seed-bank.ts. Do not edit by hand: the
 * parity test (welcomeTestSeedParity.test.ts) fails when it drifts.
 */
export interface WelcomeTestSeedRow {
  question_index: number;
  question_type: string;
  question_text: string;
  question_data: { options?: string[]; question_id: string };
  correct_answer: string | string[];
  explanation: string | null;
  element_type: string | null;
  difficulty_level: number;
  skill_tags: string[];
}

export const WELCOME_TEST_SEED_BANK_2A: readonly WelcomeTestSeedRow[] = [
  {
    "question_index": 0,
    "question_type": "self_assessment",
    "question_text": "How would you describe your English right now?",
    "question_data": {
      "options": [
        "I can do basic things, like ordering food or asking for directions",
        "I can have simple talks about everyday topics, but harder ideas are tough",
        "I can talk about most topics, but I make grammar mistakes and miss some words",
        "I speak fluently most of the time, but I want to sound more natural",
        "I feel comfortable in English, but I want to master advanced or work language"
      ],
      "question_id": "wt_q1"
    },
    "correct_answer": "",
    "explanation": "Pick the option that fits you best today.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 1,
    "question_type": "preference_choice",
    "question_text": "When you speak English, what frustrates you the most?",
    "question_data": {
      "options": [
        "I know what I want to say but can't find the right words",
        "I make grammar mistakes that I know are wrong",
        "I can't understand native speakers when they talk fast",
        "I feel nervous and forget everything I know",
        "I can't express complex ideas - I simplify too much",
        "My pronunciation makes people ask me to repeat"
      ],
      "question_id": "wt_q2"
    },
    "correct_answer": "",
    "explanation": "Select all that apply.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 2,
    "question_type": "preference_choice",
    "question_text": "What is your main reason for learning English?",
    "question_data": {
      "options": [
        "I need it for work: meetings, emails, presentations",
        "I am preparing for an exam (IELTS, Cambridge, etc.)",
        "I want to travel and talk freely",
        "I want to watch films and read books without subtitles",
        "I want to feel confident with English speakers",
        "I want a promotion that needs English",
        "I am moving to an English-speaking country"
      ],
      "question_id": "wt_q3"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 3,
    "question_type": "preference_choice",
    "question_text": "Where do you use (or want to use) English the most?",
    "question_data": {
      "options": [
        "At work - emails, meetings, calls",
        "Traveling - airports, hotels, restaurants",
        "Online - social media, forums, gaming",
        "With friends/family who speak English",
        "Consuming content - movies, books, podcasts",
        "In my professional field (medical, legal, IT, etc.)"
      ],
      "question_id": "wt_q3b"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 4,
    "question_type": "scenario_reaction",
    "question_text": "Imagine you wake up 2 years from now and your English is amazing. Which scenario would feel MOST satisfying?",
    "question_data": {
      "options": [
        "I confidently lead meetings with international clients",
        "I watch Netflix shows without subtitles, effortlessly",
        "I feel like a local when I travel anywhere in the world",
        "I got promoted to a position that requires English",
        "I read books in the original language for pleasure"
      ],
      "question_id": "wt_q3c"
    },
    "correct_answer": "",
    "explanation": "Pick the one that genuinely feels most rewarding; not the one that sounds most impressive.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 5,
    "question_type": "scenario_reaction",
    "question_text": "How do you usually react when you don't understand something in English?",
    "question_data": {
      "options": [
        "I ask the person to repeat or explain",
        "I pretend I understood and hope for the best",
        "I try to guess from context",
        "I get stressed and switch to my language",
        "I look it up immediately on my phone"
      ],
      "question_id": "wt_q4"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 6,
    "question_type": "preference_choice",
    "question_text": "How much time can you realistically spend on English per week (outside lessons)?",
    "question_data": {
      "options": [
        "Almost none - I only have lesson time",
        "15-30 minutes a few times a week",
        "About 1 hour spread across the week",
        "2-3 hours - I'm committed",
        "More than 3 hours - English is my priority"
      ],
      "question_id": "wt_q5"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 7,
    "question_type": "scenario_reaction",
    "question_text": "Imagine this: your boss just told you that in 3 weeks, you'll need to lead a meeting in English with international clients. How do you react?",
    "question_data": {
      "options": [
        "I'd panic at first, but then prepare intensively every day until the meeting",
        "I'd feel nervous but would ask a colleague for help and practice the key phrases",
        "I'd ask to postpone or let someone else handle it",
        "I'd feel fairly confident - I'd just review some vocabulary beforehand"
      ],
      "question_id": "wt_q5b"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 8,
    "question_type": "scenario_reaction",
    "question_text": "It's Wednesday evening. You had a tough day at work, and you have your English homework due tomorrow. What usually happens?",
    "question_data": {
      "options": [
        "I do it quickly just to get it off my plate",
        "I do it carefully, even if it takes an hour",
        "I message the teacher that I didn't make it and will do it later",
        "I start it but stop after about 10 minutes",
        "I already did it earlier; I don't leave things until the last minute"
      ],
      "question_id": "wt_q5c"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 9,
    "question_type": "preference_choice",
    "question_text": "Which learning activities do you enjoy? Pick all that apply.",
    "question_data": {
      "options": [
        "Watching videos or films in English",
        "Reading articles or books",
        "Having conversations",
        "Doing grammar exercises",
        "Learning new words with flashcards",
        "Listening to podcasts",
        "Writing texts (emails, stories)",
        "Playing language games or quizzes",
        "Singing English songs"
      ],
      "question_id": "wt_q6"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 10,
    "question_type": "self_assessment",
    "question_text": "How do you feel about making mistakes in English?",
    "question_data": {
      "options": [
        "I do not mind; that is how you learn",
        "I prefer not to, but I can handle it",
        "I feel shy, but I keep going",
        "I avoid speaking because I fear mistakes",
        "I get very frustrated with myself"
      ],
      "question_id": "wt_q7"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 11,
    "question_type": "preference_choice",
    "question_text": "When you make a mistake while speaking, how do you want your teacher to react?",
    "question_data": {
      "options": [
        "Correct me immediately: I want to know right away",
        "Take notes and tell me after I finish my thought",
        "Only correct serious mistakes, small ones discourage me",
        "Explain the rule every time I make a mistake",
        "Send me a written summary after the lesson"
      ],
      "question_id": "wt_q7b"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 12,
    "question_type": "preference_choice",
    "question_text": "When you learn a new word, what helps you remember it best?",
    "question_data": {
      "options": [
        "Seeing it written down with a definition",
        "Hearing it in a sentence",
        "Using it in my own sentence right away",
        "Connecting it to a picture or image",
        "Repeating it many times",
        "Understanding the word parts (prefix, root, suffix)"
      ],
      "question_id": "wt_q8"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 13,
    "question_type": "preference_choice",
    "question_text": "How long have you been learning English?",
    "question_data": {
      "options": [
        "Less than 1 year",
        "1-3 years",
        "3-5 years",
        "5-10 years",
        "More than 10 years"
      ],
      "question_id": "wt_q9"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 14,
    "question_type": "preference_choice",
    "question_text": "Where have you mainly learned English so far?",
    "question_data": {
      "options": [
        "School (as a subject)",
        "University",
        "Private lessons with a teacher",
        "Language school/course",
        "Self-study (apps, books, YouTube)",
        "Living/working in an English-speaking country",
        "Through work (using English daily)"
      ],
      "question_id": "wt_q10"
    },
    "correct_answer": "",
    "explanation": "Select all that apply.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 15,
    "question_type": "preference_choice",
    "question_text": "Have you ever taken an official English exam?",
    "question_data": {
      "options": [
        "No, never",
        "Yes - school/university exam",
        "Yes - Cambridge (FCE/CAE/CPE)",
        "Yes - IELTS",
        "Yes - TOEFL",
        "Yes - other"
      ],
      "question_id": "wt_q11"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 16,
    "question_type": "open_reflection",
    "question_text": "What's the biggest challenge you've faced learning English?",
    "question_data": {
      "question_id": "wt_q12"
    },
    "correct_answer": "",
    "explanation": "In 1-2 sentences, describe your biggest frustration or challenge with English.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 17,
    "question_type": "open_reflection",
    "question_text": "Is there anything specific your previous teachers did that worked really well for you?",
    "question_data": {
      "question_id": "wt_q13"
    },
    "correct_answer": "",
    "explanation": "Tell us what methods or approaches helped you learn best.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 18,
    "question_type": "scenario_reaction",
    "question_text": "Think about the last time you tried to learn something new (not English - anything: cooking, a sport, a skill). What happened?",
    "question_data": {
      "options": [
        "I stuck with it and got pretty good at it",
        "I practiced for a while but eventually moved on to something else",
        "I started enthusiastically but lost motivation after a few weeks",
        "I'm still learning it - I haven't given up yet"
      ],
      "question_id": "wt_q13b"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 19,
    "question_type": "scenario_reaction",
    "question_text": "You've been studying English for 6 months and you feel like you're not improving. What do you do?",
    "question_data": {
      "options": [
        "Push harder: more hours, more material",
        "Change the method, teacher, or approach",
        "Take a break for a week or two",
        "Accept the plateau as part of the process and keep going",
        "Start to doubt whether this is really for me"
      ],
      "question_id": "wt_q13c"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 20,
    "question_type": "scenario_reaction",
    "question_text": "You're at a coffee shop abroad. The barista asks you something you don't fully understand. What do you do?",
    "question_data": {
      "options": [
        "I say \"Sorry, could you repeat that please?\" and try again",
        "I just point at the menu and smile",
        "I use Google Translate on my phone",
        "I answer with what I think they asked"
      ],
      "question_id": "wt_q14"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 21,
    "question_type": "scenario_reaction",
    "question_text": "Your English-speaking colleague sends you a long email about a project. Some parts are unclear. What do you do?",
    "question_data": {
      "options": [
        "I read it carefully, look up unknown words, and reply",
        "I reply asking them to clarify the confusing parts",
        "I understand most of it and guess the rest from context",
        "I struggle to understand and need to translate most of it",
        "I don't try to understand, I use ChatGPT"
      ],
      "question_id": "wt_q15"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 22,
    "question_type": "open_ended",
    "question_text": "You need to describe a problem with your hotel room to the reception.",
    "question_data": {
      "question_id": "wt_q16"
    },
    "correct_answer": "",
    "explanation": "Write 2-3 sentences explaining that your room's air conditioning isn't working and you'd like it fixed or to change rooms.",
    "element_type": "writing",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.writing.complaint_register"
    ]
  },
  {
    "question_index": 23,
    "question_type": "open_ended",
    "question_text": "You're in a job interview and they ask \"Tell me about a challenge you've faced at work.\" How would you answer?",
    "question_data": {
      "question_id": "wt_q17"
    },
    "correct_answer": "",
    "explanation": "Write 3-4 sentences as if you're actually in the interview.",
    "element_type": "writing",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.writing.formal_narrative"
    ]
  },
  {
    "question_index": 24,
    "question_type": "scenario_reaction",
    "question_text": "You see a perfect job posting that matches your skills exactly, but it requires \"fluent English.\" What goes through your mind?",
    "question_data": {
      "options": [
        "This is exactly why I'm learning English - I need to be ready for opportunities like this",
        "I'd apply anyway and hope my English improves by the time they interview me",
        "I'd skip it - I'm not learning English for work reasons",
        "I'd apply and highlight my other strengths to compensate for my English"
      ],
      "question_id": "wt_q17b"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 25,
    "question_type": "multiple_choice",
    "question_text": "Read this short dialogue and answer the question below.\n\nA: \"Hi, I tried logging in this morning, but the system kept saying my password was wrong.\"\nB: \"I see: and did you try the reset link?\"\nA: \"Yes, three times. The reset email never arrived, and now I am locked out completely.\"\nB: \"Okay, that explains it. I will create a new account for you and migrate your old data this afternoon.\"\n\nWhat will B do to solve A's problem?",
    "question_data": {
      "options": [
        "Send another password reset email",
        "Unlock the existing account",
        "Create a new account and move A's data",
        "Schedule a call with technical support"
      ],
      "question_id": "wt_q18"
    },
    "correct_answer": "Create a new account and move A's data",
    "explanation": null,
    "element_type": "reading",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.reading.identify_main_idea"
    ]
  },
  {
    "question_index": 26,
    "question_type": "multiple_choice",
    "question_text": "Read this text and answer the question below:\n\n\"According to a recent study, more than 60% of employees prefer a hybrid work model, combining remote and office work. Researchers found that this arrangement not only improves work-life balance but also increases productivity by up to 15%. However, managers report challenges in maintaining team cohesion and ensuring equal opportunities for career advancement among remote and in-office workers.\"\n\nWhat does the author suggest is the main benefit of hybrid work?",
    "question_data": {
      "options": [
        "It saves companies money on office space",
        "It improves work-life balance and productivity",
        "It makes managers' jobs easier",
        "It eliminates the need for offices"
      ],
      "question_id": "wt_q19"
    },
    "correct_answer": "It improves work-life balance and productivity",
    "explanation": null,
    "element_type": "reading",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.reading.inference_from_text"
    ]
  },
  {
    "question_index": 27,
    "question_type": "speaking_record",
    "question_text": "Describe a problem with your hotel room, speaking task.\n\nImagine you are at the reception. Pick one problem (broken AC, dirty bathroom, loud neighbours, missing towels) and record yourself explaining it and asking for help.",
    "question_data": {
      "question_id": "wt_q16s"
    },
    "correct_answer": "",
    "explanation": "Record up to 60 seconds. Speak naturally: fluency and pronunciation matter more than perfect grammar.",
    "element_type": "speaking",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.speaking.complaint_oral"
    ]
  },
  {
    "question_index": 28,
    "question_type": "listening_comprehension",
    "question_text": "Listen to the conversation and answer: when did the customer finally book a table?",
    "question_data": {
      "options": [
        "Saturday at eight",
        "Saturday at nine thirty",
        "Friday at seven",
        "Friday at nine thirty"
      ],
      "question_id": "wt_q18l"
    },
    "correct_answer": "Friday at seven",
    "explanation": null,
    "element_type": "listening",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.listening.detail_extraction"
    ]
  },
  {
    "question_index": 29,
    "question_type": "fill_blank",
    "question_text": "She ___ (go) to the gym every morning.",
    "question_data": {
      "question_id": "wt_q20"
    },
    "correct_answer": "goes",
    "explanation": "Write the correct form of the verb in brackets.",
    "element_type": "grammar",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.grammar.present_simple_third_person"
    ]
  },
  {
    "question_index": 30,
    "question_type": "fill_blank",
    "question_text": "I ___ (study) English for three years.",
    "question_data": {
      "question_id": "wt_q21"
    },
    "correct_answer": [
      "have been studying",
      "have studied"
    ],
    "explanation": "Write the correct form of the verb in brackets. The action started in the past and continues now.",
    "element_type": "grammar",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.grammar.present_perfect_continuous"
    ]
  },
  {
    "question_index": 31,
    "question_type": "multiple_choice",
    "question_text": "If I ___ earlier, I wouldn't have missed the train.",
    "question_data": {
      "options": [
        "leave",
        "left",
        "had left",
        "would leave"
      ],
      "question_id": "wt_q22"
    },
    "correct_answer": "had left",
    "explanation": "Pick the correct form. This is an unreal situation about the past.",
    "element_type": "grammar",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.grammar.third_conditional"
    ]
  },
  {
    "question_index": 32,
    "question_type": "multiple_choice",
    "question_text": "The report ___ by the team last week.",
    "question_data": {
      "options": [
        "wrote",
        "was written",
        "has written",
        "is written"
      ],
      "question_id": "wt_q23"
    },
    "correct_answer": "was written",
    "explanation": null,
    "element_type": "grammar",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.grammar.passive_voice_past"
    ]
  },
  {
    "question_index": 33,
    "question_type": "multiple_choice",
    "question_text": "Find the error: \"She don't like coffee.\"",
    "question_data": {
      "options": [
        "She doesn't like coffee.",
        "She didn't like coffee.",
        "She not like coffee.",
        "She isn't like coffee."
      ],
      "question_id": "wt_q24"
    },
    "correct_answer": "She doesn't like coffee.",
    "explanation": "Choose the corrected version.",
    "element_type": "grammar",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.grammar.negative_third_person"
    ]
  },
  {
    "question_index": 34,
    "question_type": "multiple_choice",
    "question_text": "Find the error: \"I have went to London last year.\"",
    "question_data": {
      "options": [
        "I went to London last year.",
        "I have gone to London last year.",
        "I have been to London last year.",
        "I was went to London last year."
      ],
      "question_id": "wt_q25"
    },
    "correct_answer": "I went to London last year.",
    "explanation": "Choose the corrected version.",
    "element_type": "grammar",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.grammar.past_simple_vs_present_perfect"
    ]
  },
  {
    "question_index": 35,
    "question_type": "fill_blank",
    "question_text": "\"It started raining two hours ago.\"\n\nComplete the sentence: It ___ for two hours.",
    "question_data": {
      "question_id": "wt_q26"
    },
    "correct_answer": "has been raining",
    "explanation": "Fill in the blank to rewrite the sentence using the correct tense. Write only the missing words.",
    "element_type": "grammar",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.grammar.sentence_transformation_ppc"
    ]
  },
  {
    "question_index": 36,
    "question_type": "fill_blank",
    "question_text": "\"People say he is very smart.\"\n\nComplete the sentence: He ___ very smart.",
    "question_data": {
      "question_id": "wt_q27"
    },
    "correct_answer": "is said to be",
    "explanation": "Fill in the blank to rewrite using a passive construction. Write only the missing words.",
    "element_type": "grammar",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.grammar.passive_reporting"
    ]
  },
  {
    "question_index": 37,
    "question_type": "multiple_choice",
    "question_text": "Can you ___ me a favour?",
    "question_data": {
      "options": [
        "do",
        "make",
        "give",
        "take"
      ],
      "question_id": "wt_q28"
    },
    "correct_answer": "do",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.vocabulary.collocation_do_make"
    ]
  },
  {
    "question_index": 38,
    "question_type": "multiple_choice",
    "question_text": "She ___ a deep breath before speaking.",
    "question_data": {
      "options": [
        "took",
        "made",
        "did",
        "got"
      ],
      "question_id": "wt_q29"
    },
    "correct_answer": "took",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.vocabulary.collocation_take"
    ]
  },
  {
    "question_index": 39,
    "question_type": "fill_blank",
    "question_text": "The ___ (decide) was made yesterday.",
    "question_data": {
      "question_id": "wt_q30"
    },
    "correct_answer": "decision",
    "explanation": "Write the correct NOUN form of the word in brackets. Example: \"arrive\" → \"arrival\".",
    "element_type": "vocabulary",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.vocabulary.word_formation_noun"
    ]
  },
  {
    "question_index": 40,
    "question_type": "fill_blank",
    "question_text": "He spoke very ___ (confident).",
    "question_data": {
      "question_id": "wt_q31"
    },
    "correct_answer": "confidently",
    "explanation": "Write the correct form of the word in brackets.",
    "element_type": "vocabulary",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.vocabulary.word_formation_adverb"
    ]
  },
  {
    "question_index": 41,
    "question_type": "multiple_choice",
    "question_text": "The deadline is really tight. We need to ___ up.",
    "question_data": {
      "options": [
        "hurry",
        "run",
        "go",
        "move"
      ],
      "question_id": "wt_q32"
    },
    "correct_answer": "hurry",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.vocabulary.phrasal_verb_contextual"
    ]
  },
  {
    "question_index": 42,
    "question_type": "multiple_choice",
    "question_text": "She was absolutely ___ when she heard she got the job.",
    "question_data": {
      "options": [
        "thrilled",
        "sad",
        "angry",
        "bored"
      ],
      "question_id": "wt_q33"
    },
    "correct_answer": "thrilled",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.vocabulary.extreme_adjectives"
    ]
  },
  {
    "question_index": 43,
    "question_type": "multiple_choice",
    "question_text": "What does \"break the ice\" mean?",
    "question_data": {
      "options": [
        "To damage something frozen",
        "To make people feel more comfortable in a social situation",
        "To start an argument",
        "To solve a difficult problem"
      ],
      "question_id": "wt_q34"
    },
    "correct_answer": "To make people feel more comfortable in a social situation",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.vocabulary.idiom_comprehension"
    ]
  },
  {
    "question_index": 44,
    "question_type": "multiple_choice",
    "question_text": "When she heard the price, she said \"That costs ___!\"",
    "question_data": {
      "options": [
        "an arm and a leg",
        "a hand and a foot",
        "an eye and a tooth",
        "a finger and a toe"
      ],
      "question_id": "wt_q35"
    },
    "correct_answer": "an arm and a leg",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.vocabulary.idiom_production"
    ]
  },
  {
    "question_index": 45,
    "question_type": "open_ended",
    "question_text": "How would you politely decline an invitation to a colleague's party?",
    "question_data": {
      "question_id": "wt_q36"
    },
    "correct_answer": "",
    "explanation": "Write 1-2 sentences.",
    "element_type": "writing",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.writing.pragmatic_declining"
    ]
  },
  {
    "question_index": 46,
    "question_type": "speaking_record",
    "question_text": "Now record yourself declining the invitation verbally.\n\nImagine your colleague just invited you. Speak naturally as if you're talking to them.",
    "question_data": {
      "question_id": "wt_q36s"
    },
    "correct_answer": "",
    "explanation": "Record up to 45 seconds. Be polite but clear.",
    "element_type": "speaking",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.speaking.pragmatic_declining_oral"
    ]
  },
  {
    "question_index": 47,
    "question_type": "open_ended",
    "question_text": "Rewrite this sentence to sound more formal:\n\n\"Hey, just wanted to check if you got my email about the meeting thing.\"",
    "question_data": {
      "question_id": "wt_q37"
    },
    "correct_answer": "",
    "explanation": "Write the formal version.",
    "element_type": "writing",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.writing.register_shift"
    ]
  },
  {
    "question_index": 48,
    "question_type": "multiple_choice",
    "question_text": "Which of these sounds most natural?",
    "question_data": {
      "options": [
        "I want that you help me",
        "I want you to help me",
        "I want you help me",
        "I want for you to help me"
      ],
      "question_id": "wt_q38"
    },
    "correct_answer": "I want you to help me",
    "explanation": null,
    "element_type": "grammar",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.grammar.verb_pattern_want"
    ]
  },
  {
    "question_index": 49,
    "question_type": "scenario_reaction",
    "question_text": "You need to explain why you were late to a meeting. Choose the best response:",
    "question_data": {
      "options": [
        "Sorry I'm late. Traffic.",
        "I apologize for being late. There was an accident on the highway.",
        "I'm so sorry for the delay. Unfortunately, there was a major traffic jam due to an accident. I left early but couldn't avoid it.",
        "My deepest apologies for this unacceptable tardiness."
      ],
      "question_id": "wt_q39"
    },
    "correct_answer": "I'm so sorry for the delay. Unfortunately, there was a major traffic jam due to an accident. I left early but couldn't avoid it.",
    "explanation": null,
    "element_type": "writing",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.writing.pragmatic_appropriacy"
    ]
  },
  {
    "question_index": 50,
    "question_type": "open_reflection",
    "question_text": "Read these two versions. Which sounds better and why?\n\nVersion A: \"The meeting was good. We talked about the project. Everyone agreed.\"\n\nVersion B: \"The meeting went well - we discussed the project timeline and reached a consensus on the next steps.\"",
    "question_data": {
      "question_id": "wt_q40"
    },
    "correct_answer": "",
    "explanation": "Which version sounds better to you and why? Write 1 sentence.",
    "element_type": "writing",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.writing.discourse_quality_awareness"
    ]
  },
  {
    "question_index": 51,
    "question_type": "open_reflection",
    "question_text": "If you could achieve ONE thing in English in the next 3 months, what would it be?",
    "question_data": {
      "question_id": "wt_q41"
    },
    "correct_answer": "",
    "explanation": "Write freely - there are no wrong answers.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 52,
    "question_type": "scenario_reaction",
    "question_text": "Which of these situations is closest to yours right now?",
    "question_data": {
      "options": [
        "I have a specific event coming up soon where I need English (trip, interview, presentation)",
        "I need English regularly for my work/life, and I want to get noticeably better in the next few months",
        "I'm learning English for the long term - there's no rush, but I want steady progress",
        "English is something I enjoy learning - it's more about personal growth than a specific need"
      ],
      "question_id": "wt_q41b"
    },
    "correct_answer": "",
    "explanation": "There are no right or wrong answers.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 53,
    "question_type": "speaking_record",
    "question_text": "Record a 30-second introduction of yourself in English.\n\nSay your name, what you do, and why you're learning English.",
    "question_data": {
      "question_id": "wt_q41s"
    },
    "correct_answer": "",
    "explanation": "Speak freely for up to 30 seconds. There's no right or wrong way!",
    "element_type": "speaking",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.speaking.self_introduction"
    ]
  },
  {
    "question_index": 54,
    "question_type": "preference_choice",
    "question_text": "How do you prefer to receive feedback on your mistakes?",
    "question_data": {
      "options": [
        "Correct me immediately, every time",
        "Note them down and discuss at the end",
        "Only correct major mistakes, ignore small ones",
        "Write corrections for me to review later",
        "I prefer to self-correct with hints"
      ],
      "question_id": "wt_q42"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 55,
    "question_type": "preference_choice",
    "question_text": "What topics interest you the most? Pick up to 3.",
    "question_data": {
      "options": [
        "Technology & Innovation",
        "Business & Finance",
        "Travel & Culture",
        "Health & Lifestyle",
        "Science & Nature",
        "Entertainment & Pop Culture",
        "Sports",
        "Food & Cooking",
        "Psychology & Self-improvement",
        "Politics & Current Events",
        "Art & Literature",
        "History"
      ],
      "question_id": "wt_q43"
    },
    "correct_answer": "",
    "explanation": null,
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 56,
    "question_type": "self_assessment_matrix",
    "question_text": "How would you rate your confidence in these areas?",
    "question_data": {
      "question_id": "wt_q44"
    },
    "correct_answer": "",
    "explanation": "Rate each area from 1 (not confident) to 5 (very confident).",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 57,
    "question_type": "open_reflection",
    "question_text": "Is there anything else you'd like your teacher to know about you or your learning?",
    "question_data": {
      "question_id": "wt_q45"
    },
    "correct_answer": "",
    "explanation": "This is optional - write anything you think might be helpful.",
    "element_type": null,
    "difficulty_level": 3,
    "skill_tags": []
  },
  {
    "question_index": 58,
    "question_type": "fill_blank",
    "question_text": "My brother ___ a doctor.",
    "question_data": {
      "question_id": "wt_q59"
    },
    "correct_answer": "is",
    "explanation": "Write the correct word.",
    "element_type": "grammar",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.grammar.to_be_present_simple"
    ]
  },
  {
    "question_index": 59,
    "question_type": "multiple_choice",
    "question_text": "___ you like coffee?",
    "question_data": {
      "options": [
        "Do",
        "Does",
        "Are",
        "Is"
      ],
      "question_id": "wt_q60"
    },
    "correct_answer": "Do",
    "explanation": null,
    "element_type": "grammar",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.grammar.present_simple_questions"
    ]
  },
  {
    "question_index": 60,
    "question_type": "multiple_choice",
    "question_text": "Rarely ___ such a well-organised presentation.",
    "question_data": {
      "options": [
        "have I seen",
        "I have seen",
        "did I saw",
        "I saw"
      ],
      "question_id": "wt_q61"
    },
    "correct_answer": "have I seen",
    "explanation": null,
    "element_type": "grammar",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.grammar.inversion_negative_adverbials"
    ]
  },
  {
    "question_index": 61,
    "question_type": "multiple_choice",
    "question_text": "If the board ___ the merger last year, we would not be facing these losses now.",
    "question_data": {
      "options": [
        "had not approved",
        "did not approve",
        "would not approve",
        "has not approved"
      ],
      "question_id": "wt_q62"
    },
    "correct_answer": "had not approved",
    "explanation": null,
    "element_type": "grammar",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.grammar.mixed_conditionals"
    ]
  },
  {
    "question_index": 62,
    "question_type": "multiple_choice",
    "question_text": "What do you wear on your feet?",
    "question_data": {
      "options": [
        "shoes",
        "gloves",
        "a hat",
        "a scarf"
      ],
      "question_id": "wt_q63"
    },
    "correct_answer": "shoes",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.vocabulary.everyday_clothes"
    ]
  },
  {
    "question_index": 63,
    "question_type": "multiple_choice",
    "question_text": "Monday, Tuesday, ___",
    "question_data": {
      "options": [
        "Wednesday",
        "January",
        "summer",
        "morning"
      ],
      "question_id": "wt_q64"
    },
    "correct_answer": "Wednesday",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.vocabulary.days_months"
    ]
  },
  {
    "question_index": 64,
    "question_type": "multiple_choice",
    "question_text": "I'm tired. I need to ___ a break.",
    "question_data": {
      "options": [
        "take",
        "make",
        "do",
        "get"
      ],
      "question_id": "wt_q65"
    },
    "correct_answer": "take",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.vocabulary.collocation_take_make"
    ]
  },
  {
    "question_index": 65,
    "question_type": "multiple_choice",
    "question_text": "The CEO's remarks were deliberately ___, so nobody could tell what she really thought.",
    "question_data": {
      "options": [
        "equivocal",
        "candid",
        "explicit",
        "emphatic"
      ],
      "question_id": "wt_q66"
    },
    "correct_answer": "equivocal",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.vocabulary.advanced_adjectives"
    ]
  },
  {
    "question_index": 66,
    "question_type": "multiple_choice",
    "question_text": "Her ___ attention to detail meant that not a single error escaped her.",
    "question_data": {
      "options": [
        "meticulous",
        "mediocre",
        "modest",
        "mutual"
      ],
      "question_id": "wt_q67"
    },
    "correct_answer": "meticulous",
    "explanation": null,
    "element_type": "vocabulary",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.vocabulary.advanced_adjectives_character"
    ]
  },
  {
    "question_index": 67,
    "question_type": "multiple_choice",
    "question_text": "Read the notice and answer the question below.\n\n\"The office will be closed on Friday 12 May because of building work. Please send urgent emails to the support team. The office will open again on Monday at 9:00.\"\n\nWhen will the office open again?",
    "question_data": {
      "options": [
        "Friday 12 May",
        "Monday at 9:00",
        "Saturday morning",
        "Tuesday at 9:00"
      ],
      "question_id": "wt_q68"
    },
    "correct_answer": "Monday at 9:00",
    "explanation": null,
    "element_type": "reading",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.reading.find_specific_information"
    ]
  },
  {
    "question_index": 68,
    "question_type": "multiple_choice",
    "question_text": "Read the email and answer the question below.\n\n\"Hi Marta, I'm afraid I can't make Thursday's meeting because my train was cancelled and the next one only arrives at 3 pm. Could we move it to Friday morning? If that is not possible, I can join online for the first half hour and Piotr can take notes for me afterwards. Let me know what works best. Thanks, Jan\"\n\nWhat does Jan offer to do if the meeting cannot move to Friday?",
    "question_data": {
      "options": [
        "Join online for the first half hour",
        "Send Piotr in his place",
        "Travel by car",
        "Cancel the meeting"
      ],
      "question_id": "wt_q69"
    },
    "correct_answer": "Join online for the first half hour",
    "explanation": null,
    "element_type": "reading",
    "difficulty_level": 2,
    "skill_tags": [
      "ns.reading.understand_email_requests"
    ]
  },
  {
    "question_index": 69,
    "question_type": "multiple_choice",
    "question_text": "Read the text and answer the question below.\n\n\"Although remote work is often praised for its flexibility, several studies suggest that its benefits are unevenly distributed. Employees with a dedicated home office report higher focus, whereas those in shared accommodation describe more interruptions and blurred boundaries between work and rest. Consequently, some employers who introduced blanket remote-work policies have since quietly reintroduced office days, not because productivity fell, but because they underestimated how unequally their staff could benefit.\"\n\nWhy did some employers reintroduce office days?",
    "question_data": {
      "options": [
        "Productivity fell significantly",
        "Employees asked for stricter supervision",
        "They realised the policy did not suit all employees equally",
        "The cost of home offices was too high"
      ],
      "question_id": "wt_q70"
    },
    "correct_answer": "They realised the policy did not suit all employees equally",
    "explanation": null,
    "element_type": "reading",
    "difficulty_level": 4,
    "skill_tags": [
      "ns.reading.inference"
    ]
  },
  {
    "question_index": 70,
    "question_type": "listening_comprehension",
    "question_text": "Listen to the conversation and answer: what time does the next bus to the airport leave?",
    "question_data": {
      "options": [
        "4:10",
        "4:15",
        "4:40",
        "3:10"
      ],
      "question_id": "wt_q71"
    },
    "correct_answer": "4:10",
    "explanation": null,
    "element_type": "listening",
    "difficulty_level": 1,
    "skill_tags": [
      "ns.listening.detail_extraction"
    ]
  },
  {
    "question_index": 71,
    "question_type": "listening_comprehension",
    "question_text": "Listen to the conversation and answer: why is the man hesitating?",
    "question_data": {
      "options": [
        "The salary in Lisbon is lower than he expected",
        "He would miss a product launch and a possible promotion",
        "The relocation package does not include rent",
        "His manager asked him to decide immediately"
      ],
      "question_id": "wt_q72"
    },
    "correct_answer": "He would miss a product launch and a possible promotion",
    "explanation": null,
    "element_type": "listening",
    "difficulty_level": 3,
    "skill_tags": [
      "ns.listening.reasons_and_attitude"
    ]
  }
];
