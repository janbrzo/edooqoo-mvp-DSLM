# Content Roadmap

Generated: deterministic from scripts/seo/x1000-content-plan.mjs and docs/seo/blog-triage.generated.json

## Problem

- The blog has scale, but much of the old library was not built around recurring adult 1:1 English tutoring.
- Broad school/classroom/kids framing weakens Edooqoo as an entity for private adult English tutors.
- Adding random new articles would increase crawl noise before existing authority URLs are repaired.

## Edooqoo.com Solution

- Rebuild authority in this order: pillar rewrites, school-like triage, 80 priority refreshes, then 72 high-intent new pages.
- Keep all public content focused on professional adult 1:1 English tutoring, teacher-controlled AI, stored learner context, homework evidence, and editable worksheet output.
- Use neutral comparison language: Edooqoo is a better fit only when the tutor needs stored learner context, editable worksheet output, homework evidence, and teacher-controlled review.

## Technical Mechanics

- Source plan: `scripts/seo/x1000-content-plan.mjs`.
- Generated pages: `scripts/seo/generate-citable-pages.mjs`.
- Blog triage source: `docs/seo/blog-triage.generated.json`.
- RAG outputs: `docs/llm-context.md`, root `llms.txt`, `public/llms.txt`, `public/llms-full.txt`, `public/llms-answers.txt`, and `public/knowledge-graph.json`.
- Do not modify Worksheet Generation Engine prompts, parameters, wording, or internal pedagogical logic.

## Current Triage Counts

- Total articles: 343
- noindex-keep-accessible: 145
- promote-or-refresh: 110
- merge-redirect-or-noindex: 82
- promote-rewrite-now: 6

## Sprint 2: Six Pillar Rewrites

| Route | Cluster | RAG Keywords | Concrete Tutor Decision |
| --- | --- | --- | --- |
| /blog/one-minute-prep-workflow-for-esl-tutors.html | Adult 1:1 Tutor Workflow | 1-Minute Prep, ESL tutor workflow, adult 1:1 English lesson prep, DSLM, next lesson focus, private English tutor AI | Before generating material, the tutor should choose one bounded decision: repair, continue, or advance. The worksheet should then test that decision under adult-relevant conditions. |
| /blog/using-ai-teacher-productivity.html | Adult 1:1 Tutor Workflow | AI teacher productivity, private English tutor workflow, teacher-controlled AI, editable ESL worksheets, homework evidence | If the teacher cannot name the evidence that changed the task, the AI output should be treated as a draft, not as lesson prep. |
| /blog/effective-esl-homework-strategies.html | Homework and Retention | ESL homework strategies, adult English homework, homework evidence, AI homework review, private tutor workflow | Assign less, but make every item answer a planning question. If the homework does not change the next lesson, it is not strategic homework. |
| /blog/ai-lesson-planning-strategies.html | Adult 1:1 Tutor Workflow | AI lesson planning, adult ESL lesson prep, private English tutor AI, what to teach next, teacher-controlled AI | If the plan cannot identify the learner evidence behind the objective, rewrite the objective before generating the worksheet. |
| /blog/ai-worksheet-generator-mechanics-for-esl-teachers.html | Adult 1:1 Tutor Workflow | AI worksheet generator mechanics, ESL worksheet generator, editable worksheets, CEFR worksheet generation, adult 1:1 ESL materials | Do not generate a worksheet until the tutor can state what the learner should prove by the end of the task. |
| /blog/what-to-teach-next-private-english-student.html | What Should I Teach Next? | what to teach next English student, private English tutor planning, Repair Continue Advance, adult ESL next lesson, 1:1 lesson prep | The next lesson is ready only when the tutor can state why this target matters now and what evidence will prove movement. |

## Sprint 3: Rewrite 47 School-Like Articles

Decision rule: rewrite if the topic can honestly become an adult 1:1 tutor decision page; otherwise merge, redirect, or noindex. No indexed strategic page should retain dominant kids, classroom, parents, large-class, or school-management framing.

