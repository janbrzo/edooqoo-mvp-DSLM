// sitemap-xml — serves canonical sitemap with proper application/xml MIME type.
// Required because Lovable static hosting wraps public/sitemap.xml in <html><body>
// and serves it as text/html, which Google Search Console rejects.
// Source of truth: public/sitemap.xml (keep manually in sync).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://edooqoo.com/</loc><priority>1.0</priority><changefreq>weekly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/about</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/pricing</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/prompts</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/exercise-types</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/how-it-works</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/glossary</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/signup</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/privacy-policy</loc><priority>0.3</priority><changefreq>yearly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/cookie-policy</loc><priority>0.3</priority><changefreq>yearly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Hub pages -->
  <url><loc>https://edooqoo.com/resources</loc><priority>0.9</priority><changefreq>weekly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog</loc><priority>0.9</priority><changefreq>weekly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Feature landing pages -->
  <url><loc>https://edooqoo.com/features/dslm</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <url><loc>https://edooqoo.com/features/homework</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <url><loc>https://edooqoo.com/features/flashcards</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <url><loc>https://edooqoo.com/features/calendar</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <url><loc>https://edooqoo.com/features/live-sessions</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <url><loc>https://edooqoo.com/features/placement-test</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <url><loc>https://edooqoo.com/features/student-hub</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-14</lastmod></url>
  <!-- Core landings -->
  <url><loc>https://edooqoo.com/ai-worksheet-generator-for-english-teachers.html</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/best-ai-tools-for-esl-teachers.html</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/cefr-worksheet-generator.html</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/how-to-create-english-worksheets-with-ai.html</loc><priority>0.9</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/esl-homework-grading-tool.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Exercise-specific landings -->
  <url><loc>https://edooqoo.com/fill-in-the-blanks-worksheet-generator.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/reading-comprehension-worksheet-maker.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/multiple-choice-quiz-generator-english.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/grammar-worksheet-generator.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/vocabulary-exercise-generator.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/listening-comprehension-exercises-esl.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- CEFR level landings -->
  <url><loc>https://edooqoo.com/a1-beginner-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/a2-elementary-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/b1-intermediate-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/b2-upper-intermediate-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/c1-advanced-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/c2-proficiency-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Use-case landings -->
  <url><loc>https://edooqoo.com/ai-lesson-planning-for-english-teachers.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/online-english-teaching-tools.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/business-english-worksheet-generator.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/exam-preparation-worksheets-cambridge-ielts.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/esl-student-progress-tracking-tool.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Problem-solving landings -->
  <url><loc>https://edooqoo.com/how-to-save-time-as-english-teacher.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/ai-grading-tool-for-english-homework.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/spaced-repetition-flashcards-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Comparison pages -->
  <url><loc>https://edooqoo.com/edooqoo-vs-islcollective.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/edooqoo-vs-liveworksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/edooqoo-vs-twee.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/edooqoo-vs-magicschool.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Persona pages -->
  <url><loc>https://edooqoo.com/ai-tools-for-private-english-tutors.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/worksheet-generator-for-language-schools.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/ai-tools-for-online-esl-teachers.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Phase 6: Grammar topic pages -->
  <url><loc>https://edooqoo.com/present-simple-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/past-simple-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/present-perfect-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/conditionals-worksheets-english.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/passive-voice-worksheets-esl.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/reported-speech-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/articles-a-an-the-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/prepositions-worksheets-english.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Phase 6: Topic pages -->
  <url><loc>https://edooqoo.com/travel-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/food-and-cooking-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/job-interview-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/health-and-body-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/environment-climate-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/technology-english-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Phase 6: Audience pages -->
  <url><loc>https://edooqoo.com/english-worksheets-for-kids.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/english-worksheets-for-teenagers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/english-worksheets-for-adults.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/english-worksheets-for-corporate-training.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/english-worksheets-for-exam-prep.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Blog articles (Phase 5) -->
  <url><loc>https://edooqoo.com/blog/how-to-create-grammar-worksheets-with-ai.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/vocabulary-teaching-strategies-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/reading-comprehension-activities-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/fill-in-the-blanks-exercises-best-practices.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/differentiated-instruction-english-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/how-to-assess-english-level-cefr.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-online-complete-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/spaced-repetition-vocabulary-learning.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/ai-tools-for-english-teachers-2026.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/ai-homework-grading-for-english-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/ai-generated-listening-exercises-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/personalized-learning-english-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/cambridge-exam-preparation-tips-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-business-english-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <url><loc>https://edooqoo.com/blog/ielts-preparation-worksheets-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-04-06</lastmod></url>
  <!-- Phase 6: Teaching Methods blog articles -->
  <url><loc>https://edooqoo.com/blog/communicative-language-teaching-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-16</lastmod></url>
  <url><loc>https://edooqoo.com/blog/task-based-language-teaching-worksheets.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-16</lastmod></url>
  <url><loc>https://edooqoo.com/blog/flipped-classroom-english-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-16</lastmod></url>
  <url><loc>https://edooqoo.com/blog/gamification-english-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-16</lastmod></url>
  <url><loc>https://edooqoo.com/blog/scaffolding-strategies-english-learners.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-16</lastmod></url>
  <url><loc>https://edooqoo.com/blog/formative-assessment-english-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-16</lastmod></url>
  <!-- Phase 7: Grammar expansion -->
  <url><loc>https://edooqoo.com/modal-verbs-worksheets-esl.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/future-tenses-worksheets-english.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/relative-clauses-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/gerunds-infinitives-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/comparatives-superlatives-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/phrasal-verbs-worksheets-esl.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/question-tags-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <!-- Phase 7: Skills pages -->
  <url><loc>https://edooqoo.com/speaking-activities-esl-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/writing-worksheets-esl.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/reading-activities-english-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/listening-activities-esl-worksheets.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <!-- Phase 7: New comparisons -->
  <url><loc>https://edooqoo.com/edooqoo-vs-quizlet.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/edooqoo-vs-kahoot.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/edooqoo-vs-wordwall.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/edooqoo-vs-busyteacher.html</loc><priority>0.8</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <!-- Phase 8: How to Teach blog -->
  <url><loc>https://edooqoo.com/blog/how-to-teach-english-grammar-effectively.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/blog/how-to-teach-speaking-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/blog/how-to-teach-writing-esl-students.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/blog/how-to-teach-english-pronunciation.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/blog/how-to-plan-english-lessons-effectively.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <url><loc>https://edooqoo.com/blog/classroom-management-esl-tips.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-17</lastmod></url>
  <!-- Phase 9: Blog Expansion -->
  <url><loc>https://edooqoo.com/blog/teaching-english-to-young-learners.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/esl-games-for-kids.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-to-teenagers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/english-songs-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/storytelling-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-collocations-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-idioms-esl-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/vocabulary-games-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/academic-vocabulary-teaching-strategies.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/word-formation-exercises-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-conditionals-esl-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-passive-voice-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-reported-speech-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-articles-esl-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/error-correction-techniques-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/creating-english-tests-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/rubrics-for-english-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/self-assessment-strategies-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/peer-feedback-activities-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/diagnostic-testing-english-learners.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/warm-up-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/role-play-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/debate-activities-english-class.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/pair-work-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/project-based-learning-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/tefl-certification-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teacher-burnout-prevention-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/building-esl-teaching-portfolio.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/using-ai-teacher-productivity.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <url><loc>https://edooqoo.com/blog/setting-up-freelance-esl-business.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-18</lastmod></url>
  <!-- Phase 10: Blog Mega-Expansion Part 2 -->
  <url><loc>https://edooqoo.com/blog/teaching-culture-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/cross-cultural-communication-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/using-films-english-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-through-literature.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/current-events-esl-lessons.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/best-apps-learning-english-2026.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/using-google-workspace-esl-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/creating-interactive-worksheets-online.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/video-conferencing-tips-online-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/ai-lesson-planning-strategies.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-immigrants-refugees.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/english-for-specific-purposes-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-learning-disabilities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/multilevel-esl-classroom-strategies.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-one-to-one.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-email-writing-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/creative-writing-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-presentation-skills-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/discussion-questions-esl-topics.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-formal-informal-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/first-day-esl-class-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/end-of-term-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/holiday-themed-esl-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/substitute-teacher-esl-lesson-plans.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/five-minute-filler-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-linking-words-connectors.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/corpus-linguistics-esl-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/contrastive-analysis-language-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-pragmatics-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <url><loc>https://edooqoo.com/blog/extensive-reading-programs-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-19</lastmod></url>
  <!-- Phase 11: Pronunciation & Phonology -->
  <url><loc>https://edooqoo.com/blog/teaching-minimal-pairs-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-intonation-stress.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/connected-speech-teaching-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/ipa-phonetic-alphabet-esl-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/accent-reduction-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <!-- Phase 11: Homework & Independent Learning -->
  <url><loc>https://edooqoo.com/blog/effective-esl-homework-strategies.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-study-skills-english-learners.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/self-directed-learning-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/flipped-homework-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/digital-homework-tools-esl-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <!-- Phase 11: Motivation & Engagement -->
  <url><loc>https://edooqoo.com/blog/motivating-reluctant-esl-learners.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/intrinsic-motivation-language-learning.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/student-autonomy-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/using-rewards-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/growth-mindset-language-learning.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <!-- Phase 11: Advanced Grammar -->
  <url><loc>https://edooqoo.com/blog/teaching-subjunctive-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-inversion-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-cleft-sentences-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-ellipsis-substitution-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-mixed-conditionals-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <!-- Phase 11: Listening Skills -->
  <url><loc>https://edooqoo.com/blog/teaching-listening-strategies-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/dictation-activities-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/using-podcasts-esl-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-note-taking-skills-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/authentic-listening-materials-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <!-- Phase 11: Parent & Stakeholder Communication -->
  <url><loc>https://edooqoo.com/blog/communicating-with-esl-parents.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/writing-student-progress-reports-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/parent-teacher-conferences-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/advocating-for-ell-students.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <url><loc>https://edooqoo.com/blog/collaborating-with-mainstream-teachers-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-21</lastmod></url>
  <!-- Phase 12: AI Discovery Files -->
  <url><loc>https://edooqoo.com/llms-answers.txt</loc><priority>0.5</priority><changefreq>monthly</changefreq><lastmod>2026-03-23</lastmod></url>
  <url><loc>https://edooqoo.com/knowledge-graph.json</loc><priority>0.5</priority><changefreq>monthly</changefreq><lastmod>2026-03-23</lastmod></url>
  <!-- Phase 13: Standardized Tests -->
  <url><loc>https://edooqoo.com/blog/toefl-preparation-strategies-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/toeic-preparation-worksheets-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/duolingo-english-test-preparation.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-test-taking-strategies-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/standardized-test-comparison-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <!-- Phase 13: Classroom Language -->
  <url><loc>https://edooqoo.com/blog/classroom-language-esl-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/giving-instructions-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/concept-checking-questions-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teacher-talking-time-reducing.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/eliciting-techniques-esl-teaching.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <!-- Phase 13: Reading Skills -->
  <url><loc>https://edooqoo.com/blog/teaching-skimming-scanning-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-critical-reading-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/graded-readers-guide-esl-teachers.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-reading-fluency-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/newspaper-articles-esl-lessons.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <!-- Phase 13: Online & Hybrid -->
  <url><loc>https://edooqoo.com/blog/hybrid-teaching-esl-strategies.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/breakout-rooms-esl-activities.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/digital-whiteboard-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/asynchronous-learning-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/building-community-online-esl-class.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <!-- Phase 13: Speaking & Fluency -->
  <url><loc>https://edooqoo.com/blog/fluency-activities-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/conversation-classes-esl-structure.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-functional-language-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/shadowing-technique-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/impromptu-speaking-activities-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <!-- Phase 13: Feedback & Correction -->
  <url><loc>https://edooqoo.com/blog/giving-written-feedback-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/oral-correction-timing-techniques.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/marking-codes-esl-writing.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/conferencing-with-esl-students.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <url><loc>https://edooqoo.com/blog/positive-error-culture-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-24</lastmod></url>
  <!-- Phase 14: Classroom Management Advanced -->
  <url><loc>https://edooqoo.com/blog/managing-behavior-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/seating-arrangements-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/transitions-activities-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/energy-management-esl-lessons.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/managing-large-esl-classes.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <!-- Phase 14: Writing Skills -->
  <url><loc>https://edooqoo.com/blog/teaching-essay-structure-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/process-writing-approach-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/peer-editing-workshops-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/journal-writing-esl-students.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/portfolio-assessment-esl-writing.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <!-- Phase 14: ESP by Industry -->
  <url><loc>https://edooqoo.com/blog/teaching-medical-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-legal-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-hospitality-tourism.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-it-professionals.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-aviation-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <!-- Phase 14: CLIL & Bilingual Education -->
  <url><loc>https://edooqoo.com/blog/clil-methodology-complete-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/teaching-science-through-english.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/emi-english-medium-instruction-guide.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/bilingual-education-models-comparison.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/academic-language-functions-clil.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <!-- Phase 14: Assessment Design -->
  <url><loc>https://edooqoo.com/blog/designing-english-midterm-final-exams.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/cloze-test-design-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/item-analysis-english-tests.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/washback-effect-language-testing.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/alternative-assessment-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <!-- Phase 14: Inclusive & Diverse Classrooms -->
  <url><loc>https://edooqoo.com/blog/neurodiversity-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/trauma-informed-teaching-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/culturally-responsive-teaching-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/gender-inclusive-language-esl.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url><loc>https://edooqoo.com/blog/heritage-speakers-esl-classroom.html</loc><priority>0.7</priority><changefreq>monthly</changefreq><lastmod>2026-03-25</lastmod></url>
  <url>
    <loc>https://edooqoo.com/blog/syllabus-design-esl-courses.html</loc>
    <lastmod>2025-11-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/needs-analysis-esl-students.html</loc>
    <lastmod>2025-11-26</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/selecting-esl-textbooks-guide.html</loc>
    <lastmod>2025-11-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/course-evaluation-esl-programs.html</loc>
    <lastmod>2025-11-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/lesson-sequencing-scaffolding-curriculum.html</loc>
    <lastmod>2025-11-29</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/drama-techniques-esl-classroom.html</loc>
    <lastmod>2025-11-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/improvisation-activities-esl.html</loc>
    <lastmod>2025-12-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/readers-theatre-esl-activities.html</loc>
    <lastmod>2025-12-02</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/art-based-language-activities-esl.html</loc>
    <lastmod>2025-12-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/using-comics-graphic-novels-esl.html</loc>
    <lastmod>2025-12-04</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/cooperative-learning-structures-esl.html</loc>
    <lastmod>2025-12-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/jigsaw-activities-esl-classroom.html</loc>
    <lastmod>2025-12-06</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/think-pair-share-esl-variations.html</loc>
    <lastmod>2025-12-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/group-dynamics-esl-classroom.html</loc>
    <lastmod>2025-12-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/collaborative-writing-activities-esl.html</loc>
    <lastmod>2025-12-09</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/krashen-hypotheses-esl-teaching.html</loc>
    <lastmod>2025-12-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/interlanguage-fossilization-esl.html</loc>
    <lastmod>2025-12-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/input-output-hypotheses-classroom.html</loc>
    <lastmod>2025-12-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/critical-period-hypothesis-language.html</loc>
    <lastmod>2025-12-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/motivation-theories-language-learning.html</loc>
    <lastmod>2025-12-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/action-research-esl-teachers.html</loc>
    <lastmod>2025-12-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/reflective-practice-language-teaching.html</loc>
    <lastmod>2025-12-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/peer-observation-esl-teachers.html</loc>
    <lastmod>2025-12-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/mentoring-new-esl-teachers.html</loc>
    <lastmod>2025-12-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/cpd-planning-esl-teachers.html</loc>
    <lastmod>2025-12-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/adapting-textbooks-esl-classroom.html</loc>
    <lastmod>2025-12-20</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/creating-authentic-materials-esl.html</loc>
    <lastmod>2025-12-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/supplementing-coursebooks-activities.html</loc>
    <lastmod>2025-12-22</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/digital-resource-curation-esl.html</loc>
    <lastmod>2025-12-23</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://edooqoo.com/blog/materials-design-principles-elt.html</loc>
    <lastmod>2025-12-24</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <!-- Phase 16 blog articles -->
  <url><loc>https://edooqoo.com/blog/teaching-word-stress-patterns-esl.html</loc><lastmod>2025-11-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-rhythm-english-speech.html</loc><lastmod>2025-11-26</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-weak-forms-english.html</loc><lastmod>2025-11-27</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/phonemic-awareness-activities-esl.html</loc><lastmod>2025-11-28</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/accent-coaching-techniques-esl.html</loc><lastmod>2025-11-29</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-word-families-morphology-esl.html</loc><lastmod>2025-11-30</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/phrasal-verbs-teaching-strategies.html</loc><lastmod>2025-12-01</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/lexical-approach-language-teaching.html</loc><lastmod>2025-12-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/vocabulary-notebook-strategies-esl.html</loc><lastmod>2025-12-03</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-abstract-vocabulary-esl.html</loc><lastmod>2025-12-04</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-aspect-english-grammar.html</loc><lastmod>2025-12-05</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-modality-english-esl.html</loc><lastmod>2025-12-06</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-relative-clauses-esl.html</loc><lastmod>2025-12-07</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/consciousness-raising-grammar-tasks.html</loc><lastmod>2025-12-08</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-determiners-quantifiers-esl.html</loc><lastmod>2025-12-09</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/bottom-up-top-down-listening-esl.html</loc><lastmod>2025-12-10</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-note-taking-from-lectures.html</loc><lastmod>2025-12-11</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/podcast-based-listening-lessons-esl.html</loc><lastmod>2025-12-12</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/dictogloss-technique-esl-teaching.html</loc><lastmod>2025-12-13</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-listening-for-gist-detail.html</loc><lastmod>2025-12-14</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-preschoolers-guide.html</loc><lastmod>2025-12-15</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/tpr-total-physical-response-activities.html</loc><lastmod>2025-12-16</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teen-engagement-strategies-esl.html</loc><lastmod>2025-12-17</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/content-based-instruction-young-learners.html</loc><lastmod>2025-12-18</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-literacy-young-esl-learners.html</loc><lastmod>2025-12-19</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/ai-powered-differentiation-esl.html</loc><lastmod>2025-12-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/using-chatbots-language-practice.html</loc><lastmod>2025-12-21</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/screen-free-tech-activities-esl.html</loc><lastmod>2025-12-22</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/data-driven-learning-esl-corpora.html</loc><lastmod>2025-12-23</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/learning-management-systems-esl.html</loc><lastmod>2025-12-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/ai-flashcards-vocabulary-esl.html</loc><lastmod>2026-03-01</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/ai-placement-tests-english-students.html</loc><lastmod>2026-03-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/tracking-student-progress-ai-esl.html</loc><lastmod>2026-03-03</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/conversation-topics-adult-esl-students.html</loc><lastmod>2026-03-04</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/end-of-lesson-reflection-activities-esl.html</loc><lastmod>2026-03-05</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/writing-prompts-esl-students-by-level.html</loc><lastmod>2026-03-06</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/error-correction-exercises-esl-guide.html</loc><lastmod>2026-03-07</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/getting-more-esl-students-marketing.html</loc><lastmod>2026-03-08</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/homework-feedback-students-read.html</loc><lastmod>2026-03-09</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/live-english-lessons-online-tools.html</loc><lastmod>2026-03-10</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/micro-lessons-busy-adult-esl-students.html</loc><lastmod>2026-03-11</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/online-homework-guide-esl-teachers.html</loc><lastmod>2026-03-12</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/present-simple-vs-continuous-teaching.html</loc><lastmod>2026-03-13</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/pricing-private-english-lessons-guide.html</loc><lastmod>2026-03-14</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/sentence-transformation-exercises-english.html</loc><lastmod>2026-03-15</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/sharing-worksheets-students-online.html</loc><lastmod>2026-03-16</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/student-booking-page-english-lessons.html</loc><lastmod>2026-03-17</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/student-portal-english-tutoring.html</loc><lastmod>2026-03-18</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-complete-beginners.html</loc><lastmod>2026-03-19</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-customer-service.html</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-job-interviews-activities.html</loc><lastmod>2026-03-21</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-meetings-phrases.html</loc><lastmod>2026-03-22</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-senior-learners.html</loc><lastmod>2026-03-23</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-english-tenses-complete-guide.html</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-paraphrasing-skills-esl.html</loc><lastmod>2026-03-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-prepositions-time-place-esl.html</loc><lastmod>2026-03-26</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-reading-esl-beginners.html</loc><lastmod>2026-03-27</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-second-conditional-activities.html</loc><lastmod>2026-03-28</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-third-conditional-esl.html</loc><lastmod>2026-03-29</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-vocabulary-in-context-methods.html</loc><lastmod>2026-03-30</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/phrasal-verbs-exercises-esl-worksheets.html</loc><lastmod>2026-04-01</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/modal-verbs-exercises-esl-guide.html</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/english-lesson-plan-template-free.html</loc><lastmod>2026-04-03</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/how-to-teach-past-tenses-esl.html</loc><lastmod>2026-04-04</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/vocabulary-activities-adult-learners.html</loc><lastmod>2026-04-05</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-comparative-superlative-esl.html</loc><lastmod>2026-04-06</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/esl-speaking-assessment-rubric.html</loc><lastmod>2026-04-07</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-future-tenses-esl-guide.html</loc><lastmod>2026-04-08</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/english-worksheet-generator-ai.html</loc><lastmod>2026-04-09</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-question-formation-esl.html</loc><lastmod>2026-04-10</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/online-english-tutor-tools-2026.html</loc><lastmod>2026-04-11</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-gerunds-infinitives-esl.html</loc><lastmod>2026-04-12</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/esl-writing-assessment-criteria.html</loc><lastmod>2026-04-13</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-phrasal-verbs-context-esl.html</loc><lastmod>2026-04-14</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/how-to-give-english-level-test.html</loc><lastmod>2026-04-15</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-word-order-english-esl.html</loc><lastmod>2026-04-16</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/adult-esl-lesson-ideas-by-level.html</loc><lastmod>2026-04-17</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/english-homework-ideas-that-work.html</loc><lastmod>2026-04-18</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/teaching-linking-expressions-esl.html</loc><lastmod>2026-04-19</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://edooqoo.com/blog/how-to-run-esl-business-online.html</loc><lastmod>2026-04-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
</urlset>`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return new Response(SITEMAP_XML, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
});
