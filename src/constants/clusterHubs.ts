/**
 * Sprint 3 (Faza 3) — cluster hub content.
 *
 * Mirrors scripts/seo/cluster-hubs.mjs (routes, tool funnel, spoke set).
 * Copy rules: adult 1:1 tutor persona only, no school framing, no kids content,
 * no ROADMAP features. Title <= 60 chars, description <= 155 chars.
 */

export interface ClusterHubSpoke {
  label: string;
  href: string;
  note: string;
}

export interface ClusterHubTableRow {
  situation: string;
  use: string;
  why: string;
  where: string;
  whereHref: string;
}

export interface ClusterHub {
  id: string;
  route: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  tool: string;
  toolCtaLabel: string;
  toolHeading: string;
  toolBody: string;
  definitionHeading: string;
  citation: string;
  tableHeading: string;
  table: ClusterHubTableRow[];
  problems: string[];
  solutionHeading: string;
  solutions: { title: string; body: string }[];
  spokes: ClusterHubSpoke[];
  faqs: { question: string; answer: string }[];
  ctaTitle: string;
  ctaBody: string;
  extraJsonLd?: Record<string, unknown>[];
}

export const CLUSTER_HUBS: Record<string, ClusterHub> = {
  'cefr-assessment': {
    id: 'cefr-assessment',
    route: '/cefr-assessment',
    title: 'CEFR Assessment for Adult 1:1 English Tutors',
    description:
      'Place an adult student on the CEFR scale in one lesson: free level test, vocabulary checker, and what to do with the result.',
    h1: 'CEFR Assessment for Adult 1:1 English Tutors',
    lead: 'Everything you need to place a new adult student on the CEFR scale in a single lesson, and to turn that level into the first three lessons instead of a label on a spreadsheet.',
    tool: '/tools/vocab-cefr-checker',
    toolCtaLabel: 'Check a text against CEFR levels',
    toolHeading: 'The tool this cluster funnels into',
    toolBody:
      'Paste any text a student wrote or any material you plan to use, and the vocabulary CEFR checker returns the level distribution of its lexis. It is the fastest sanity check that a task actually matches the level you assigned.',
    definitionHeading: 'What CEFR assessment means for a private tutor',
    citation:
      'CEFR assessment in 1:1 adult tutoring is a short diagnostic that places a learner between A1 and C2 across separate skills, not one global grade. A tutor tests reading, listening, written production and spoken range, records the weakest skill, and uses that gap to select the first lesson objective. Edooqoo runs this as a 49-question welcome test plus ongoing evidence.',
    tableHeading: 'Which assessment to run, and when',
    table: [
      {
        situation: 'New adult student, no history',
        use: '49-question welcome test',
        why: 'Gives a per-skill profile before lesson one, not a single number.',
        where: 'Placement test',
        whereHref: '/features/placement-test',
      },
      {
        situation: 'Need a level in 10 minutes',
        use: 'Free CEFR level test',
        why: 'Quick public test you can send before a trial lesson.',
        where: 'CEFR level test',
        whereHref: '/tools/cefr-level-test',
      },
      {
        situation: 'Checking whether material fits the level',
        use: 'Vocabulary CEFR checker',
        why: 'Shows the lexical band of the text you are about to use.',
        where: 'Vocab CEFR checker',
        whereHref: '/tools/vocab-cefr-checker',
      },
      {
        situation: 'Mid-course, level feels wrong',
        use: 'Formative assessment inside lessons',
        why: 'Ongoing evidence beats a re-test the student will resent.',
        where: 'Formative assessment guide',
        whereHref: '/blog/formative-assessment-english-teaching.html',
      },
    ],
    problems: [
      'A single global CEFR label hides the real picture: a B2 speaker with A2 writing gets material that bores them in one skill and drowns them in another.',
      'Most placement tests are built for schools and take a full lesson the student is paying for.',
      'The result usually ends as a note in a spreadsheet, disconnected from what you actually teach next week.',
    ],
    solutionHeading: 'How Edooqoo handles CEFR assessment',
    solutions: [
      { title: 'Per-skill placement', body: 'The welcome test returns separate signals for grammar, vocabulary, reading, listening and speaking, so you can teach the gap, not the average.' },
      { title: 'Result feeds the worksheet', body: 'The level and weak skills sit in the student profile and shape the next generated worksheet automatically.' },
      { title: 'Public tools for pre-sales', body: 'Send the free CEFR level test before a trial lesson and arrive already knowing roughly where the student sits.' },
    ],
    spokes: [
      { label: 'Placement test for adult 1:1 students', href: '/features/placement-test', note: '49-question welcome test with per-skill output and a learning path.' },
      { label: 'Free CEFR level test', href: '/tools/cefr-level-test', note: 'Public test you can send to a prospect before the trial lesson.' },
      { label: 'Vocabulary CEFR checker', href: '/tools/vocab-cefr-checker', note: 'Checks the CEFR band of any text before you put it in front of a student.' },
      { label: 'Diagnostic testing adult English learners in 15 minutes', href: '/blog/diagnostic-testing-english-learners.html', note: 'What to test, what to skip, and how to turn the result into lesson one.' },
      { label: 'What an adult English placement test should include', href: '/blog/what-should-adult-english-placement-test-include.html', note: 'The components that matter for working adults, and the ones that waste the lesson.' },
      { label: 'Formative assessment in English teaching', href: '/blog/formative-assessment-english-teaching.html', note: 'Collecting level evidence inside normal lessons instead of re-testing.' },
      { label: 'CEFR-aligned worksheet generation workflow', href: '/blog/cefr-aligned-worksheet-generation-workflow.html', note: 'From a CEFR result to material at the right level in one pass.' },
    ],
    faqs: [
      {
        question: "How do I check a student's CEFR level without a full exam?",
        answer:
          'Use a short per-skill diagnostic: a 10-15 minute written task, a graded listening, and five minutes of unscripted speaking. Score each separately. In Edooqoo the 49-question welcome test does this asynchronously before lesson one, so you spend the paid hour teaching rather than testing.',
      },
      {
        question: 'What CEFR level should I put an adult professional at?',
        answer:
          'Place them at the level of their weakest productive skill, not their strongest receptive one. Working adults usually read and listen above the level at which they can write and speak. Teaching at the receptive level produces fluent-sounding lessons and no measurable progress.',
      },
      {
        question: 'How often should I re-assess an adult 1:1 student?',
        answer:
          'Every 8-12 lessons, and always with evidence you already collected: homework results, recurring errors, and task completion at a given level. A formal re-test is only worth the lesson time when the student needs a certificate-style number.',
      },
    ],
    ctaTitle: 'Turn a CEFR result into next week\'s lesson',
    ctaBody: 'Run the welcome test, then generate a worksheet that targets the weakest skill it found. Free plan includes 2 worksheets, no credit card required.',
  },

  pronunciation: {
    id: 'pronunciation',
    route: '/teaching-english-pronunciation',
    title: 'Teaching English Pronunciation to Adults — Tutor Hub',
    description:
      'Stress, intonation, minimal pairs and connected speech for adult 1:1 lessons, with drills you can turn into a worksheet in a minute.',
    h1: 'Teaching English Pronunciation to Adult 1:1 Students',
    lead: 'Stress, intonation, minimal pairs and connected speech, organised the way a tutor works: identify what blocks intelligibility, drill it, then test it in an audio task the student does at home.',
    tool: '/esl-worksheets',
    toolCtaLabel: 'Generate a pronunciation worksheet',
    toolHeading: 'The tool this cluster funnels into',
    toolBody:
      'Minimal pairs, stress marking and listening discrimination all become worksheet exercises with generated audio, so the drill you ran in the lesson continues as homework instead of evaporating.',
    definitionHeading: 'What pronunciation teaching means for adults',
    citation:
      'Pronunciation teaching for adult learners targets intelligibility, not accent removal. The tutor identifies which features block understanding: word and sentence stress, weak forms, connected speech, and the small set of phonemes the learner\'s first language does not contrast. Each feature is drilled in isolation, then in a work-relevant task. Accent identity is preserved deliberately.',
    tableHeading: 'Which pronunciation problem to attack first',
    table: [
      {
        situation: 'Listener asks "sorry?" repeatedly',
        use: 'Word and sentence stress work',
        why: 'Misplaced stress breaks comprehension faster than any single sound.',
        where: 'Stress and intonation drills',
        whereHref: '/blog/teaching-english-intonation-stress.html',
      },
      {
        situation: 'Two words sound identical',
        use: 'Minimal pairs sorted by L1',
        why: 'Only contrasts absent in the L1 need training.',
        where: 'Minimal pairs guide',
        whereHref: '/blog/teaching-minimal-pairs-esl.html',
      },
      {
        situation: 'Understands text, not speech',
        use: 'Connected speech and weak forms',
        why: 'Native speech elides and links; the student is hearing citation forms.',
        where: 'Connected speech activities',
        whereHref: '/blog/connected-speech-teaching-activities.html',
      },
      {
        situation: 'Professional wants to sound clearer at work',
        use: 'Intelligibility-first activity set',
        why: 'Targets impact on meetings, not accent erasure.',
        where: 'Accent reduction activities',
        whereHref: '/blog/accent-reduction-activities-esl.html',
      },
    ],
    problems: [
      'Pronunciation gets dropped first when the lesson runs short, because there is no material ready to hand.',
      'Generic minimal pair lists ignore the learner\'s first language, so you drill contrasts they already have.',
      'Adults hear "accent reduction" as a judgement on their identity and disengage.',
    ],
    solutionHeading: 'How Edooqoo supports pronunciation work',
    solutions: [
      { title: 'Audio exercise types', body: 'Listening discrimination, minimal pairs and dictation tasks generate with audio, so the drill survives outside the lesson.' },
      { title: 'Per-phoneme evidence', body: 'Recurring errors are recorded against the student profile, so you can see which contrast is still failing three weeks later.' },
      { title: 'Adult-relevant contexts', body: 'Stress and intonation practice uses the student\'s own professional scenarios, not classroom sentences.' },
    ],
    spokes: [
      { label: 'Teaching stress and intonation to adults', href: '/blog/teaching-english-intonation-stress.html', note: 'Ten drills covering word stress, sentence stress and intonation contours.' },
      { label: 'Minimal pairs sorted by the learner\'s L1', href: '/blog/teaching-minimal-pairs-esl.html', note: 'Which contrasts to train for each first language, and which to leave alone.' },
      { label: 'Accent reduction activities for professionals', href: '/blog/accent-reduction-activities-esl.html', note: 'Intelligibility-first activities for working adults.' },
      { label: 'How to teach English pronunciation', href: '/blog/how-to-teach-english-pronunciation.html', note: 'The overall sequence: diagnose, isolate, drill, transfer.' },
      { label: 'Teaching connected speech', href: '/blog/connected-speech-teaching-activities.html', note: 'Linking, elision and assimilation for learners who cannot follow natural speech.' },
      { label: 'Teaching collocations', href: '/blog/teaching-collocations-esl.html', note: 'Chunking that makes stress patterns and fluency easier to hold.' },
      { label: 'Exercise types with audio', href: '/exercise-types', note: 'The audio exercise types you can generate for pronunciation homework.' },
    ],
    faqs: [
      {
        question: 'How do I teach pronunciation to an adult without insulting them?',
        answer:
          'Frame every session around intelligibility in a specific situation: "your team keeps mishearing this word in stand-ups". Never use the word "wrong" about an accent. Adults accept correction that is tied to a professional outcome and reject correction framed as a personal defect.',
      },
      {
        question: 'Are minimal pairs still worth teaching?',
        answer:
          'Yes, but only for contrasts the learner\'s first language does not make, and only when confusion actually reaches the listener. A Polish speaker rarely needs /b/-/p/ work; they may need /ɪ/-/iː/. Drilling a contrast the student already controls is wasted lesson time.',
      },
      {
        question: 'What should I do when a student understands text but not speech?',
        answer:
          'Work on connected speech rather than vocabulary. Train weak forms, linking and elision using short authentic clips, transcribe together, then re-listen. The gap is usually perception of reduced forms, not lexical range.',
      },
    ],
    ctaTitle: 'Turn a pronunciation drill into homework',
    ctaBody: 'Generate an audio worksheet from the contrast you drilled today and assign it before the student forgets. Free plan includes 2 worksheets.',
  },

  'exercise-design': {
    id: 'exercise-design',
    route: '/esl-exercise-design',
    title: 'ESL Exercise Design — Cloze, Gap-Fill, Transformation',
    description:
      'How to design cloze, gap-fill, word formation and transformation tasks that diagnose an adult learner instead of filling lesson time.',
    h1: 'ESL Exercise Design for Adult 1:1 Lessons',
    lead: 'Task design decides whether an exercise measures something or just occupies fifteen minutes. This hub covers cloze, gap-fill, word formation, transformation and task-based work, with the design rules that make each one diagnostic.',
    tool: '/exercise-types',
    toolCtaLabel: 'Browse the 29 exercise types',
    toolHeading: 'The tool this cluster funnels into',
    toolBody:
      'Every design principle here maps to one of the 29 Edooqoo exercise types. Pick the type that matches the decision you want to test, generate it against the student profile, and edit before sending.',
    definitionHeading: 'What good ESL exercise design means',
    citation:
      'ESL exercise design is the choice of task format that makes a learner\'s specific gap visible. A well-designed task has one defensible answer, enough context to make that answer recoverable, distractors that represent real errors, and a scoring rule the tutor can apply consistently. Format follows diagnosis: cloze measures integrated reading, gap-fill measures a single form.',
    tableHeading: 'Which exercise format tests what',
    table: [
      {
        situation: 'One grammar form is unstable',
        use: 'Targeted gap-fill with plausible distractors',
        why: 'Isolates a single rule with a single defensible answer.',
        where: 'Fill-in-the-blank rules',
        whereHref: '/blog/fill-in-the-blanks-exercises-best-practices.html',
      },
      {
        situation: 'Reading ability is unclear',
        use: 'Rational-deletion cloze',
        why: 'Forces integration of syntax, cohesion and meaning across the text.',
        where: 'Cloze test design',
        whereHref: '/blog/cloze-test-design-esl.html',
      },
      {
        situation: 'Vocabulary is passive',
        use: 'Word formation prompts',
        why: 'Requires production of the right part of speech, not recognition.',
        where: 'Word formation exercises',
        whereHref: '/blog/word-formation-exercises-english.html',
      },
      {
        situation: 'Student needs to perform, not practise',
        use: 'Task-based activity with an outcome',
        why: 'Measures transfer into a real work task.',
        where: 'Task-based worksheets',
        whereHref: '/blog/task-based-language-teaching-worksheets.html',
      },
    ],
    problems: [
      'Gap-fills with several defensible answers turn feedback into an argument you cannot win.',
      'Cloze tests built by deleting every seventh word measure luck as much as language.',
      'Exercise choice is usually driven by what is easy to make, not by what needs to be diagnosed.',
    ],
    solutionHeading: 'How Edooqoo applies these design rules',
    solutions: [
      { title: '29 typed exercise formats', body: 'Each type has defined instructions, answer key format and CEFR fit, so the format is a deliberate choice rather than an accident.' },
      { title: 'Distractors with intent', body: 'Generated distractors reflect plausible learner errors, which is what makes the result diagnostic.' },
      { title: 'Editable before it ships', body: 'Every generated task is editable, so you can remove the item that has two right answers before the student sees it.' },
    ],
    spokes: [
      { label: 'Seven rules for fill-in-the-blank tasks', href: '/blog/fill-in-the-blanks-exercises-best-practices.html', note: 'One defensible answer, context length, distractors, scoring.' },
      { label: 'Cloze test design: every-nth-word vs rational deletion', href: '/blog/cloze-test-design-esl.html', note: 'Which method measures what, deletion rate and scoring.' },
      { label: 'Word formation exercises for B1-C1 adults', href: '/blog/word-formation-exercises-english.html', note: 'Prefix, suffix and part-of-speech prompts with a marking key.' },
      { label: 'Modal verbs worksheets and exercise types', href: '/modal-verbs-worksheets-esl.html', note: 'Eight ready formats for a notoriously slippery area.' },
      { label: 'Choosing the right ESL exercise type', href: '/blog/esl-exercise-type-selection-guide.html', note: 'Matching format to the gap you are trying to see.' },
      { label: 'Task-based language teaching worksheets', href: '/blog/task-based-language-teaching-worksheets.html', note: 'Designing tasks with an outcome, not just a form focus.' },
      { label: 'All 29 exercise types', href: '/exercise-types', note: 'The full catalogue with CEFR fit and use cases.' },
    ],
    faqs: [
      {
        question: 'What makes a gap-fill exercise actually useful?',
        answer:
          'One defensible answer per gap, enough surrounding context to recover it, and distractors that mirror real learner errors. If a competent native speaker could justify a second answer, the item is broken and the feedback conversation will undermine you.',
      },
      {
        question: 'Should I use every-nth-word or rational deletion cloze?',
        answer:
          'Rational deletion for teaching, every-nth-word only for rough global proficiency checks. Rational deletion lets you target cohesion devices, prepositions or verb forms, so the result tells you what to teach next. Random deletion tells you a score and little else.',
      },
      {
        question: 'How many exercises should one adult 1:1 worksheet contain?',
        answer:
          'Three to five, with one clear focus and one transfer task. Longer worksheets look thorough and get abandoned. For a 60-minute lesson plus homework, aim for 15-20 minutes of in-lesson work and one task the student completes alone.',
      },
    ],
    ctaTitle: 'Design the task, let the generator build it',
    ctaBody: 'Pick the exercise type that matches the gap you found and generate it against your student profile. Free plan includes 2 worksheets.',
  },

  'tutor-operations': {
    id: 'tutor-operations',
    route: '/tutor-operations',
    title: 'Tutor Operations — Homework, Reports, Lesson Records',
    description:
      'Run a 1:1 English tutoring practice: homework review, progress reports, what-to-teach-next decisions and lesson records in one workflow.',
    h1: 'Tutor Operations for 1:1 English Teachers',
    lead: 'The unbilled half of tutoring: assigning and reviewing homework, keeping lesson records, writing progress reports, and deciding what to teach next without re-reading three months of notes.',
    tool: '/tools/what-should-i-teach-next',
    toolCtaLabel: 'Decide what to teach next',
    toolHeading: 'The tool this cluster funnels into',
    toolBody:
      'The what-should-I-teach-next tool turns the evidence you already have — recent errors, homework results, stated goals — into a defensible next objective, which is the decision that eats most prep time.',
    definitionHeading: 'What tutor operations covers',
    citation:
      'Tutor operations is the administrative layer of a 1:1 English practice: assigning homework, reviewing submissions, recording lesson evidence, reporting progress to the learner, and choosing the next objective. For a freelance tutor with ten students it typically consumes more hours than lesson delivery. Edooqoo consolidates it so weekly prep per student stays under one minute.',
    tableHeading: 'Where the unbilled hours go, and what to use',
    table: [
      {
        situation: 'Homework sits unmarked for a week',
        use: 'Assigned exercises with auto-checking',
        why: 'Objective items score themselves; you review only open answers.',
        where: 'Homework workflow',
        whereHref: '/features/homework',
      },
      {
        situation: 'Student asks "am I improving?"',
        use: 'Evidence-based progress report',
        why: 'Recorded results beat impressions and protect retention.',
        where: 'Progress report guide',
        whereHref: '/blog/writing-student-progress-reports-esl.html',
      },
      {
        situation: 'Prep starts with re-reading old notes',
        use: 'Next-focus decision from stored evidence',
        why: 'The decision is the slow part, not the material.',
        where: 'What to teach next',
        whereHref: '/what-to-teach-next',
      },
      {
        situation: 'Scheduling and no-shows eat time',
        use: 'Public booking with calendar sync',
        why: 'Removes the back-and-forth that never gets billed.',
        where: 'Calendar and booking',
        whereHref: '/features/calendar',
      },
    ],
    problems: [
      'Prep, marking, scheduling and reporting are unpaid, and they scale linearly with your student count.',
      'Evidence lives in four places: your notebook, the chat thread, a shared drive, and your memory.',
      'Progress reports get written from impressions, which is exactly when a student decides to stop.',
    ],
    solutionHeading: 'How Edooqoo compresses tutor operations',
    solutions: [
      { title: 'One record per student', body: 'Lessons, homework results, notes and test evidence sit on a single student page instead of four tools.' },
      { title: 'Homework that reviews itself', body: 'Objective exercises are checked automatically; open answers get AI-assisted evaluation you approve or override.' },
      { title: 'Next focus, already argued', body: 'The system proposes the next objective with the evidence behind it, so you decide in seconds rather than reconstruct.' },
    ],
    spokes: [
      { label: 'Digital homework tools for ESL tutors compared', href: '/blog/digital-homework-tools-esl-teachers.html', note: 'Assignment, submission, correction and evidence tracking, with trade-offs.' },
      { label: 'Writing student progress reports', href: '/blog/writing-student-progress-reports-esl.html', note: 'Reports built from recorded evidence rather than impressions.' },
      { label: 'AI-assisted homework grading workflow', href: '/blog/english-homework-ai-grading-workflow.html', note: 'Where automation helps and where the tutor must stay in the loop.' },
      { label: 'How long lesson prep should actually take', href: '/blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html', note: 'Benchmarks for prep time per student and where it leaks.' },
      { label: 'Homework workflow in Edooqoo', href: '/features/homework', note: 'Assigning exercises, deadlines, submissions and review.' },
      { label: 'Calendar and public booking', href: '/features/calendar', note: 'Booking page, calendar sync and lesson records.' },
      { label: 'What Should I Teach Next?', href: '/what-to-teach-next', note: 'The decision layer: evidence in, next objective out.' },
    ],
    faqs: [
      {
        question: 'How do I cut lesson prep time as a private English tutor?',
        answer:
          'Separate the decision from the material. Most prep time is spent deciding what to teach, not producing worksheets. Keep per-student evidence in one place, let the system propose the next objective, then generate and edit material against it. Target under a minute per student per week.',
      },
      {
        question: 'What should a progress report for an adult student contain?',
        answer:
          'Three things: what the student can now do that they could not before, the evidence for it (task results, error frequency), and the next objective with a date. Skip effort language. Adults paying by the hour want observable capability tied to their goal.',
      },
      {
        question: 'Is AI grading safe for English homework?',
        answer:
          'For objective items, yes. For open answers, treat it as a first pass: it flags patterns and drafts feedback, and you approve or rewrite before the student sees it. The tutor stays accountable for the judgement, which is also what the student is paying for.',
      },
    ],
    ctaTitle: 'Get the unbilled hours back',
    ctaBody: 'Keep homework, evidence and next-focus decisions in one workflow. Free plan includes 2 worksheets, no credit card required.',
  },
};

export const CLUSTER_HUB_LIST = Object.values(CLUSTER_HUBS);