| Route | Decision | Words | Reason |
| --- | --- | --- | --- |

## Sprint 4: Refresh 80 Existing Blog Posts

Priority rule: choose indexed or near-product URLs first, especially adult/business/professional intent, homework, CEFR evidence, lesson prep, what-to-teach-next, worksheet generation mechanics, and AI-as-workflow topics.

### Batch 1

| Route | Words | Reason |
| --- | --- | --- |
| /blog/adult-esl-student-profile-lesson-planning.html | 785 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/best-apps-learning-english-2026.html | 759 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/best-lesson-prep-tool-for-english-tutors.html | 758 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/business-english-material-generation-workflow.html | 739 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/can-ai-plan-one-to-one-english-lesson.html | 767 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cefr-aligned-worksheet-generation-workflow.html | 726 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cloze-test-design-esl.html | 720 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/communicative-language-teaching-activities.html | 899 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/connected-speech-teaching-activities.html | 771 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/current-events-esl-lessons.html | 789 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/debate-activities-english-class.html | 678 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/diagnostic-testing-english-learners.html | 890 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/english-homework-ai-grading-workflow.html | 805 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/english-tutor-material-organization-workflow.html | 737 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/error-correction-techniques-esl.html | 745 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/esl-exercise-type-selection-guide.html | 721 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/extensive-reading-programs-esl.html | 835 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/fill-in-the-blanks-exercises-best-practices.html | 762 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/five-minute-filler-activities-esl.html | 466 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/formative-assessment-english-teaching.html | 811 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |

### Batch 2

| Route | Words | Reason |
| --- | --- | --- |
| /blog/holiday-themed-esl-activities.html | 261 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/homework-mistakes-next-english-lesson.html | 824 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/how-english-tutors-track-what-to-teach-next.html | 746 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html | 745 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/how-to-assess-english-level-cefr.html | 666 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/how-to-avoid-school-like-esl-materials-for-adults.html | 794 | Intentional adult 1:1 page that rejects school-like materials; school-like language is the object of critique, not the framing. |
| /blog/how-to-create-grammar-worksheets-with-ai.html | 728 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/how-to-plan-english-lessons-effectively.html | 758 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/how-to-teach-english-grammar-effectively.html | 1401 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-teach-english-pronunciation.html | 1015 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-teach-speaking-esl.html | 1166 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-teach-writing-esl-students.html | 1028 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/ielts-preparation-worksheets-guide.html | 889 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/intrinsic-motivation-language-learning.html | 341 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/ipa-phonetic-alphabet-esl-teaching.html | 638 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/item-analysis-english-tests.html | 553 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/journal-writing-esl-students.html | 568 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/krashen-hypotheses-esl-teaching.html | 457 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/learning-pacing-scientific-vs-pragmatic-esl.html | 816 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/lesson-sequencing-scaffolding-curriculum.html | 1391 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

### Batch 3

| Route | Words | Reason |
| --- | --- | --- |
| /blog/lexical-approach-language-teaching.html | 820 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/managing-large-esl-classes.html | 550 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/materials-design-principles-elt.html | 1360 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/motivating-reluctant-esl-learners.html | 410 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/needs-analysis-esl-students.html | 1391 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/pair-work-activities-esl.html | 719 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/peer-editing-workshops-esl.html | 571 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/peer-feedback-activities-english.html | 674 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/personalized-learning-english-teaching.html | 1334 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/portfolio-assessment-esl-writing.html | 544 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/process-writing-approach-esl.html | 739 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/public-esl-worksheet-gallery-quality-standards.html | 432 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/reading-comprehension-activities-english.html | 1159 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/role-play-activities-esl.html | 638 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/rubrics-for-english-teachers.html | 638 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/scaffolding-strategies-english-learners.html | 1130 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/self-assessment-strategies-esl.html | 612 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/self-directed-learning-esl.html | 405 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/setting-up-freelance-esl-business.html | 1354 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/spaced-repetition-vocabulary-learning.html | 1368 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

