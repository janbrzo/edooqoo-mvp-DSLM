/**
 * Hand-written rewrites of blog articles that replace the generic x1000 refresh body.
 * Merged into ARTICLE_DETAIL_OVERRIDES (x1000-editorial-plan.mjs). Rules for every entry:
 *  - answer the query the URL already ranks for, for an adult 1:1 tutor;
 *  - product statements only from PRODUCTION behavior in docs/llm-context.md;
 *  - examples are constructed and say so; no invented statistics, studies, quotes or customers;
 *  - external sources only if they support the sentence they are attached to.
 * Pages must reach `verified` in `npm run seo:verify-content` before they get any quality label.
 */
const CEFR = ['Council of Europe: CEFR Companion Volume', 'https://www.coe.int/en/web/common-european-framework-reference-languages'];
const RETRIEVAL = ['Roediger and Karpicke: Test-Enhanced Learning (2006)', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x'];
const FORMATIVE = ['Black and Wiliam: Assessment and Classroom Learning (1998)', 'https://doi.org/10.1080/0969595980050102'];

export const ARTICLE_REWRITES = {
  'diagnostic-testing-english-learners': {
    h1: 'Diagnostic Testing for Adult English Learners',
    updated: '2026-10-05',
    keywords: ['diagnostic test English', 'placement test for private tutors', 'CEFR level check adult learner'],
    sources: [CEFR, FORMATIVE],
    directAnswer:
      'A diagnostic for an adult learner should answer one question: what should the next four lessons repair or build? Test the skills the learner needs for their real goal, keep it short enough to finish in one sitting, and read the result as a hypothesis about gaps, not as a final level label.',
    problem: [
      'A single placement score hides the pattern a tutor needs: a learner can read at B2 and still freeze when speaking on a call.',
      'Long tests tire adults who are paying for lesson time, and a tired learner under-performs, so the result understates their level.',
      'Many tutors run a test once, file it, and then plan from habit; the diagnostic never changes a lesson.',
    ],
    solution: [
      'Start from the goal: an interview, a client call, an exam date. List the two or three skills that goal depends on and diagnose those first.',
      'Mix receptive and productive items: some reading or listening to find the ceiling, and at least one short speaking or writing sample to find the working level.',
      'Record "I don\'t know" separately from wrong answers. A learner who admits a gap and one who guesses confidently need different next steps.',
      'Write the result as three lines: strongest skill, most blocking gap, first lesson target. Anything longer will not be used.',
      'Re-check after a block of lessons with a few of the same item types, so the change is visible to you and to the learner.',
    ],
    mechanics: [
      'Edooqoo has a teacher-issued Welcome Test for an individual student with grammar, vocabulary, reading, listening and speaking-recording sections; results feed the student profile and the learning roadmap the teacher reviews.',
      'The Welcome Test counts "I don\'t know" answers separately from wrong answers, and the teacher reads the summary before acting on it.',
      'A separate free browser CEFR level test on Edooqoo is an anonymous self-check for a learner; it is not the Welcome Test and does not store anything on a teacher account.',
    ],
    works: [
      'The learner is new and you need a starting point within the first one or two lessons.',
      'You teach recurring lessons and want evidence for what to plan, not a certificate.',
      'The learner has a deadline, so the diagnostic must focus on the skills that deadline needs.',
    ],
    notEnough: [
      'A certified result is required: only an accredited exam can supply it.',
      'The learner cannot yet read the test language at all, and the first lesson should be a conversation instead.',
      'You already hold recent, trustworthy evidence from live lessons; repeating a test adds nothing.',
    ],
    tutorDecision:
      'Before the second lesson, write the first lesson target in one sentence and name the evidence behind it; if you cannot name the evidence, shorten the diagnostic and gather it in the lesson instead.',
    example:
      'Constructed example. A B1 procurement manager has a supplier negotiation in five weeks. A 15-minute diagnostic shows solid reading, hesitant conditional forms in speaking, and three "I don\'t know" answers on hedging language. Lesson one targets hedged counter-offers ("We could consider...", "If you were able to...") and the first homework revisits those items. After four lessons the same short speaking task is repeated and compared with the first.',
    faqs: [
      ['How long should an adult diagnostic take?', 'Aim for what the learner can finish in one sitting without fatigue, usually 15 to 30 minutes, then add live speaking observation in the first lesson.'],
      ['Is a diagnostic the same as a CEFR level?', 'No. The CEFR describes proficiency levels; a classroom diagnostic estimates where a learner is on the skills that matter for their goal and should not be reported as an official level.'],
      ['Should I diagnose speaking in a written test?', 'No. Use a short recorded or live speaking task, because grammar accuracy on paper does not predict spoken fluency.'],
      ['How often should I re-test?', 'Re-check a few of the same item types after a block of lessons rather than repeating the whole test.'],
    ],
  },

  'fill-in-the-blanks-exercises-best-practices': {
    h1: 'Fill-in-the-Blanks Exercises: How to Design Them',
    updated: '2026-10-05',
    keywords: ['fill in the blanks exercises', 'gap fill design', 'cloze exercise adult learners'],
    sources: [RETRIEVAL],
    directAnswer:
      'A good fill-in-the-blanks exercise tests one decision per gap in a context the learner recognises. Remove words that carry the target form, keep the surrounding sentence natural, and make sure each gap has one defensible answer or an answer key that lists the accepted variants.',
    problem: [
      'Gaps that delete random words test reading guesswork, not the grammar or vocabulary you wanted to practise.',
      'Sentences written only to fit the gap sound unnatural, so adults dismiss the task as a school drill.',
      'Answer keys with a single form mark acceptable variants wrong ("do not" versus "don\'t"), which wastes lesson time on arguments.',
    ],
    solution: [
      'One decision per gap: the learner chooses a tense, a preposition or a collocation, not all three at once.',
      'Use language from the learner\'s own work: an email they sent, a meeting they run, a procedure they follow.',
      'Keep a word bank only when the aim is vocabulary recall; remove it when the aim is production.',
      'List accepted variants in the key before the lesson, including contractions and common synonyms.',
      'End with a free-production line: one sentence the learner writes without a gap, using the same form.',
    ],
    mechanics: [
      'Edooqoo generates fill-in-the-blanks and gap-fill exercises as editable worksheets, so the tutor can change a sentence, a gap or the key before using it.',
      'Text answers are checked by one shared matcher that handles contractions, typographic apostrophes and multi-variant keys; when it is not certain, the item is marked for teacher review instead of wrong.',
    ],
    works: [
      'You are practising a form the learner already half-controls and needs to automate.',
      'The learner will meet the same form again in a task within days, so retrieval has a purpose.',
      'You can review accepted variants quickly and decide ambiguous answers yourself.',
    ],
    notEnough: [
      'The learner cannot yet produce the form at all; explain or model it first.',
      'The goal is fluency under time pressure, which gap tasks do not train.',
      'The text is generic enough to fit any learner; replace it with their own language.',
    ],
    tutorDecision:
      'After a gap task, sort the errors into form, meaning and carelessness, and plan the next task only for the form errors.',
    example:
      'Constructed example. An accountant writes weekly variance emails. The tutor takes three sentences from her real emails and blanks the linking phrase in each ("due to", "as a result of", "despite"). Two gaps accept more than one answer, so the key lists both. She gets two wrong, both on "despite", and next lesson starts with five new "despite" sentences about her own figures.',
    faqs: [
      ['How many gaps should one exercise have?', 'Six to ten is enough for one decision type; more gaps usually means more than one decision is being tested at once.'],
      ['Should I give a word bank?', 'Give one when the aim is vocabulary recall; leave it out when the aim is production, because a bank turns production into matching.'],
      ['What if two answers are both correct?', 'Add both to the key before the lesson and say in the instructions that more than one answer may be accepted.'],
      ['Why does retrieval matter here?', 'Producing a form from memory strengthens it more than re-reading it, which is the finding reported in test-enhanced learning research.'],
    ],
  },

  'connected-speech-teaching-activities': {
    h1: 'Connected Speech Activities for Adult Learners',
    updated: '2026-10-05',
    keywords: ['connected speech activities', 'linking and elision', 'pronunciation for adult learners'],
    sources: [CEFR],
    directAnswer:
      'Teach connected speech as a listening skill first and a speaking skill second. Adults understand more once they can hear linking, weak forms and elision in real recordings, and they speak more clearly once they copy a few high-frequency patterns inside whole phrases rather than isolated sounds.',
    problem: [
      'Learners who read well often cannot follow natural speech because words they know arrive reduced and joined.',
      'Pronunciation drills on single words do not transfer; the learner sounds careful in the lesson and unclear in a meeting.',
      'Tutors avoid the topic because phonemic charts feel technical, so the learner never hears what is happening.',
    ],
    solution: [
      'Dictation of reduced phrases: play a short recording of "what do you want to" and have the learner write what they hear, then compare with the written form.',
      'Chunk shadowing: the learner repeats a three-to-five word phrase from the recording together with it, matching rhythm before sounds.',
      'Mark linking by hand: draw a link between the final consonant and the next vowel in a transcript the learner already knows.',
      'Reverse the task: the learner records a work phrase, listens back, and marks one place where the words did not join.',
      'Limit scope: pick three patterns the learner\'s own speech lacks, not the whole inventory.',
      'Tutor review of recordings matters: listen to the clip first and mark where you expect the reduction before the learner hears it.',
    ],
    mechanics: [
      'Edooqoo worksheets can include listening and pronunciation exercise types, and the teacher can edit the text before using it with the learner.',
      'Speaking homework can be recorded by the student and reviewed by the teacher; AI-assisted evaluation of answers is shown to the teacher as a signal, not as a final grade.',
    ],
    works: [
      'The learner understands slow, careful speech but struggles with calls, meetings or videos.',
      'The learner\'s speech is accurate but sounds effortful or very syllable-timed.',
      'You can use short recordings from the learner\'s own work context.',
    ],
    notEnough: [
      'The learner has an intelligibility problem in individual sounds; work on those sounds first.',
      'The target is an exam speaking test with a fixed rubric; add format practice.',
      'You have no audio of natural speech; dictation from a read-aloud text will not show reduction.',
    ],
    tutorDecision:
      'Choose connected speech work only when the learner can say the words clearly in isolation but fails to understand or produce them at natural speed.',
    example:
      'Constructed example. A project manager understands slides but loses the thread when colleagues speak fast on video calls. The tutor plays six short phrases from a recorded stand-up ("kind of", "going to", "ask him about it"), has her write what she hears, and compares with the script. Her home task: record one sentence from her own update and mark where two words should join.',
    faqs: [
      ['Is connected speech only for advanced learners?', 'No. Beginners benefit from hearing a few high-frequency reductions, but explanation should stay minimal and practice should use whole phrases.'],
      ['Do I need phonetic symbols?', 'Not necessarily; marking links with a pen on an ordinary transcript works for most adults.'],
      ['How much lesson time should this take?', 'Ten minutes within a lesson, repeated over several lessons, usually works better than a single long session.'],
      ['Should the learner imitate native rhythm exactly?', 'The goal is intelligibility and comprehension, not an accent; the CEFR describes phonological control in terms of clarity.'],
    ],
  },

  'current-events-esl-lessons': {
    h1: 'Current Events Lessons for Adult ESL Learners',
    updated: '2026-10-05',
    keywords: ['current events ESL lesson', 'news articles adult English', 'discussion lesson plan'],
    sources: [CEFR],
    directAnswer:
      'Use current events with adult learners when the story connects to their work or interests, and design the lesson around one language outcome: summarise, give an opinion, or explain a cause. Pick a short text, pre-teach few words, and finish with the learner using the language to explain the story to someone who has not read it.',
    problem: [
      'News texts are written for native readers and carry dense vocabulary, so a lesson turns into translating words.',
      'Topics go stale or turn into arguments the learner does not want to have with a tutor.',
      'Without an outcome, the lesson becomes conversation with no evidence about what improved.',
    ],
    solution: [
      'Choose by relevance: a story about their industry, their city or a product they use, not the day\'s biggest headline.',
      'Pre-teach no more than six items the learner needs to express the story, and let them guess the rest from context.',
      'Set the task before reading: "Tell me in three sentences what happened and why it matters."',
      'After reading, add one productive step: give an opinion with a reason, or predict what happens next using modals of probability.',
      'Close with a retell to a third party (an email to a colleague) so the language is used, not only recognised.',
      'Teacher review comes first: read the text and any generated questions yourself, and cut anything you would not say to this learner.',
    ],
    mechanics: [
      'Edooqoo worksheets can be built from a topic, a lesson goal and a CEFR level, with reading comprehension and open-question exercise types the tutor edits before the lesson.',
      'Vocabulary from the lesson can be imported into flashcard sets, which use spaced repetition for review.',
    ],
    works: [
      'The learner reads English news or work updates already and wants to discuss them.',
      'You can choose the text per learner rather than for a group.',
      'There is a follow-up lesson where the same vocabulary can be reused.',
    ],
    notEnough: [
      'The learner is below the level at which short news texts can be followed with support.',
      'The topic is sensitive for the learner or for you; choose another story.',
      'The goal is a specific exam task that needs its own format practice.',
    ],
    tutorDecision:
      'After the lesson, write which three words the learner produced on their own; if none, the text was too hard or the task too receptive.',
    example:
      'Constructed example. A logistics coordinator follows port delays. The tutor selects a short report about a delay, pre-teaches "backlog", "disruption" and "reroute", and asks for a three-sentence summary. The follow-up is a two-line email to her manager explaining the likely effect on her shipments.',
    faqs: [
      ['How long should a news text be for one lesson?', 'Keep it to about 200 to 300 words for intermediate adults, and cut it if reading takes more than a third of the lesson.'],
      ['Where should I find texts?', 'Use sources the learner already trusts and can read legally; link to them rather than copying whole articles.'],
      ['How do I avoid politics?', 'Choose practical topics tied to the learner\'s work or interests and say up front that opinion tasks are about language, not about taking sides.'],
      ['How do I check the learner improved?', 'Note the new words and structures they produced unprompted in the retell and plan the next text around the ones they avoided.'],
    ],
  },

  'best-apps-learning-english-2026': {
    h1: 'Choosing English Apps for an Adult Learner',
    updated: '2026-10-05',
    keywords: ['apps for learning English', 'choosing English learning apps', 'app recommendation adult learner'],
    sources: [RETRIEVAL],
    directAnswer:
      'Recommend an English app to an adult learner by the job it should do between your lessons: vocabulary review, listening input, or speaking practice. Pick one app per job, check that it fits the learner\'s level and schedule, and agree how you will see the result, because an app you cannot see into cannot inform your next lesson.',
    problem: [
      'Adults ask tutors which app to download and then use five at once, with no link to what is taught in lessons.',
      'App scores rarely show which gap a learner has, so the tutor cannot use them to plan.',
      'Recommendations go out of date quickly, and a list copied from a review page does not fit a specific learner.',
    ],
    solution: [
      'Name the job first: spaced vocabulary review, listening practice, or speaking with feedback.',
      'Limit to one app per job and one job at a time; two weeks of habit beat a long list.',
      'Check three things with the learner: the level is right, the daily time fits, and the content matches their work vocabulary.',
      'Agree what you will look at in the next lesson: a screenshot, ten words they chose, or one recording.',
      'Treat apps as practice between lessons. Decide new teaching from what the learner does in front of you.',
      'Teacher review of any app content comes before you recommend it: try one session yourself and check the level and register.',
    ],
    mechanics: [
      'Edooqoo is not an app store; it supports review between lessons with flashcards that use spaced repetition and with homework the learner completes through a link, both visible to the teacher.',
      'Flashcard vocabulary can be imported from a worksheet, so review matches what was taught.',
    ],
    works: [
      'The learner wants structure for self-study between lessons.',
      'You can name one gap an app could help with.',
      'You will look at the result in the next lesson.',
    ],
    notEnough: [
      'The learner already has a study routine that works; do not replace it.',
      'The app cannot show you anything about what the learner did.',
      'The learner needs speaking feedback, which a tutor gives better than most apps.',
    ],
    tutorDecision:
      'Recommend an app only after you can finish the sentence "This will help you practise ___ between lessons, and next week we will check ___."',
    example:
      'Constructed example. A learner forgets new vocabulary within days. The tutor suggests daily spaced flashcards for ten work words only, 10 minutes a day. Next lesson starts with a quick recall of those ten and drops two words that were too easy.',
    faqs: [
      ['Should I give learners a ranked list of apps?', 'No. Match one app to one job and one learner; a general ranking does not know their level or goals.'],
      ['How many apps is too many?', 'More than one per job, or more than two overall, usually means none is used consistently.'],
      ['Are apps enough to learn English?', 'Apps can support practice, but they rarely replace feedback from a tutor on speaking and writing.'],
      ['What should I ask the learner about an app?', 'Ask what they did, for how long, and what they found hard, then use the answer to plan the next lesson.'],
    ],
  },

  'how-to-create-grammar-worksheets-with-ai': {
    h1: 'How to Create Grammar Worksheets with AI',
    updated: '2026-10-05',
    keywords: ['AI grammar worksheet', 'create grammar worksheet', 'teacher review AI worksheets'],
    sources: [CEFR],
    directAnswer:
      'To create a grammar worksheet with AI, give the tool the level, the single grammar point, a context from the learner\'s own work, and the exercise types you want. Then read every item and the key before using it: AI drafts are fast, but a tutor must check accuracy, register and level.',
    problem: [
      'A prompt such as "make a present perfect worksheet" returns generic sentences and sometimes errors in the key.',
      'Tutors lose the time they saved by rewriting content that did not fit the learner.',
      'Without a check, a wrong answer key teaches the learner the wrong form with the tutor\'s authority behind it.',
    ],
    solution: [
      'Give one grammar point, not a list; mixed targets produce mixed worksheets.',
      'State the level (for example B1) and one real context: the learner\'s role, the situation they meet.',
      'Choose exercise types that match the aim: error correction to notice, gap fill to automate, open questions to produce.',
      'Read every item and the key; fix unnatural sentences and check accepted variants.',
      'Add one free-production task at the end and keep it for the live lesson.',
    ],
    mechanics: [
      'The Edooqoo worksheet form takes lesson topic, lesson goal, grammar focus, CEFR level group (A1/A2, B1/B2, C1/C2), language style and exercise selection (manual, random or suggested), and can attach a student for context.',
      'Generated worksheets are editable before sharing or export, and text answers are checked with a matcher that marks uncertain items for teacher review.',
    ],
    works: [
      'You know the grammar point and the level and want a first draft in minutes.',
      'You will review the draft before it reaches the learner.',
      'You want the context to come from the learner\'s own situation.',
    ],
    notEnough: [
      'The learner\'s problem is not yet diagnosed; find the gap first.',
      'You cannot review the draft; an unreviewed worksheet is not safe to assign.',
      'The topic needs a task a worksheet cannot give, such as live conversation.',
    ],
    tutorDecision:
      'Use the worksheet only after you have fixed anything unnatural and checked the key; if more than a quarter of the items needed rewriting, tighten the brief and regenerate.',
    example:
      'Constructed example. A B1 sales rep confuses present perfect and past simple when reporting results. The brief says: present perfect versus past simple, B1, quarterly sales updates, error correction and gap fill. The tutor deletes two items that sound textbook-like, adds one sentence from the rep\'s own update, and assigns the rest as homework.',
    faqs: [
      ['Can AI write the whole lesson?', 'It can draft materials, but the tutor decides the target, checks the content and runs the lesson.'],
      ['How long does review take?', 'For one worksheet, expect a few minutes to read items and the key; the saving comes from not writing from scratch.'],
      ['Which grammar points work well?', 'Points with clear forms, such as tenses, conditionals and articles; points that depend on pragmatics need more tutor input.'],
      ['Should learners see the AI draft?', 'Only after you have reviewed and edited it.'],
    ],
  },

  'error-correction-techniques-esl': {
    h1: 'Error Correction Techniques for Adult ESL Lessons',
    updated: '2026-10-05',
    keywords: ['error correction techniques', 'feedback adult English learners', 'delayed correction'],
    sources: [FORMATIVE, CEFR],
    directAnswer:
      'Correct errors that block the learner\'s message or repeat across lessons, and let the rest go. Choose between immediate correction for accuracy tasks and delayed correction for fluency tasks, give the learner a chance to self-correct first, and keep a short record so repeated errors become the next lesson target.',
    problem: [
      'Correcting every slip interrupts fluency and makes adults hesitant to speak.',
      'Not correcting at all leaves fossilised errors the learner does not know about.',
      'Corrections given and forgotten leave no evidence of whether anything changed.',
    ],
    solution: [
      'Decide the task type before the lesson: accuracy task means correct now, fluency task means note it and correct afterwards.',
      'Prompt self-correction first: repeat the sentence up to the error with a rising tone, or say "Try again?".',
      'Prioritise: errors that change meaning, errors that repeat, and errors on the target form.',
      'Write errors on a shared list during speaking and review three of them at the end, not all.',
      'Turn the list into a short task next lesson, then check whether the same errors recur.',
      'Teacher review stays with you: any worksheet built from the learner\'s errors is a draft until you have read it and corrected the key.',
    ],
    mechanics: [
      'Edooqoo has an error-correction exercise type; the tutor can build a task from the learner\'s real mistakes and edit it before assigning.',
      'Homework answers are reviewed by the teacher, and uncertain text matches are flagged for review instead of being marked wrong.',
    ],
    works: [
      'You teach the same learner repeatedly and can track errors across lessons.',
      'The learner is willing to try self-correction.',
      'You have two or three minutes at the end of the lesson to review the list.',
    ],
    notEnough: [
      'The learner is anxious and silent; focus on confidence before accuracy.',
      'Errors come from a missing concept, which needs teaching, not correcting.',
      'The lesson is a one-off with no follow-up task.',
    ],
    tutorDecision:
      'At the end of each lesson choose the one error that most affected clarity and make it the first five minutes of the next lesson.',
    example:
      'Constructed example. During a presentation rehearsal an HR specialist says "We are discussing since two months". The tutor notes the error and does not interrupt. Afterwards the learner hears the sentence, spots the tense, and fixes it. The next lesson opens with five of her own sentences using "for" and "since".',
    faqs: [
      ['Should I always correct immediately?', 'No. Correct immediately during accuracy practice and delay correction during fluency tasks so the learner can keep speaking.'],
      ['How many errors should I correct per lesson?', 'A handful of the most important ones; more than that overloads the learner and the record.'],
      ['What if the learner cannot self-correct?', 'Give a hint about the type of error, and then model the correct form and ask them to repeat it in a new sentence.'],
      ['Why does feedback matter?', 'Formative assessment research reports that specific, timely feedback supports learning.'],
      ['How do I know a correction worked?', 'Check in the next lesson whether the same error appears in a new task; if it does, change the type of practice, not only the explanation.'],
    ],
  },

  'cloze-test-design-esl': {
    h1: 'Cloze Test Design for Adult ESL Learners',
    updated: '2026-10-05',
    keywords: ['cloze test design', 'cloze passage adult learners', 'gap fill test'],
    sources: [RETRIEVAL, CEFR],
    directAnswer:
      'Design a cloze test by choosing a passage at the learner\'s level, deleting words that test one chosen skill (grammar, collocations or discourse links), and checking that each gap has a defensible answer. Use it as a quick check of reading and vocabulary control, not as a precise score.',
    problem: [
      'Deleting every fifth word is easy to produce but tests a random mix, so the result is hard to interpret.',
      'Passages written for natives or for a different register make gaps impossible to fill from context.',
      'Learners treat the task as a puzzle and guess, and tutors count right answers without reading the pattern.',
    ],
    solution: [
      'Choose a passage the learner could meet at work, about 120 to 180 words.',
      'Decide what to test: for a grammar focus, delete grammar words; for vocabulary, delete content words; for discourse, delete linking words.',
      'Leave the first and last sentence intact so the context is clear.',
      'Pilot it yourself and fix any gap with more than one acceptable answer or list the variants in the key.',
      'Read the errors, not only the score: group them by type and name one next target.',
      'Teacher review of the key is part of the design: solve the cloze yourself before the learner does and list every acceptable answer.',
    ],
    mechanics: [
      'Edooqoo has a cloze-test exercise type and related gap-fill types; the tutor can edit the passage and the key.',
      'Worksheets can be shared with a student through a link and answers are checked by a matcher that flags uncertain items for review.',
    ],
    works: [
      'You want a short check of the learner\'s control of grammar or vocabulary in context.',
      'You can choose a text relevant to the learner.',
      'You will look at the pattern of errors with the learner.',
    ],
    notEnough: [
      'You need a reliable level estimate; a cloze is only one input.',
      'The learner is a beginner who cannot read the passage.',
      'You need to assess speaking or writing, which a cloze does not show.',
    ],
    tutorDecision:
      'After the cloze, name the error type that appeared most and make it the focus of the next task, rather than reporting a score.',
    example:
      'Constructed example. A B2 consultant reads a 150-word project update with ten gaps on linking words. She fills "however" and "therefore" correctly and misses three contrast links. The next lesson works only on contrast ("although", "whereas", "in spite of") with her own report sentences.',
    faqs: [
      ['How many gaps are enough?', 'Eight to twelve gaps in a short passage is enough to see a pattern.'],
      ['Should I delete every nth word?', 'Only if you want a rough overall measure; for teaching, delete words that test a skill you chose.'],
      ['Can I use a cloze as a placement test?', 'Use it as one input among others, not as a sole measure of level.'],
      ['What about answers that differ from the key?', 'List acceptable variants in the key before the lesson and decide unexpected answers yourself.'],
    ],
  },

  'debate-activities-english-class': {
    h1: 'Debate Activities for One-to-One Adult Lessons',
    updated: '2026-10-05',
    keywords: ['debate activity ESL', 'speaking activity adult learners', 'opinion practice'],
    sources: [CEFR],
    directAnswer:
      'A debate works with an adult learner when the topic is something they must argue at work, the structure is small (one claim, two reasons, one answer to an objection), and the tutor plays the opponent. Keep it short, record the language that broke down, and repeat the task after feedback.',
    problem: [
      'Classroom debate formats assume teams, which a single learner and a tutor do not have.',
      'Abstract topics produce flat opinions and little language; the learner has nothing at stake.',
      'The task ends with applause and no evidence about what the learner can now do.',
    ],
    solution: [
      'Pick a position the learner has to defend in real life: a budget, a deadline, a vendor choice.',
      'Give a simple structure: state the claim, give two reasons, answer one objection.',
      'Take the opposing side yourself and push back at one level above their comfort.',
      'Note language that broke down: hedging, concession, contrast, politeness.',
      'Repeat with the same position after a short feedback segment and compare the two attempts.',
      'Teacher review of the brief comes first: check that the position, vocabulary and level fit this learner before the lesson.',
    ],
    mechanics: [
      'Edooqoo worksheets can include open-question and paragraph-writing exercise types, so the tutor can prepare a short brief or a follow-up writing task and edit it before use.',
      'Speaking homework can be recorded by the student and reviewed by the teacher.',
    ],
    works: [
      'The learner needs to persuade, negotiate or justify a decision in English.',
      'You can take a realistic opposing role.',
      'You have time for a second attempt in the same or the next lesson.',
    ],
    notEnough: [
      'The learner needs controlled accuracy practice first.',
      'The topic is sensitive and would not feel safe to argue.',
      'There is no chance to repeat the task after feedback.',
    ],
    tutorDecision:
      'After the second attempt, decide whether the learner now needs more language (teach it) or more practice (repeat the task with less support).',
    example:
      'Constructed example. A product manager must argue to delay a release. The tutor plays the sales director who wants it on time. Attempt one lacks concession language; after feedback on "I understand the pressure, but...", attempt two uses it twice and the objection is answered without hesitation.',
    faqs: [
      ['Does a debate need two learners?', 'No. With one adult learner, the tutor takes the opposing side.'],
      ['How long should a debate last?', 'Five to eight minutes for the first attempt, then feedback and a shorter second attempt.'],
      ['What if the learner has no opinion?', 'Assign a position and ask them to build the strongest case; the language practice is the same.'],
      ['What should I record?', 'Language that blocked the message, not every error.'],
    ],
  },

  'how-to-assess-english-level-cefr': {
    h1: "How to Assess an Adult's English Level on the CEFR Scale",
    updated: '2026-10-05',
    keywords: ['assess English level CEFR', 'CEFR level adult learner', 'level check for tutors'],
    sources: [CEFR, FORMATIVE],
    directAnswer:
      'To estimate an adult\'s English level on the CEFR scale, combine several short pieces of evidence: a reading or listening check, a writing sample and a speaking sample, each judged against the CEFR descriptors. Treat the result as a working estimate for planning lessons, not as an official certificate.',
    problem: [
      'One test hides skill differences; a learner can be B2 in reading and A2 in speaking.',
      'Tutors compare a learner\'s feel to a level name and cannot explain the decision.',
      'Learners ask "what is my level?" and expect a number the tutor cannot support.',
    ],
    solution: [
      'Collect at least three pieces of evidence: one receptive, one written and one spoken.',
      'Judge each against the CEFR descriptors for that skill rather than a single overall impression.',
      'Report skills separately: "reading B2, listening B1, speaking A2".',
      'State the confidence: a working estimate from three samples, not a certified result.',
      'Re-check after a block of lessons with comparable tasks.',
    ],
    mechanics: [
      'Edooqoo has a teacher-issued Welcome Test that gives skill-level results the teacher reviews, and a free browser CEFR level test for learners that is an anonymous self-check and not the Welcome Test.',
      'Worksheets can be generated for an A1/A2, B1/B2 or C1/C2 level group and edited by the tutor.',
    ],
    works: [
      'You need a starting level to plan the first lessons.',
      'The learner wants to know roughly where they are.',
      'You can compare samples from different dates.',
    ],
    notEnough: [
      'An official certificate is needed for work or visa; only an accredited exam can provide it.',
      'You have only one short sample.',
      'The learner needs to be placed against a specific exam rubric.',
    ],
    tutorDecision:
      'Report a level per skill with the evidence behind it, and plan the first block around the lowest skill that blocks the learner\'s goal.',
    example:
      'Constructed example. A learner reads a technical article with ease, writes clear emails, and hesitates heavily in speaking. The tutor reports reading B2, writing B1 to B2, speaking A2 to B1, and plans four lessons on spontaneous speaking before any further reading work.',
    faqs: [
      ['Is a CEFR estimate the same as a certificate?', 'No. Only accredited exams certify a level; classroom estimates guide lesson planning.'],
      ['How many samples do I need?', 'At least one receptive, one written and one spoken sample for a working estimate.'],
      ['Can I use a free online level test?', 'Use it as a rough self-check and confirm with your own observation.'],
      ['How often should I reassess?', 'After a block of lessons, using comparable tasks, so the change is visible.'],
    ],
  },
};
