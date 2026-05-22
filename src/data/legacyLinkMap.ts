// v6.9.21 — Map historical .html SEO landing slugs to existing programmatic routes.
// Anything ending with .html that is NOT in this map is treated as "coming soon"
// (rendered as a non-clickable tile by resolveLegacyHref consumers).
export const LEGACY_LINK_MAP: Record<string, string> = {
  // Top-level generator pages
  "/ai-worksheet-generator-for-english-teachers.html": "/",
  "/cefr-worksheet-generator.html": "/esl-worksheets",
  "/grammar-worksheet-generator.html": "/esl-worksheets",
  "/vocabulary-exercise-generator.html": "/esl-worksheets",
  "/fill-in-the-blanks-worksheet-generator.html": "/esl-worksheets",
  "/reading-comprehension-worksheet-maker.html": "/esl-worksheets",
  "/multiple-choice-quiz-generator-english.html": "/esl-worksheets",
  "/listening-comprehension-exercises-esl.html": "/esl-worksheets",
  "/business-english-worksheet-generator.html": "/esl-worksheets",
  "/exam-preparation-worksheets-cambridge-ielts.html": "/esl-worksheets",

  // CEFR levels
  "/a1-beginner-english-worksheets.html": "/esl-worksheets",
  "/a2-elementary-english-worksheets.html": "/esl-worksheets",
  "/b1-intermediate-english-worksheets.html": "/esl-worksheets",
  "/b2-upper-intermediate-english-worksheets.html": "/esl-worksheets",
  "/c1-advanced-english-worksheets.html": "/esl-worksheets",
  "/c2-proficiency-english-worksheets.html": "/esl-worksheets",

  // Grammar topics
  "/present-simple-worksheets.html": "/esl-worksheets",
  "/past-simple-worksheets.html": "/esl-worksheets",
  "/present-perfect-worksheets.html": "/esl-worksheets",
  "/conditionals-worksheets-english.html": "/esl-worksheets",
  "/passive-voice-worksheets-esl.html": "/esl-worksheets",
  "/modal-verbs-worksheets-esl.html": "/esl-worksheets",
  "/future-tenses-worksheets-english.html": "/esl-worksheets",
  "/phrasal-verbs-worksheets-esl.html": "/esl-worksheets",

  // Personas / audience landings
  "/ai-tools-for-private-english-tutors.html": "/for-english-tutors",
  "/worksheet-generator-for-language-schools.html": "/for-english-tutors",
  "/ai-tools-for-online-esl-teachers.html": "/for-english-tutors",
  "/english-worksheets-for-corporate-training.html": "/for-english-tutors",

  // Features
  "/esl-student-progress-tracking-tool.html": "/features/dslm",
  "/esl-homework-grading-tool.html": "/features/homework",
  "/ai-grading-tool-for-english-homework.html": "/features/homework",
  "/spaced-repetition-flashcards-esl.html": "/features/flashcards",

  // Productivity / how-to redirects to real guide
  "/online-english-teaching-tools.html": "/blog/teach-english-online-guide",
  "/how-to-save-time-as-english-teacher.html": "/blog/teach-english-online-guide",
  "/how-to-create-english-worksheets-with-ai.html": "/blog/teach-english-online-guide",
  "/best-ai-tools-for-esl-teachers.html": "/resources",
  "/ai-lesson-planning-for-english-teachers.html": "/resources",

  // Real blog posts (drop .html → clean slug)
  "/blog/english-games-for-learners.html": "/blog/english-games-for-learners",
  "/blog/esl-games-for-teachers.html": "/blog/esl-games-for-teachers",
  "/blog/teaching-english-online-complete-guide.html": "/blog/teach-english-online-guide",
};