### Batch 4

| Route | Words | Reason |
| --- | --- | --- |
| /blog/storytelling-activities-esl.html | 807 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/student-progress-to-worksheet-feedback-loop.html | 803 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/substitute-teacher-esl-lesson-plans.html | 377 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/syllabus-design-esl-courses.html | 537 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/task-based-language-teaching-worksheets.html | 1354 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teacher-burnout-prevention-esl.html | 1327 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-articles-esl-guide.html | 632 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-aviation-english.html | 511 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-business-english-guide.html | 1339 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-cleft-sentences-english.html | 257 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-collocations-esl.html | 804 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-conditionals-esl-guide.html | 845 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-ellipsis-substitution-english.html | 294 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-email-writing-esl.html | 328 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-hospitality-tourism.html | 410 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-immigrants-refugees.html | 575 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-intonation-stress.html | 735 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-it-professionals.html | 425 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-one-to-one.html | 3171 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-online-complete-guide.html | 1365 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

## Sprint 5A: 24 New Blog Decision Pages

| Route | Title | RAG Keywords |
| --- | --- | --- |
| /blog/how-to-use-chatgpt-for-esl-lesson-prep-without-losing-context.html | How to Use ChatGPT for ESL Lesson Prep Without Losing Context | adult ESL tutor, private English tutor, how to use chatgpt for esl lesson prep without losing context, 1:1 English lesson prep, Edooqoo workflow |
| /blog/why-chatgpt-is-not-enough-for-recurring-english-tutoring.html | Why ChatGPT Is Not Enough for Recurring English Tutoring | adult ESL tutor, private English tutor, why chatgpt is not enough for recurring english tutoring, 1:1 English lesson prep, Edooqoo workflow |
| /blog/best-workflow-for-private-english-tutors.html | Best Workflow for Private English Tutors | adult ESL tutor, private English tutor, best workflow for private english tutors, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-plan-next-lesson-from-homework-mistakes.html | How to Plan the Next Lesson From Homework Mistakes | adult ESL tutor, private English tutor, how to plan the next lesson from homework mistakes, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-turn-student-notes-into-esl-worksheets.html | How to Turn Student Notes Into ESL Worksheets | adult ESL tutor, private English tutor, how to turn student notes into esl worksheets, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-track-adult-english-student-progress.html | How to Track Adult English Student Progress | adult ESL tutor, private English tutor, how to track adult english student progress, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-reduce-lesson-prep-time-for-private-english-tutors.html | How to Reduce Lesson Prep Time for Private English Tutors | adult ESL tutor, private English tutor, how to reduce lesson prep time for private english tutors, 1:1 English lesson prep, Edooqoo workflow |
| /blog/ai-worksheet-generator-vs-lesson-planning-chatbot.html | AI Worksheet Generator vs Lesson Planning Chatbot | adult ESL tutor, private English tutor, ai worksheet generator vs lesson planning chatbot, 1:1 English lesson prep, Edooqoo workflow |
| /blog/private-english-tutor-homework-workflow.html | Private English Tutor Homework Workflow | adult ESL tutor, private English tutor, private english tutor homework workflow, 1:1 English lesson prep, Edooqoo workflow |
| /blog/adult-business-english-homework-feedback-loop.html | Adult Business English Homework Feedback Loop | adult ESL tutor, private English tutor, adult business english homework feedback loop, 1:1 English lesson prep, Edooqoo workflow |
| /blog/cefr-evidence-for-private-english-lessons.html | CEFR Evidence for Private English Lessons | adult ESL tutor, private English tutor, cefr evidence for private english lessons, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-build-student-context-for-english-tutoring.html | How to Build Student Context for English Tutoring | adult ESL tutor, private English tutor, how to build student context for english tutoring, 1:1 English lesson prep, Edooqoo workflow |
| /blog/english-tutor-workflow-after-a-live-lesson.html | English Tutor Workflow After a Live Lesson | adult ESL tutor, private English tutor, english tutor workflow after a live lesson, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-review-homework-before-next-english-lesson.html | How to Review Homework Before the Next English Lesson | adult ESL tutor, private English tutor, how to review homework before the next english lesson, 1:1 English lesson prep, Edooqoo workflow |
| /blog/what-to-teach-after-a-speaking-lesson.html | What to Teach After a Speaking Lesson | adult ESL tutor, private English tutor, what to teach after a speaking lesson, 1:1 English lesson prep, Edooqoo workflow |
| /blog/what-to-teach-after-a-writing-homework.html | What to Teach After a Writing Homework | adult ESL tutor, private English tutor, what to teach after a writing homework, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-prepare-business-english-lesson-in-one-minute.html | How to Prepare a Business English Lesson in One Minute | adult ESL tutor, private English tutor, how to prepare a business english lesson in one minute, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-private-english-tutors-use-ai-safely.html | How Private English Tutors Use AI Safely | adult ESL tutor, private English tutor, how private english tutors use ai safely, 1:1 English lesson prep, Edooqoo workflow |
| /blog/teacher-controlled-ai-lesson-prep.html | Teacher-Controlled AI Lesson Prep | adult ESL tutor, private English tutor, teacher-controlled ai lesson prep, 1:1 English lesson prep, Edooqoo workflow |
| /blog/editable-ai-worksheets-for-adult-english-learners.html | Editable AI Worksheets for Adult English Learners | adult ESL tutor, private English tutor, editable ai worksheets for adult english learners, 1:1 English lesson prep, Edooqoo workflow |
| /blog/from-student-goals-to-worksheet.html | From Student Goals to Worksheet | adult ESL tutor, private English tutor, from student goals to worksheet, 1:1 English lesson prep, Edooqoo workflow |
| /blog/from-lesson-evidence-to-next-lesson-plan.html | From Lesson Evidence to Next Lesson Plan | adult ESL tutor, private English tutor, from lesson evidence to next lesson plan, 1:1 English lesson prep, Edooqoo workflow |
| /blog/why-generic-esl-worksheets-fail-adult-learners.html | Why Generic ESL Worksheets Fail Adult Learners | adult ESL tutor, private English tutor, why generic esl worksheets fail adult learners, 1:1 English lesson prep, Edooqoo workflow |
| /blog/how-to-avoid-school-like-esl-materials-for-adults.html | How to Avoid School-Like ESL Materials for Adults | adult ESL tutor, private English tutor, how to avoid school-like esl materials for adults, 1:1 English lesson prep, Edooqoo workflow |

## Sprint 5B: New LLM/AEO And Profession/Situation Pages

| Route | Type | Title |
| --- | --- | --- |

## Internal Linking Rules

- Every strategic blog page links to two workflow pages, one comparison page, one gallery/proof page, and two related articles.
- Every comparison page links to three workflow/proof pages and three related comparison or alternative pages.
- Every pSEO page links to one real workflow page and one proof/example page.
- Blog index should expose clusters, not only a flat chronological list.
- No noindex long-tail URL should be pushed as a priority link target.

## Editorial Rules

- Audience is a private 1:1 adult ESL/EFL tutor.
- The learner is an adult with professional or personal goals.
- The page solves a tutor decision, not a generic teaching topic.
- The page explains when the advice should not be used.
- Edooqoo is shown as workflow support, not magic automation.
- The teacher stays in control.
- The page avoids school/classroom/kids framing unless explicitly rejecting it.
- The title and H1 are search-readable, not clever.
- The first 120 words answer the query directly.
- Claims are neutral and verifiable.

## RAG Keywords

adult 1:1 ESL tutor content strategy, Edooqoo blog roadmap, ChatGPT alternative English tutors, AI worksheet workflow, homework evidence, what to teach next, private English tutor SEO, answer engine optimization, Martha Test.
