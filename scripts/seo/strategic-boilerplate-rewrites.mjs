/**
 * Step 1 of the public content remediation (2026-10): page-specific source material for the
 * 17 strategic blog articles whose rendered body shared >= 0.80 of its 8-word shingles with
 * other pages (docs/seo/content-uniqueness.generated.json). These pages stay indexable; the
 * fix is unique editorial substance, never noindex or a hand edit of public/blog HTML.
 *
 * Rules (same as article-rewrites.mjs): adult 1:1 tutoring only, product statements limited to
 * PRODUCTION behavior in docs/llm-context.md, constructed examples say so, no invented
 * statistics, customers or quotes, no em dashes. Each entry is merged into
 * ARTICLE_DETAIL_OVERRIDES, which makes the article "bespoke" and drops the shared boilerplate.
 * Guarded by scripts/seo/__tests__/strategic-boilerplate-rewrites.test.mjs and the
 * strategic gate in scripts/seo/audit-content-uniqueness.mjs.
 */
const CEFR = ['Council of Europe: CEFR Companion Volume', 'https://www.coe.int/en/web/common-european-framework-reference-languages'];
const RETRIEVAL = ['Roediger and Karpicke: Test-Enhanced Learning (2006)', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x'];
const FORMATIVE = ['Black and Wiliam: Assessment and Classroom Learning (1998)', 'https://doi.org/10.1080/0969595980050102'];
const FOUR_STRANDS = ['Nation: The Four Strands (2007)', 'https://doi.org/10.2167/illt039.0'];
const DUNLOSKY = ['Dunlosky et al.: Improving Students\u2019 Learning With Effective Learning Techniques (2013)', 'https://doi.org/10.1177/1529100612453266'];

export const STRATEGIC_BOILERPLATE_REWRITES = {
  'extensive-reading-programs-esl': {
    h1: 'Extensive Reading for Adult One-to-One English Learners',
    updated: '2026-10-22',
    keywords: ['extensive reading adult learners', 'graded reading for professionals', 'reading fluency between lessons'],
    sources: [FOUR_STRANDS],
    directAnswer:
      'Extensive reading works for a busy adult when the texts are easy enough to read quickly, close to what they already care about, and followed by a short spoken retell in the next lesson. The tutor chooses the level, the learner chooses the topic, and the lesson checks what language moved from the page into speech.',
    problem: [
      'Adults pick texts that look impressive, such as industry reports, and then read them with a dictionary, which is intensive study, not fluency reading.',
      'Reading at home stays invisible: the tutor hears "I read a bit" and has nothing to plan from.',
      'Programmes copied from schools use class libraries, reading logs and points, which a paying professional finds childish.',
      'Without a retell, new phrases are recognised on the page but never used, so the habit feels pointless after two weeks.',
    ],
    solution: [
      'Set a difficulty rule the learner can apply alone: if more than two or three words per page stop them, the text is too hard for this purpose.',
      'Let the learner choose the genre: crime novels, a sector newsletter, product blogs, biographies of people in their field.',
      'Agree a weekly volume in minutes, not pages, so travel weeks and deadline weeks do not break the routine.',
      'Open the next lesson with a two-minute retell and a question that forces an opinion, then note which new chunks appeared.',
      'Collect three phrases the learner liked and turn them into review cards, so reading feeds vocabulary instead of competing with it.',
    ],
    mechanics: [
      'Edooqoo does not supply a reading library; the tutor uses texts the learner can access legally.',
      'Phrases from the retell can go into a flashcard set that the student reviews with spaced repetition, and the tutor can see that review.',
    ],
    works: [
      'The learner reads at least a little for pleasure or work in their own language.',
      'There is an upcoming need for faster reading: email volume, reports, a new role with more documentation.',
      'The tutor can spare the first minutes of each lesson for the retell.',
    ],
    notEnough: [
      'The learner cannot yet read short simple texts without constant translation; build core vocabulary first.',
      'The goal is a timed reading paper, which also needs exam-format practice.',
      'The learner will not read between lessons at all; use short in-lesson texts instead of a programme.',
    ],
    tutorDecision:
      'After three retells, compare speed and the number of borrowed phrases; if neither changed, lower the text level before blaming motivation.',
    example:
      'Constructed example. A B1 data analyst says reading English slows her down at work. She picks a graded crime novel for evenings and a short weekly analytics newsletter. Each lesson starts with a retell of one chapter. By the fourth lesson she reuses "it turned out that" and "as far as I can tell" unprompted, and the tutor moves the newsletter retell to a written summary for her manager.',
    faqs: [
      ['What level should extensive reading texts be?', 'Below the learner\'s working level: they should understand almost every word and read without stopping often.'],
      ['How much should an adult read per week?', 'Agree a realistic number of minutes that survives a busy week; consistency matters more than volume.'],
      ['Should I test comprehension with questions?', 'A short retell and an opinion question reveal more than a worksheet and keep reading enjoyable.'],
      ['Can work documents count as extensive reading?', 'Only if they are easy for the learner; dense documents belong to intensive reading practice.'],
      ['How do I see whether reading is helping?', 'Track reading speed and phrases that reappear in speech or writing over several lessons.'],
    ],
  },

  'learning-pacing-scientific-vs-pragmatic-esl': {
    h1: 'Learning Pace for Adult English Learners: Research vs Real Schedules',
    updated: '2026-10-22',
    keywords: ['learning pace adult English', 'spacing and retention', 'lesson pacing private tutor'],
    sources: [DUNLOSKY, RETRIEVAL],
    directAnswer:
      'Pace a recurring adult learner by retention, not by the syllabus: introduce new language only as fast as last week\'s language survives a delayed check. Research on spacing tells you to return to material after a gap; the learner\'s calendar tells you how large that gap can realistically be.',
    problem: [
      'Tutors move on because a coursebook unit is finished, while the learner has already forgotten half of the previous unit.',
      'Adults with a deadline push for speed, and a crowded week of new input produces recognition without recall.',
      'Spacing advice assumes daily study, which a parent working full time does not have.',
      'Missed lessons are treated as lost time instead of as a natural spacing interval the next lesson can use.',
    ],
    solution: [
      'Start each lesson with a two-minute delayed check on items from one and two lessons ago, before any new input.',
      'Use a simple rule: if most checked items fail, the next lesson consolidates; if most pass, it advances.',
      'Plan the size of new input from the learner\'s real study minutes, not from the textbook chapter.',
      'When a deadline is fixed, cut scope rather than pace: fewer target functions, recycled more often.',
      'Treat a cancelled week as spacing and open the following lesson with retrieval, not a recap lecture.',
    ],
    mechanics: [
      'Edooqoo flashcards schedule review with spaced repetition, and skill mastery shown to the teacher fades with time since the last evidence, so old results are not read as current.',
      'Pacing suggestions in the learning plan are proposals the teacher accepts or edits.',
    ],
    works: [
      'You teach the same learner weekly or fortnightly and can check retention at the start of lessons.',
      'The learner has a realistic sense of how many minutes they can study between sessions.',
      'There is a goal date, so pace decisions have a consequence.',
    ],
    notEnough: [
      'The learner takes a short intensive course with daily lessons; plan spacing inside the week instead.',
      'The deadline is too close for any pace to cover the scope; renegotiate the goal.',
      'There is no record of what was taught, so delayed checks cannot be built.',
    ],
    tutorDecision:
      'Decide pace at the start of each lesson from the delayed check, and write down whether you consolidated or advanced and why.',
    example:
      'Constructed example. A sales manager wants to handle client objections in English within eight weeks and studies about fifteen minutes a week between lessons. The tutor drops two planned grammar units, keeps four objection-handling functions, and opens each lesson with a recall of the previous two. After a cancelled week, recall is still strong, so the next lesson advances to live role play.',
    faqs: [
      ['Is faster always better for motivated adults?', 'No. New material that is not retained has to be taught again, which is slower overall.'],
      ['What is a delayed check?', 'A short recall task on language from earlier lessons, done before the learner reviews it.'],
      ['How large should the gap between reviews be?', 'Research supports increasing gaps; in practice, use the lesson rhythm and add short home review in between.'],
      ['What if the learner wants to move on anyway?', 'Show the check result and agree on a smaller next step that still feels like progress.'],
      ['Should pacing differ by skill?', 'Often yes: vocabulary can move faster with review, while speaking fluency usually needs repetition of the same task.'],
    ],
  },

  'student-progress-to-worksheet-feedback-loop': {
    h1: 'From Student Progress to the Next Worksheet: Choosing the Format',
    updated: '2026-10-22',
    keywords: ['progress to worksheet', 'choose exercise from evidence', 'feedback loop adult tutor'],
    sources: [FORMATIVE],
    directAnswer:
      'Let the type of progress signal choose the worksheet format. A learner who recognises a form but cannot produce it needs controlled production; one who produces it slowly needs timed or repeated use; one who uses it in drills but not in speech needs a transfer task in their own context.',
    problem: [
      'Progress notes say "better" or "still weak", which does not tell the tutor what kind of task to make next.',
      'Tutors repeat the exercise that already went well, so the learner gets easy wins and no new evidence.',
      'Scores from different formats are compared as if they measured the same thing, and a gap-fill pass is read as speaking control.',
      'Worksheets are chosen by topic variety rather than by the stage the learner has reached with one form.',
    ],
    solution: [
      'Name the stage for each target: not noticed, recognised, produced with support, produced alone, used in real communication.',
      'Match the stage to a format: noticing tasks and error spotting for early stages, gap fill and transformation for supported production, open answers and role cards for independent use.',
      'Change only one variable at a time, the format or the context, so the next result is interpretable.',
      'After each worksheet, write the new stage, not a score, and choose the next format from it.',
      'Keep one review item from the previous stage so a regression is visible.',
    ],
    mechanics: [
      'Edooqoo records results from worksheets, homework and live work per skill, and the teacher sees which skills are strong, weak or due for review.',
      'Suggested next worksheets from the learning plan are drafts; the tutor can change the exercise selection before generating.',
    ],
    works: [
      'You have at least two pieces of evidence on the same target from different tasks.',
      'You can describe what the learner does with the form, not only whether answers were right.',
      'The next lesson is close enough for the stage to still be accurate.',
    ],
    notEnough: [
      'The target is a broad skill like "speaking"; break it into forms or functions first.',
      'Evidence is older than several weeks; re-check before choosing a format.',
      'The learner\'s problem is confidence rather than control; a worksheet will not show that.',
    ],
    tutorDecision:
      'Before generating the next worksheet, write one line: target, current stage, chosen format, and what result would move the learner to the next stage.',
    example:
      'Constructed example. A B2 engineer gets the passive right in a transformation exercise but avoids it when describing a process aloud. The stage is "produced with support". The next worksheet drops transformation and asks for three written process descriptions of his own test procedure, followed by a two-minute spoken version in the lesson.',
    faqs: [
      ['Why not repeat the exercise the learner found hard?', 'Repeat only if the stage did not change; otherwise move to a format that tests the next stage.'],
      ['Can one worksheet cover several stages?', 'It can mix one review item with the new format, but keep the main decision single.'],
      ['How do I record a stage quickly?', 'One word per target after the lesson is enough: noticed, supported, independent or transferred.'],
      ['Do scores still matter?', 'They help within the same format; across formats, the stage description is more useful.'],
      ['What if the learner jumps two stages?', 'Confirm it with one independent task before skipping supported practice.'],
    ],
  },

  'best-lesson-prep-tool-for-english-tutors': {
    h1: 'Choosing a Lesson Prep Tool as a Private English Tutor',
    updated: '2026-10-22',
    keywords: ['lesson prep tool English tutor', 'evaluate tutor software', 'recurring lesson preparation'],
    sources: [FORMATIVE],
    directAnswer:
      'Judge a lesson prep tool across four consecutive lessons with one real learner, not by its first generated worksheet. Count how long it takes to recover where the learner is, how much you edit before using the material, and whether lesson three is easier to prepare than lesson one.',
    problem: [
      'Demos show a single impressive output and hide the cost of the second, third and tenth lesson.',
      'Tutors compare feature lists, while the real cost is re-explaining the learner to the tool every week.',
      'Heavy editing of every draft erases the time a tool claims to save.',
      'Some tools lock material into a format the tutor cannot change or deliver the way they teach.',
    ],
    solution: [
      'Pick one recurring learner and prepare four lessons in a row with each candidate tool.',
      'Time three things per lesson: recovering context, adapting the draft, and final checking.',
      'Note whether the tool remembered anything from earlier lessons or required the same brief again.',
      'Check delivery: can the learner open, answer and return the material in the way your lessons run?',
      'Keep the tool only if preparation time falls across the four lessons while your edits stay small.',
    ],
    mechanics: [
      'In Edooqoo, student context, homework results, notes and earlier worksheets stay attached to the student, and new worksheets are editable before sharing or export.',
      'Any tool you test should leave the final teaching decision with you; Edooqoo suggestions are drafts the tutor approves.',
    ],
    works: [
      'You teach recurring learners, so continuity is worth paying for.',
      'You can afford a short trial period with real lessons.',
      'Your current preparation time is spent mostly on searching and reformatting.',
    ],
    notEnough: [
      'You teach one-off sessions, where a simple drafting tool may be enough.',
      'Your preparation is mostly thinking about the learner, which no tool removes.',
      'Your organisation requires a specific platform for compliance reasons.',
    ],
    tutorDecision:
      'Decide after lesson four, using the three timings and the edit count; ignore how impressive the first draft looked.',
    example:
      'Constructed example. A tutor tests two tools with a B1 hotel manager. Tool A gives a polished first worksheet but needs the full brief every week and heavy edits. Tool B is plainer but by lesson three proposes a task built on the manager\'s homework errors. Total prep time falls with Tool B, so the tutor keeps it.',
    faqs: [
      ['Which single feature matters most?', 'Whether the tool keeps the learner\'s context and evidence so you do not rebuild it each week.'],
      ['How long should a trial last?', 'Long enough for four lessons with the same learner, because continuity only shows over time.'],
      ['Is a general chatbot enough?', 'For one-off drafting it can be; for recurring learners, check how much context you retype.'],
      ['Should students use the tool too?', 'Only if delivery and answers come back to you in a way that informs the next lesson.'],
      ['What warning signs should I watch for?', 'Rising edit time, repeated briefs, and materials you cannot change or export.'],
    ],
  },

  'english-tutor-material-organization-workflow': {
    h1: 'Organising Teaching Materials Around Each Learner',
    updated: '2026-10-22',
    keywords: ['organise ESL materials', 'tutor resource system', 'reuse lesson materials'],
    sources: [RETRIEVAL],
    directAnswer:
      'Organise materials by learner and by next use, not by topic folders. For each item, keep three facts: who it was for, what the learner did with it, and when it should come back. A folder system answers "where is it"; a learner system answers "what should this student see next".',
    problem: [
      'Topic folders grow to hundreds of files, and finding the right worksheet takes longer than writing a new one.',
      'Tutors forget which learner already saw a text, so material is repeated by accident or never revisited on purpose.',
      'Good material made for one learner is lost because nobody recorded why it worked.',
      'Downloads, links, notes and recordings live in different apps, so preparing a lesson means searching four places.',
    ],
    solution: [
      'Attach every item to the learner it was used with, along with the date and one line on how it went.',
      'Mark items for a planned return: review in two weeks, reuse with less support, or retire.',
      'Keep a small personal library of formats that worked across learners, separate from learner records.',
      'Store the learner\'s own language samples next to the material they produced them with.',
      'Delete or archive what you would not use again; a smaller library gets used.',
    ],
    mechanics: [
      'In Edooqoo, worksheets, homework, flashcard sets and notes are listed per student, with deleted items kept separately so they can be restored.',
      'A worksheet can be duplicated and edited for another learner instead of starting from zero.',
    ],
    works: [
      'You teach several recurring learners and reuse formats between them.',
      'You lose time looking for material you know you made.',
      'You want review to happen on purpose rather than by accident.',
    ],
    notEnough: [
      'You teach only a fixed course book with no extra material.',
      'Your material is mostly live conversation, so there is little to organise.',
      'Your employer prescribes a shared repository you must use.',
    ],
    tutorDecision:
      'When you finish a lesson, tag each item used with keep, review or retire before closing the file; the decision is cheaper now than later.',
    example:
      'Constructed example. A tutor has eight business learners and a folder called "Meetings" with sixty files. She moves to per-learner records with a one-line outcome. Before a lesson with a project lead, she sees the agenda-setting worksheet from three weeks ago marked "review", reuses it with less support, and skips the search entirely.',
    faqs: [
      ['Do I still need topic folders?', 'A small personal library of proven formats is useful; learner records should be the main entry point.'],
      ['How detailed should the outcome note be?', 'One line is enough: what the learner managed and what broke.'],
      ['What about copyrighted materials?', 'Store links or references, and only copy what you are licensed to use.'],
      ['How often should I clean up?', 'Retire items at the end of each lesson and do a short review at the end of a course block.'],
      ['Can I share material between learners?', 'Yes, but adapt context and level; record which version each learner saw.'],
    ],
  },

  'how-english-tutors-track-what-to-teach-next': {
    h1: 'How English Tutors Track What to Teach Next',
    updated: '2026-10-22',
    keywords: ['track next lesson focus', 'tutor lesson notes system', 'what to teach next tracking'],
    sources: [FORMATIVE],
    directAnswer:
      'Track five short facts after every lesson: the current goal, one thing the learner did alone for the first time, the most costly gap, one item due for delayed recall, and the next real event they face. Choose the next lesson by asking which of those five has changed.',
    problem: [
      'Long lesson notes are written and never reread before the next session.',
      'Notes record what was covered, not what the learner can now do, so planning restarts from the syllabus.',
      'Several gaps compete, and the loudest recent error wins over the one that costs the learner most at work.',
      'Upcoming events such as a review meeting are mentioned in passing and forgotten.',
    ],
    solution: [
      'Use a fixed five-line template so notes are comparable from lesson to lesson.',
      'Write the independent success in the learner\'s words, quoting what they actually said or wrote.',
      'Rank gaps by consequence: what goes wrong for the learner outside the lesson if this stays.',
      'Pick one recall item per lesson from earlier work, not from the lesson just finished.',
      'Put the next real event at the top; if it is close, it overrides the other lines.',
    ],
    mechanics: [
      'Edooqoo keeps teacher notes, homework results and lesson history on a student timeline, and the Prep view shows the next suggested lesson the tutor can accept or change.',
      'Notes can be captured quickly and classified in the background, so the tutor does not need a strict format to save them.',
    ],
    works: [
      'You teach the same learners repeatedly and plan between lessons.',
      'You can spend two minutes after a lesson writing five lines.',
      'Your learners have goals with dates or consequences.',
    ],
    notEnough: [
      'The learner has no defined goal yet; set one before tracking against it.',
      'You need a formal progress report for a sponsor, which needs more structure.',
      'Lessons follow a mandatory course plan with no room to change focus.',
    ],
    tutorDecision:
      'Before planning, read the last two five-line notes side by side and choose the line that changed most; that line is the next lesson focus.',
    example:
      'Constructed example. A finance learner\'s notes show the same costly gap for three lessons: explaining a delay without sounding defensive. This week the "next event" line says "quarter close call in 10 days". The tutor makes the call the next lesson and puts the delay explanation inside it.',
    faqs: [
      ['Why only five lines?', 'Short notes get reread; long notes rarely do.'],
      ['Should I track every error?', 'No. Track the gap with the highest cost for the learner and one recall item.'],
      ['How do I rank gaps?', 'Ask what goes wrong for the learner at work or in life if the gap stays.'],
      ['What if nothing changed between lessons?', 'Change the task type or difficulty, because the current approach is not producing new evidence.'],
      ['Can learners write the notes?', 'They can add the next event and their own view; the tutor still writes the evidence lines.'],
    ],
  },

  'cefr-aligned-worksheet-generation-workflow': {
    h1: 'CEFR-Aligned Worksheets: Leveling the Task, Not the Learner',
    updated: '2026-10-22',
    keywords: ['CEFR aligned worksheet', 'CEFR descriptors task design', 'level appropriate exercises'],
    sources: [CEFR],
    directAnswer:
      'A CEFR-aligned worksheet targets what a learner can do with language at a level, not a label attached to the person. Choose the descriptor for the task you want, set support around it, and check the output against that descriptor. One learner may need B2 reading tasks and B1 speaking tasks in the same week.',
    problem: [
      'A single level label hides uneven profiles: strong reading, weaker listening, much weaker spontaneous speaking.',
      'Worksheets labeled "B1" are often leveled only by vocabulary, while the task itself demands B2 discourse.',
      'Learners feel insulted by easy material in their strong skill and lost in hard material in their weak one.',
      'Tutors cite CEFR without checking the descriptors, so the level becomes a marketing word.',
    ],
    solution: [
      'Start from a can-do descriptor for the skill and situation, for example handling a straightforward complaint on the phone.',
      'Level three things separately: the input text, the support provided, and the output expected.',
      'Raise difficulty by removing support before raising input complexity.',
      'Check the learner\'s answers against the descriptor, not against a native-speaker ideal.',
      'Record the level per skill, so the next worksheet is set by the skill it trains.',
    ],
    mechanics: [
      'The Edooqoo worksheet form takes a CEFR level group (A1/A2, B1/B2, C1/C2) with the topic, goal and grammar focus, and the generated worksheet stays editable.',
      'The free CEFR level test on Edooqoo is an anonymous self-check, not a certified level.',
    ],
    works: [
      'You know the learner\'s profile per skill, even roughly.',
      'You can name the situation the task should prepare for.',
      'You review the draft for level fit before use.',
    ],
    notEnough: [
      'The learner needs a certified level, which only an accredited exam provides.',
      'You have no evidence yet; run a diagnostic first.',
      'The task is free conversation with no defined output.',
    ],
    tutorDecision:
      'Before generating, write the descriptor in plain words and the support you will remove next time; if you cannot, the worksheet is leveled by guesswork.',
    example:
      'Constructed example. A customer success manager reads technical documentation easily but struggles on calls with upset clients. The tutor keeps reading tasks at B2 and builds a B1 speaking worksheet: a complaint scenario with a phrase bank, then the same scenario without it the following week.',
    faqs: [
      ['Is CEFR a level of a person or a task?', 'Descriptors describe what someone can do; in planning, it is most useful to level each task.'],
      ['Can one learner be at two levels?', 'Yes. Uneven profiles across skills are common in adults.'],
      ['How do I make a task harder without new vocabulary?', 'Reduce support, add time pressure or require a longer, more organised answer.'],
      ['Should worksheets show the CEFR level to the learner?', 'Only if it helps motivation; the descriptor is more useful than the label.'],
      ['Where are the official descriptors?', 'In the Council of Europe CEFR Companion Volume.'],
    ],
  },

  'business-english-material-generation-workflow': {
    h1: 'Generating Business English Material for One Real Task',
    updated: '2026-10-22',
    keywords: ['business English materials', 'workplace English worksheet', 'generate business English tasks'],
    sources: [CEFR],
    directAnswer:
      'Generate Business English material from one action the learner must perform: who they speak to, what is at stake, and what register the situation requires. A worksheet about "meetings" is generic; a worksheet about telling a client a delivery is late, without losing the account, is teaching.',
    problem: [
      'Business topics such as negotiations or presentations are too broad, so generated material sounds like a textbook unit.',
      'Learners in finance, IT or healthcare meet vocabulary lists that miss their actual documents and conversations.',
      'Register is ignored: the same phrases are offered for a CEO update and a chat with a colleague.',
      'Confidential details from the learner\'s job end up in prompts when the tutor tries to make material realistic.',
    ],
    solution: [
      'Write a one-line brief: role, audience, purpose, consequence, for example "IT lead tells the finance director a project needs more budget".',
      'Name the register: formal written, neutral spoken, informal internal chat.',
      'Ask for language the learner must produce, such as softening bad news or proposing options, not just vocabulary.',
      'Replace real names, figures and clients with plausible invented ones before generating.',
      'Finish with a task the learner performs in the lesson, then keep the draft only if it fits their real situation.',
    ],
    mechanics: [
      'The Edooqoo worksheet form accepts lesson topic, goal, grammar focus, level and language style, and can attach a student so the draft reflects their stored context.',
      'The tutor edits the draft before sharing it as an interactive worksheet or exporting it.',
    ],
    works: [
      'The learner can describe a recurring work situation in detail.',
      'You can turn their description into a short brief.',
      'The lesson includes live practice of the same situation.',
    ],
    notEnough: [
      'The learner\'s work is confidential to the point that no realistic scenario can be invented.',
      'The goal is general conversation, not workplace performance.',
      'The learner needs subject expertise from you, such as legal advice, rather than language.',
    ],
    tutorDecision:
      'Keep a generated business worksheet only if the learner says "I actually have to do this"; otherwise rewrite the brief with them.',
    example:
      'Constructed example. A B2 procurement specialist must tell a supplier that payment terms are changing. The brief: specialist to long-term supplier, firm but relationship-preserving, written email then follow-up call. The worksheet practises softening phrases and alternatives, with invented company names, and the lesson ends with the call role play.',
    faqs: [
      ['How specific should a business brief be?', 'Specific enough to name role, audience, purpose and consequence in one line.'],
      ['Should I use the learner\'s real documents?', 'Use their structure and style, but remove confidential names, numbers and clients.'],
      ['Do vocabulary lists still help?', 'Yes, if the vocabulary is taken from the task the learner must perform.'],
      ['How do I handle register?', 'Name it in the brief and include a contrast task between two registers when useful.'],
      ['Can one worksheet serve several learners in the same industry?', 'As a starting point, but adapt the audience and consequence to each learner.'],
    ],
  },

  'homework-mistakes-next-english-lesson': {
    h1: 'Turning Homework Mistakes Into the Next English Lesson',
    updated: '2026-10-22',
    keywords: ['homework mistakes next lesson', 'ESL homework error analysis', 'adult learner homework feedback'],
    sources: [FORMATIVE, RETRIEVAL],
    directAnswer:
      'Sort homework errors before you react to them. Separate one-off slips, misunderstood instructions, retrieval failures on known language, and genuine gaps; only recurring gaps that matter for the learner\'s goal should become the next lesson focus. The rest get a quick note, a recall item or nothing.',
    problem: [
      'Tutors correct every error in red, the learner reads the corrections once, and the same errors return.',
      'A misunderstood instruction produces many wrong answers that look like a grammar problem but are not.',
      'Errors on language taught last week are treated as new gaps, when the issue is forgetting, not understanding.',
      'The next lesson is planned before the homework is reviewed, so the evidence arrives too late to matter.',
      'Adults lose motivation when homework feels like a test with no consequence for what happens next.',
    ],
    solution: [
      'Review homework before planning the lesson, even if only five minutes before it starts.',
      'Label each error with one of four types: slip, instruction, retrieval, gap.',
      'Look for patterns: a gap counts only if it appears at least twice or in different items.',
      'Rank recurring gaps by how much they affect the learner\'s real communication goal.',
      'Turn the top gap into the opening task of the next lesson and add one retrieval item for forgotten language.',
      'Tell the learner how their homework changed the plan, so the work has a visible consequence.',
    ],
    mechanics: [
      'In Edooqoo, homework is answered through a link, closed items are checked against the key, and uncertain text answers are flagged for teacher review instead of being marked wrong.',
      'Submitted homework waiting for review appears to the teacher, and reviewed results feed the student\'s skill record that later lessons use.',
    ],
    works: [
      'The learner completes homework regularly enough to show patterns.',
      'You can review it before the next lesson.',
      'Homework tasks target something you taught, so errors are interpretable.',
    ],
    notEnough: [
      'Homework is rarely done; shorten it or move practice into the lesson.',
      'The tasks were too easy, so there are no errors to learn from.',
      'The learner used translation tools for everything; the answers show the tool, not the learner.',
    ],
    tutorDecision:
      'Choose one recurring gap and one retrieval item from the homework; if you cannot find a recurring gap, raise the difficulty of the next homework instead of inventing a focus.',
    example:
      'Constructed example. A B1 operations manager submits ten items on reporting incidents. Three wrong answers come from misreading the instruction, two are slips, and four show the same gap: past simple versus present perfect when reporting what has been fixed. The next lesson opens with a short incident update he gives aloud using his own week, and the misread instruction gets a one-line clarification.',
    faqs: [
      ['Should I correct every homework error?', 'No. Mark the patterns that matter and leave slips with a light note.'],
      ['How do I spot a misunderstood instruction?', 'Many items fail in the same way, often even on language the learner normally gets right.'],
      ['What counts as a recurring gap?', 'The same type of error in at least two items or in two different homework sets.'],
      ['How long should homework review take?', 'A few minutes per assignment is enough when you sort by type instead of correcting line by line.'],
      ['Should I tell the learner about the four types?', 'Yes. Adults appreciate knowing whether an error was carelessness, forgetting or a real gap.'],
    ],
  },

  'can-ai-plan-one-to-one-english-lesson': {
    h1: 'Can AI Plan a One-to-One English Lesson?',
    updated: '2026-10-22',
    keywords: ['can AI plan English lesson', 'AI lesson planning limits', 'teacher review AI lesson'],
    sources: [CEFR],
    directAnswer:
      'AI can draft the parts of a one-to-one lesson that follow from a clear brief: texts, exercises, answer keys and role cards. It cannot decide what this learner needs next, judge whether a scenario is appropriate for them, or adapt when the learner surprises you in the lesson. Those decisions stay with the tutor.',
    problem: [
      'A request such as "plan a B2 lesson on negotiation" produces a plausible plan for no one in particular.',
      'Drafts can contain wrong keys, unnatural phrasing or cultural assumptions a learner would notice.',
      'Tutors who accept full AI plans lose the habit of diagnosing, which is the skill learners pay for.',
      'The plan cannot react live: if the learner already knows the target, the lesson needs a different turn.',
    ],
    solution: [
      'Decide the objective yourself from evidence, then ask AI only for materials that serve it.',
      'Give the draft a context that matters to the learner and a level per skill, not a single label.',
      'Check every key, and remove anything you would not say to this person.',
      'Plan two branches yourself: what to do if the task is too easy, and what to do if it collapses.',
      'After the lesson, note what the draft got wrong so the next brief improves.',
    ],
    mechanics: [
      'Edooqoo generates editable worksheets from a brief and can use the attached student\'s stored context; learning plan suggestions are proposals the teacher approves, edits or dismisses.',
      'Nothing is sent to a learner until the tutor shares it.',
    ],
    works: [
      'You know what the learner needs and want materials faster.',
      'You review drafts before using them.',
      'You keep live adaptation in your own hands.',
    ],
    notEnough: [
      'You have not diagnosed the learner yet; AI will fill the gap with generic content.',
      'You cannot review the output before the lesson.',
      'The lesson depends on sensitive personal or professional context you should not share with a tool.',
    ],
    tutorDecision:
      'Approve the objective first, the materials second and the live plan third; if the AI draft changed your objective, ask whether the evidence or the tool made that choice.',
    example:
      'Constructed example. A tutor knows from homework that a B2 marketing lead struggles to disagree politely with senior colleagues. She asks AI for three short meeting extracts and a phrase bank, deletes one extract that sounds aggressive, and prepares a fallback: if the learner handles the extracts easily, she switches to an unscripted role play about a real campaign decision.',
    faqs: [
      ['Can AI choose the lesson objective?', 'It can suggest one, but the tutor should confirm it against evidence from the learner.'],
      ['Is an AI lesson plan safe to use without review?', 'No. Check keys, level, tone and appropriacy first.'],
      ['Will AI replace one-to-one tutors?', 'It reduces drafting time; diagnosis, judgment and live adaptation remain the tutor\'s work.'],
      ['What should I give AI as context?', 'The objective, level per skill, a relevant situation and the format you want, without confidential details.'],
      ['How do I improve AI drafts over time?', 'Write down what you had to change after each lesson and include that in the next brief.'],
    ],
  },

  'how-long-should-private-english-tutors-spend-on-lesson-prep': {
    h1: 'How Long Should Private English Tutors Spend on Lesson Prep?',
    updated: '2026-10-22',
    keywords: ['lesson prep time English tutor', 'reduce lesson preparation', 'tutor prep benchmark'],
    sources: [FORMATIVE],
    directAnswer:
      'For a recurring learner whose context you already hold, focused preparation can often fit into 5 to 15 minutes; a new learner, a technical field or a high-stakes event needs more. Measure where the minutes go, then cut searching and formatting before you cut thinking about the learner.',
    problem: [
      'Tutors underestimate prep time because it is spread across evenings and messages.',
      'Most of the time goes into finding material and remembering the learner, not into deciding the lesson.',
      'Unpaid prep lowers the real hourly rate, and long prep for every lesson leads to burnout.',
      'Cutting prep blindly removes the review step, which is where quality is protected.',
    ],
    solution: [
      'Time one week of preparation split into four parts: recalling the learner, deciding the focus, finding or making material, checking it.',
      'Shrink recall with a short note after each lesson, so you do not rebuild the picture before the next one.',
      'Shrink search with a small library of formats you reuse across learners.',
      'Protect the deciding and checking parts; they are what learners pay for.',
      'Batch preparation for similar learners and keep longer slots only for new or high-stakes sessions.',
    ],
    mechanics: [
      'Edooqoo aims at short recurring prep once student context exists: the Prep view shows recent evidence and a suggested next lesson, and the tutor edits a generated worksheet before use.',
      'The first setup of a new student takes longer; the short loop applies to later lessons.',
    ],
    works: [
      'You teach recurring learners and have some notes from earlier lessons.',
      'You are willing to measure your prep for a week.',
      'Your lessons follow a repeatable structure you can partly template.',
    ],
    notEnough: [
      'The learner is new and you need a diagnostic first.',
      'The lesson prepares a high-stakes event such as an interview, where extra prep is justified.',
      'The subject is technical and you need to learn the content yourself.',
    ],
    tutorDecision:
      'After a week of timing, cut the largest non-deciding block first; if deciding takes most of your time, improve your notes, not your tools.',
    example:
      'Constructed example. A tutor times her week and finds that recalling learners and searching for material take most of her prep, while deciding the focus takes little. She starts writing five-line notes after each lesson and reuses four worksheet formats. Prep for recurring learners shortens while her review step stays the same.',
    faqs: [
      ['Is one hour of prep per lesson normal?', 'It is common for new learners, but recurring learners usually need less once context is recorded.'],
      ['What should never be cut?', 'Deciding the lesson focus and checking the material.'],
      ['Should I charge for preparation?', 'Many tutors build prep into their rate; measuring it helps you price lessons honestly.'],
      ['Do templates make lessons repetitive?', 'Not if the content and context change; the structure can repeat.'],
      ['How does a tool help?', 'Mostly by keeping learner context and reducing search and formatting time.'],
    ],
  },

  'english-homework-ai-grading-workflow': {
    h1: 'AI Grading of English Homework: A Review Workflow for Tutors',
    updated: '2026-10-22',
    keywords: ['AI homework grading English', 'AI feedback open answers', 'teacher review AI scores'],
    sources: [FORMATIVE],
    directAnswer:
      'Use AI on English homework as a first reader, not a final judge. Closed items are checked against the answer key; open answers get an AI score and comment that the tutor reads before the learner sees a result. The tutor overrides any score that does not match what the learner meant or what the task asked.',
    problem: [
      'AI scores look precise, so tutors accept them even when the model misread a correct alternative.',
      'Models can be too generous with fluent but off-task answers and too harsh with short correct ones.',
      'Learners who see a raw AI score before the tutor comments lose trust when a correct answer is marked down.',
      'Tutors spend the time saved on grading arguing with scores they did not check.',
    ],
    solution: [
      'Let the key decide closed items, and treat AI explanations there as help for the learner, not as a score.',
      'Read AI comments on open answers as a summary of what to look at, then decide yourself.',
      'Check three things on each open answer: did the learner do the task, is the meaning clear, did they use the target language.',
      'Correct the score where you disagree, and note the type of disagreement to spot model weaknesses.',
      'Share the reviewed result with a short human comment pointing to the next lesson.',
    ],
    mechanics: [
      'In Edooqoo, closed items are scored by the key; AI may raise a typed answer the key marked wrong when it is a valid alternative, but never lowers a key-correct score.',
      'Uncertain text matches are flagged for teacher review, and AI results on open answers are signals the teacher sees and can correct.',
    ],
    works: [
      'Homework includes open answers you would otherwise read line by line.',
      'You review results before they reach the learner or soon after.',
      'You want consistent first-pass comments across learners.',
    ],
    notEnough: [
      'The homework is a formal assessment where only human marking is acceptable.',
      'You do not have time to review any AI output.',
      'The task depends on context the model does not have, such as a conversation from the lesson.',
    ],
    tutorDecision:
      'Review every open answer the AI scored low and a sample of those it scored high; adjust your trust in the tool from that sample, not from its confidence.',
    example:
      'Constructed example. A B1 learner writes "We postponed the launch because the supplier was late" where the key expected "delayed". The key marks it wrong, AI recognises a valid alternative and raises it, and the tutor confirms. On an open answer the AI praised for fluency, the tutor sees the learner ignored the question and lowers the score.',
    faqs: [
      ['Can AI grade English homework accurately?', 'It is useful as a first reader, but scores on open answers still need teacher review.'],
      ['Should AI scores override the answer key?', 'For closed items the key decides; a valid alternative can be raised, but correct key answers are never lowered.'],
      ['Should learners see AI scores directly?', 'Better after tutor review, or with a clear note that the tutor checks results.'],
      ['How do I spot model mistakes?', 'Review low scores and a sample of high scores and note recurring disagreements.'],
      ['Does AI grading save time?', 'It saves reading time on open answers when you review strategically instead of rechecking everything.'],
    ],
  },

  'formative-assessment-english-teaching': {
    h1: 'Formative Assessment in Adult One-to-One English Lessons',
    updated: '2026-10-22',
    keywords: ['formative assessment English', 'assessment for learning adult ESL', 'feedback loop one-to-one'],
    sources: [FORMATIVE, RETRIEVAL],
    directAnswer:
      'Formative assessment in a one-to-one lesson is a short loop: get a piece of evidence, give feedback the learner can act on immediately, and let them try again before the lesson ends. If the second attempt is not better, the feedback or the task needs to change, not the learner.',
    problem: [
      'Assessment is saved for tests, so tutors learn about gaps weeks after they could have acted.',
      'Feedback is a list of corrections with no chance to use it, so it fades by the next lesson.',
      'Adults feel judged by frequent testing that has no visible effect on what happens next.',
      'Tutors ask "Is that clear?" and accept "yes" as evidence of understanding.',
      'Feedback on several points at once leaves the learner unsure what to change first.',
    ],
    solution: [
      'Build one evidence moment into each lesson stage: a quick production, an explanation in the learner\'s words, a short recall.',
      'Replace "Is that clear?" with a task that requires using the point once.',
      'Give feedback on one point at a time, phrased as an action: "Start with the result, then the reason."',
      'Ask for a second attempt straight away and compare it with the first.',
      'End the lesson with an exit task that shows whether the focus moved, and use it to choose the next lesson.',
      'Share the comparison with the learner, so they see their own progress.',
    ],
    mechanics: [
      'Edooqoo worksheets can be completed interactively and checked in the lesson, and results from worksheets, homework and live work are recorded for the student so later lessons can use them.',
      'The tutor can mark an exercise as done in the lesson and adjust the recorded result.',
    ],
    works: [
      'The lesson has a clear focus that can be tried twice in one session.',
      'The learner accepts feedback and is willing to retry.',
      'You can make quick notes during the lesson.',
    ],
    notEnough: [
      'The learner needs a formal score for an employer or institution.',
      'The focus is a long-term skill that will not move in one lesson; use loops across lessons instead.',
      'The learner is anxious about any evaluation; start with low-stakes tasks without scoring.',
    ],
    tutorDecision:
      'Plan the exit task before the lesson; if you cannot say what result would show progress, the lesson focus is not yet clear.',
    example:
      'Constructed example. A B2 consultant summarises a project status in a rambling way. The tutor asks for a one-minute update, gives one action ("result first, then two reasons, then the next step"), and asks for a second version. The second is shorter and clearer. The exit task is the same update about a different project, recorded so the next lesson can compare.',
    faqs: [
      ['Is formative assessment the same as testing?', 'No. It is collecting evidence during learning so the next step can change.'],
      ['How often should I assess in one lesson?', 'At least once per lesson stage, in small tasks rather than formal tests.'],
      ['What makes feedback actionable?', 'It names one change the learner can make right away and lets them try again.'],
      ['How do I record formative evidence?', 'A short note of the first and second attempt is often enough.'],
      ['Does research support this approach?', 'Classroom research reviewed by Black and Wiliam reports learning gains from formative assessment practices.'],
    ],
  },

  'adult-esl-student-profile-lesson-planning': {
    h1: 'Adult ESL Student Profiles for Lesson Planning',
    updated: '2026-10-22',
    keywords: ['adult ESL student profile', 'learner profile lesson planning', 'student context English tutor'],
    sources: [CEFR],
    directAnswer:
      'An adult learner profile should hold only what changes your lesson decisions: the real goal and its date, situations where English is used, constraints on time and study, the level per skill, and recent evidence. Keep stable context separate from changing evidence, and leave out personal details that do not affect teaching.',
    problem: [
      'Intake forms collect hobbies, family details and long histories that are never used in planning.',
      'Stable facts and weekly observations are mixed together, so old evidence looks current.',
      'Profiles are written once at the start and not updated when the learner\'s job or goal changes.',
      'Sensitive information is stored without a reason, which is a privacy risk for the learner and the tutor.',
      'A single level label hides the uneven skills that should drive task choice.',
    ],
    solution: [
      'Split the profile into two parts: stable context, reviewed every few months, and evidence, updated after lessons.',
      'Write the goal as a performance with a date, such as "lead weekly team meetings by March".',
      'List three to five real situations where the learner uses English, with audience and stakes.',
      'Record constraints openly: available minutes, preferred formats, things that make lessons hard.',
      'Note the level per skill and the date of the last evidence for each.',
      'Remove anything you would not want to explain to the learner if they asked why you stored it.',
    ],
    mechanics: [
      'Edooqoo stores student details, goals and teacher notes, along with Welcome Test results and skill records; older skill results are shown as fading so they are not mistaken for current evidence.',
      'The profile is private to the teacher account and is used when the tutor attaches the student to a worksheet.',
    ],
    works: [
      'You teach the learner over several months.',
      'Their goal is specific enough to plan against.',
      'You update the evidence part after lessons.',
    ],
    notEnough: [
      'The learner is with you for one or two sessions only.',
      'You need a formal needs analysis for a corporate sponsor, which requires more structure.',
      'The learner prefers not to share work details; keep the profile minimal and ask permission before adding more.',
    ],
    tutorDecision:
      'Before each lesson, read the goal, the next situation and the newest evidence line; if a field has not influenced a decision in months, remove it.',
    example:
      'Constructed example. A new learner, a hospital administrator, fills in a long intake form. The tutor keeps four lines of stable context (goal: present budget updates to the board by June; situations: board meetings, emails to suppliers; constraint: twenty minutes of study a week; level: B2 reading, B1 speaking) and starts an evidence section after lesson one. Family details from the form are not stored.',
    faqs: [
      ['What should an adult learner profile include?', 'Goal with date, real situations, constraints, level per skill and recent evidence.'],
      ['How often should I update it?', 'Evidence after lessons; stable context every few months or when something changes.'],
      ['Should I store personal information?', 'Only what affects teaching, with the learner\'s knowledge.'],
      ['How is a profile different from lesson notes?', 'The profile summarises what matters for planning; notes record what happened.'],
      ['Can the learner see their profile?', 'Sharing goals and evidence often helps motivation; keep private teacher notes separate.'],
    ],
  },

  'how-to-plan-english-lessons-effectively': {
    h1: 'How to Plan Adult English Lessons Effectively',
    updated: '2026-10-22',
    keywords: ['plan English lessons', 'adult lesson planning sequence', 'one-to-one lesson structure'],
    sources: [FOUR_STRANDS, CEFR],
    directAnswer:
      'Plan an adult lesson backwards from one thing the learner should be able to do at the end. Choose the evidence that will show it, then build a sequence from recall of earlier work to supported practice to independent use, and close with a check that decides the next lesson.',
    problem: [
      'Lessons are planned as a list of activities, so the learner leaves without one clear gain.',
      'Plans copy a coursebook order that does not match the learner\'s goal or calendar.',
      'Too much new language enters each lesson, and nothing is recycled.',
      'There is no defined end point, so the tutor cannot tell whether the lesson worked.',
    ],
    solution: [
      'Write the outcome as an observable action: "explain a delay to a client in under a minute".',
      'Decide how you will see it: a role play, a short written piece, a recorded answer.',
      'Open with a short recall of language from earlier lessons that the outcome needs.',
      'Move from supported practice with a model or phrase bank to the same task with less support.',
      'Balance input, focused practice and fluency across the week, not necessarily in every lesson.',
      'Close with the evidence task and one sentence on what the next lesson will build on.',
    ],
    mechanics: [
      'Edooqoo shows the next suggested lesson and recent evidence for each student, and worksheets can be generated for the chosen objective and edited before use.',
      'The plan remains the tutor\'s; suggestions can be accepted, changed or ignored.',
    ],
    works: [
      'You teach recurring learners with a known goal.',
      'You can name one outcome per lesson.',
      'You keep short records so recall can be planned.',
    ],
    notEnough: [
      'The learner explicitly wants free conversation practice without a target; plan topics and notes instead.',
      'The course has a fixed external syllabus you must follow.',
      'You have no evidence yet about the learner; plan a diagnostic lesson first.',
    ],
    tutorDecision:
      'If you cannot describe the closing evidence task before the lesson, shrink the outcome until you can.',
    example:
      'Constructed example. Outcome for a B1 project coordinator: "give a two-minute status update that names a blocker and asks for help". The lesson opens with recall of last week\'s phrases for deadlines, moves to a model update and a guided version, then a free version on her real project. The closing recording shows she names the blocker but forgets to ask for help, which becomes the next lesson\'s starting point.',
    faqs: [
      ['How many objectives should one lesson have?', 'One main outcome, with recall and practice serving it.'],
      ['Should every lesson include all four skills?', 'Not necessarily; balance skills across the week or the course.'],
      ['How much new language is too much?', 'If the learner cannot use most of it in the closing task, there was too much.'],
      ['What is the four strands idea?', 'Nation suggests balancing meaning-focused input, meaning-focused output, language-focused learning and fluency development.'],
      ['How do I plan when the learner cancels often?', 'Keep outcomes small enough to finish in one session and open each lesson with recall.'],
    ],
  },

  'esl-exercise-type-selection-guide': {
    h1: 'Choosing ESL Exercise Types for Adult One-to-One Lessons',
    updated: '2026-10-22',
    keywords: ['ESL exercise types', 'choose exercise format', 'gap fill vs open questions'],
    sources: [RETRIEVAL],
    directAnswer:
      'Choose the exercise type by the question you want answered about the learner. Matching and multiple choice show whether they recognise a form; gap fill and transformation show supported production; error correction shows noticing; open questions, role cards and short writing show independent use.',
    problem: [
      'Exercise types are picked for variety, so a worksheet tests five things weakly instead of one thing clearly.',
      'Recognition tasks are passed and read as proof the learner can use the language.',
      'Open tasks are given too early, and the learner avoids the target form entirely.',
      'Some formats feel childish to adults when the content is generic, even if the format itself is sound.',
    ],
    solution: [
      'Write the question first: does the learner notice, recognise, produce with help, or use freely?',
      'Map it to the format: error spotting for noticing, multiple choice for recognition, gap fill or transformation for supported production, open questions for free use.',
      'Use at most two types per worksheet when the goal is diagnosis.',
      'Fill every format with the learner\'s own context, which keeps even simple formats adult.',
      'Follow a recognition task with at least one production task before concluding anything.',
    ],
    mechanics: [
      'Edooqoo offers many exercise types, and the tutor can select them manually, randomly or from suggestions when creating a worksheet.',
      'Closed types are scored by the key; open types can receive AI-assisted evaluation the teacher reviews.',
    ],
    works: [
      'You know what you want to find out about the learner.',
      'The target is a specific form or function.',
      'You can adjust the format after seeing results.',
    ],
    notEnough: [
      'The target is fluency under pressure, which needs live speaking more than any worksheet.',
      'You have not chosen a target yet.',
      'The learner needs exam-specific formats, which should match the exam.',
    ],
    tutorDecision:
      'Before selecting formats, finish the sentence "After this worksheet I will know whether the learner can ___"; choose only formats that answer it.',
    example:
      'Constructed example. A tutor wants to know whether a B1 HR officer can use polite indirect questions. Multiple choice would only show recognition, so she uses a transformation task ("Where is the form?" to "Could you tell me where the form is?") and three open prompts from interviews the officer runs. The open prompts show the officer avoids the form when speaking freely.',
    faqs: [
      ['Which exercise type is best?', 'None in general; the best type answers the question you have about the learner.'],
      ['Are gap fills too easy for adults?', 'Not if the context is relevant and the gap tests one real decision.'],
      ['How many exercise types should one worksheet have?', 'One or two for diagnosis; more only for review.'],
      ['When should I use open questions?', 'When you want to see whether the learner uses the target without prompts.'],
      ['Why does production matter after recognition?', 'Retrieval research suggests producing from memory strengthens learning more than recognising.'],
    ],
  },

  'process-writing-approach-esl': {
    h1: 'Process Writing for Adult English Learners: Drafts as Evidence',
    updated: '2026-10-22',
    keywords: ['process writing ESL', 'adult writing drafts feedback', 'revision English writing'],
    sources: [FORMATIVE],
    directAnswer:
      'Treat each draft as evidence for one revision decision. Read the first draft for the biggest issue for the reader, such as structure, tone or clarity, give feedback on that alone, and ask for a second draft. Correct grammar in detail only once the text does its job.',
    problem: [
      'Tutors correct every grammar mistake in the first draft, and the learner fixes words while the structure stays unclear.',
      'Learners rewrite by copying corrections without understanding why, so the next text repeats the same problems.',
      'Writing tasks are invented ("write about your weekend") instead of texts the adult actually needs to send.',
      'There is no comparison between drafts, so neither side sees improvement.',
    ],
    solution: [
      'Use a real text type: a status email, a complaint response, a short report, a LinkedIn summary.',
      'Read draft one as the intended reader and name the one change that would help them most.',
      'Ask for draft two with only that change, then look at accuracy.',
      'Highlight error patterns instead of correcting everything, and let the learner fix them.',
      'Compare draft one and the final version together and name what improved.',
    ],
    mechanics: [
      'In Edooqoo, writing tasks can be set as homework or open questions in a worksheet; AI-assisted evaluation of open answers is a signal for the teacher, who gives the final feedback.',
      'Error patterns from writing can be turned into a follow-up worksheet the tutor edits before sharing.',
    ],
    works: [
      'The learner writes regularly at work or in study.',
      'There is time for at least two drafts across lessons.',
      'The learner is willing to revise rather than only receive corrections.',
    ],
    notEnough: [
      'The learner needs a timed exam essay, which also requires writing under exam conditions.',
      'The text is urgent and will be sent today; edit it together instead.',
      'The learner rarely writes in English and needs speaking more.',
    ],
    tutorDecision:
      'After each draft, write the one change that matters most for the reader; if you list more than one, choose the one that affects meaning.',
    example:
      'Constructed example. A B2 marketing analyst drafts an email asking a vendor to fix a report. The first draft buries the request in the fourth paragraph. Feedback: "Put the request in the first two lines." Draft two does that, and only then the tutor highlights a pattern of missing articles, which the analyst corrects herself.',
    faqs: [
      ['How many drafts should adults write?', 'Two or three are usually enough for workplace texts.'],
      ['Should I correct grammar in the first draft?', 'Only if it blocks meaning; structure and clarity come first.'],
      ['What texts should adults practise?', 'The ones they actually write, such as emails, reports and summaries.'],
      ['How do I give feedback without rewriting the text?', 'Name the change and let the learner make it, or highlight a pattern.'],
      ['How do I show progress in writing?', 'Compare the first and final drafts and name specific improvements.'],
    ],
  },
};

export const STRATEGIC_BOILERPLATE_REWRITE_SLUGS = Object.freeze(
  Object.keys(STRATEGIC_BOILERPLATE_REWRITES).map((slug) => `${slug}.html`),
);
