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

- Total articles: 306
- promote-or-refresh: 119
- rewrite-to-adult-1to1: 119
- merge-redirect-or-noindex: 45
- noindex-keep-accessible: 17
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
| /blog/academic-language-functions-clil.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/academic-vocabulary-teaching-strategies.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/accent-coaching-techniques-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/accent-reduction-activities-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/action-research-esl-teachers.html | rewrite-to-adult-1to1 | 899 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adapting-task-difficulty-for-one-adult-english-learner.html | rewrite-to-adult-1to1 | 859 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adapting-textbook-tasks-for-adult-one-to-one-english-lessons.html | rewrite-to-adult-1to1 | 880 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-business-english-homework-feedback-loop.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-esl-student-profile-lesson-planning.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-learner-autonomy-in-private-english-lessons.html | rewrite-to-adult-1to1 | 850 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-learner-performance-evidence-beyond-tests.html | rewrite-to-adult-1to1 | 856 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-one-to-one-accessibility-adaptations-for-english-lessons.html | rewrite-to-adult-1to1 | 847 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-one-to-one-neurodivergent-english-lesson-adaptations.html | rewrite-to-adult-1to1 | 859 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-professional-task-projects-in-english-coaching.html | rewrite-to-adult-1to1 | 852 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/adult-vocabulary-retrieval-practice-not-games.html | rewrite-to-adult-1to1 | 833 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/ai-generated-listening-exercises-esl.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/ai-homework-grading-for-english-teachers.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/ai-powered-differentiation-esl.html | rewrite-to-adult-1to1 | 887 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/ai-tools-for-english-teachers-2026.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/ai-worksheet-generator-vs-lesson-planning-chatbot.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/art-based-language-activities-esl.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/authentic-listening-materials-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/best-apps-learning-english-2026.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/best-lesson-prep-tool-for-english-tutors.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/best-workflow-for-private-english-tutors.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/between-session-homework-evidence-for-private-english-tutors.html | rewrite-to-adult-1to1 | 846 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/bilingual-education-models-comparison.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/bottom-up-top-down-listening-esl.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/building-esl-teaching-portfolio.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/business-english-material-generation-workflow.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cambridge-exam-preparation-tips-teachers.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/can-ai-plan-one-to-one-english-lesson.html | rewrite-to-adult-1to1 | 916 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cefr-aligned-worksheet-generation-workflow.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cefr-evidence-for-private-english-lessons.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/clil-methodology-complete-guide.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cloze-test-design-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/collaborative-writing-activities-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/communicative-language-teaching-activities.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/connected-speech-teaching-activities.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/consciousness-raising-grammar-tasks.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/contrastive-analysis-language-teaching.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cooperative-learning-structures-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/corpus-linguistics-esl-teaching.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/course-evaluation-esl-programs.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cpd-planning-esl-teachers.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/creating-authentic-materials-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/creating-english-tests-guide.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/creating-interactive-worksheets-online.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/creative-writing-activities-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/critical-period-hypothesis-language.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/cross-cultural-communication-activities.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/culturally-responsive-teaching-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/current-events-esl-lessons.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/data-driven-learning-esl-corpora.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/debate-activities-english-class.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/designing-english-midterm-final-exams.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/diagnostic-testing-english-learners.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/dictation-for-adult-listening-accuracy-evidence.html | rewrite-to-adult-1to1 | 868 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/dictogloss-technique-esl-teaching.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/digital-homework-tools-esl-teachers.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/digital-resource-curation-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/discussion-questions-esl-topics.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/editable-ai-worksheets-for-adult-english-learners.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/emi-english-medium-instruction-guide.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/end-of-term-activities-esl.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/energy-management-esl-lessons.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/english-for-specific-purposes-guide.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/english-homework-ai-grading-workflow.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/english-tutor-material-organization-workflow.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/english-tutor-workflow-after-a-live-lesson.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/error-correction-techniques-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/esl-exercise-type-selection-guide.html | rewrite-to-adult-1to1 | 889 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/extensive-reading-programs-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/fill-in-the-blanks-exercises-best-practices.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/first-adult-one-to-one-english-lesson-evidence-capture.html | rewrite-to-adult-1to1 | 861 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/formative-assessment-english-teaching.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/from-lesson-evidence-to-next-lesson-plan.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/from-student-goals-to-worksheet.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/gender-inclusive-language-esl.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/growth-mindset-language-learning.html | rewrite-to-adult-1to1 | 884 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/homework-before-lesson-workflow-for-adult-english-tutors.html | rewrite-to-adult-1to1 | 843 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/homework-mistakes-next-english-lesson.html | rewrite-to-adult-1to1 | 892 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-english-tutors-track-what-to-teach-next.html | rewrite-to-adult-1to1 | 916 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html | rewrite-to-adult-1to1 | 932 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-private-english-tutors-use-ai-safely.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-assess-english-level-cefr.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-avoid-generic-ai-lesson-plans-for-adults.html | rewrite-to-adult-1to1 | 905 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-build-an-adult-esl-lesson-from-real-work-tasks.html | rewrite-to-adult-1to1 | 921 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-build-student-context-for-english-tutoring.html | rewrite-to-adult-1to1 | 916 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-choose-an-ai-tool-for-private-english-tutoring.html | rewrite-to-adult-1to1 | 913 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-create-business-english-homework-that-gets-completed.html | rewrite-to-adult-1to1 | 905 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-create-grammar-worksheets-with-ai.html | rewrite-to-adult-1to1 | 908 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-design-one-to-one-english-lessons-for-professionals.html | rewrite-to-adult-1to1 | 913 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-keep-chatgpt-output-from-sounding-generic-in-esl-lessons.html | rewrite-to-adult-1to1 | 921 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-plan-a-recurring-english-student-learning-loop.html | rewrite-to-adult-1to1 | 905 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-plan-english-lessons-effectively.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-plan-next-lesson-from-homework-mistakes.html | rewrite-to-adult-1to1 | 916 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-prepare-business-english-lesson-in-one-minute.html | rewrite-to-adult-1to1 | 924 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-reduce-lesson-prep-time-for-private-english-tutors.html | rewrite-to-adult-1to1 | 932 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-review-ai-generated-esl-worksheets-before-teaching.html | rewrite-to-adult-1to1 | 905 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-review-homework-before-next-english-lesson.html | rewrite-to-adult-1to1 | 916 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-track-progress-without-school-like-tests.html | rewrite-to-adult-1to1 | 897 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-turn-homework-errors-into-next-lesson-focus.html | rewrite-to-adult-1to1 | 905 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-use-ai-without-losing-teacher-control.html | rewrite-to-adult-1to1 | 897 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/how-to-use-student-context-in-ai-worksheet-generation.html | rewrite-to-adult-1to1 | 905 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/information-gap-tasks-for-adult-workplace-communication.html | rewrite-to-adult-1to1 | 858 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/input-output-evidence-in-adult-one-to-one-english-lessons.html | rewrite-to-adult-1to1 | 861 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/intercultural-communication-for-adult-professional-english.html | rewrite-to-adult-1to1 | 841 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/learning-pacing-scientific-vs-pragmatic-esl.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/low-friction-review-loops-for-adult-english-learners.html | rewrite-to-adult-1to1 | 847 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/managing-lesson-focus-in-one-to-one-adult-english-lessons.html | rewrite-to-adult-1to1 | 871 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/motivation-theories-language-learning.html | rewrite-to-adult-1to1 | 854 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/private-english-tutor-tool-stack.html | rewrite-to-adult-1to1 | 855 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/process-writing-approach-esl.html | rewrite-to-adult-1to1 | 877 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/role-play-for-adult-workplace-english-practice.html | rewrite-to-adult-1to1 | 853 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/student-progress-to-worksheet-feedback-loop.html | rewrite-to-adult-1to1 | 900 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/teaching-listening-strategies-esl.html | rewrite-to-adult-1to1 | 858 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/transitioning-between-tasks-in-adult-one-to-one-english-lessons.html | rewrite-to-adult-1to1 | 873 | Useful intent, but current framing risks classroom/school-like positioning. |
| /blog/tutor-workflow-system-vs-lms-for-private-english-lessons.html | rewrite-to-adult-1to1 | 863 | Useful intent, but current framing risks classroom/school-like positioning. |

## Sprint 4: Refresh 80 Existing Blog Posts

Priority rule: choose indexed or near-product URLs first, especially adult/business/professional intent, homework, CEFR evidence, lesson prep, what-to-teach-next, worksheet generation mechanics, and AI-as-workflow topics.

### Batch 1

| Route | Words | Reason |
| --- | --- | --- |
| /blog/five-minute-filler-activities-esl.html | 427 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/holiday-themed-esl-activities.html | 215 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-avoid-school-like-esl-materials-for-adults.html | 868 | Intentional adult 1:1 page that rejects school-like materials; school-like language is the object of critique, not the framing. |
| /blog/how-to-teach-english-grammar-effectively.html | 1361 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-teach-english-pronunciation.html | 966 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-teach-speaking-esl.html | 1119 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-teach-writing-esl-students.html | 982 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-track-adult-english-student-progress.html | 870 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-turn-student-notes-into-esl-worksheets.html | 893 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/how-to-use-chatgpt-for-esl-lesson-prep-without-losing-context.html | 947 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/ielts-preparation-worksheets-guide.html | 854 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/improvisation-activities-esl.html | 413 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/interlanguage-fossilization-esl.html | 414 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/intrinsic-motivation-language-learning.html | 302 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/ipa-phonetic-alphabet-esl-teaching.html | 609 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/item-analysis-english-tests.html | 511 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/journal-writing-esl-students.html | 528 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/krashen-hypotheses-esl-teaching.html | 413 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/lesson-sequencing-scaffolding-curriculum.html | 1408 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/lexical-approach-language-teaching.html | 579 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

### Batch 2

| Route | Words | Reason |
| --- | --- | --- |
| /blog/managing-large-esl-classes.html | 509 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/materials-design-principles-elt.html | 1377 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/mentoring-new-esl-teachers.html | 415 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/motivating-reluctant-esl-learners.html | 368 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/needs-analysis-esl-students.html | 1408 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/pair-work-activities-esl.html | 684 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/parent-teacher-conferences-esl.html | 199 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/peer-editing-workshops-esl.html | 533 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/peer-feedback-activities-english.html | 635 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/peer-observation-esl-teachers.html | 415 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/personalized-learning-english-teaching.html | 1351 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/phonemic-awareness-activities-esl.html | 584 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/phrasal-verbs-teaching-strategies.html | 577 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/podcast-based-listening-lessons-esl.html | 570 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/portfolio-assessment-esl-writing.html | 509 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/private-english-tutor-homework-workflow.html | 856 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/public-esl-worksheet-gallery-quality-standards.html | 452 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/readers-theatre-esl-activities.html | 419 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/reading-comprehension-activities-english.html | 1130 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/reflective-practice-language-teaching.html | 410 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

### Batch 3

| Route | Words | Reason |
| --- | --- | --- |
| /blog/role-play-activities-esl.html | 602 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/rubrics-for-english-teachers.html | 601 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/scaffolding-strategies-english-learners.html | 1089 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/screen-free-tech-activities-esl.html | 575 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/selecting-esl-textbooks-guide.html | 413 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/self-assessment-strategies-esl.html | 570 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/self-directed-learning-esl.html | 359 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/setting-up-freelance-esl-business.html | 1371 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/spaced-repetition-vocabulary-learning.html | 1385 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/storytelling-activities-esl.html | 763 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/substitute-teacher-esl-lesson-plans.html | 334 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/supplementing-coursebooks-activities.html | 409 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/syllabus-design-esl-courses.html | 507 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/task-based-language-teaching-worksheets.html | 1371 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teacher-burnout-prevention-esl.html | 1344 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teacher-controlled-ai-lesson-prep.html | 852 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-abstract-vocabulary-esl.html | 573 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-articles-esl-guide.html | 592 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-aspect-english-grammar.html | 582 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-aviation-english.html | 471 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

### Batch 4

| Route | Words | Reason |
| --- | --- | --- |
| /blog/teaching-business-english-guide.html | 1356 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-cleft-sentences-english.html | 222 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-collocations-esl.html | 761 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-conditionals-esl-guide.html | 815 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-determiners-quantifiers-esl.html | 574 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-ellipsis-substitution-english.html | 242 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-email-writing-esl.html | 286 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-hospitality-tourism.html | 367 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-immigrants-refugees.html | 525 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-intonation-stress.html | 697 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-it-professionals.html | 386 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-one-to-one.html | 3188 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-online-complete-guide.html | 1382 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-english-through-literature.html | 567 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-essay-structure-esl.html | 558 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-formal-informal-english.html | 247 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-idioms-esl-activities.html | 819 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-inversion-english.html | 256 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-legal-english.html | 448 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/teaching-linking-words-connectors.html | 215 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |

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
| /chatgpt-for-esl-teachers-limitations.html | llm | ChatGPT for ESL Teachers: Limitations |
| /claude-for-english-tutors-limitations.html | llm | Claude for English Tutors: Limitations |
| /gemini-for-esl-lesson-planning-limitations.html | llm | Gemini for ESL Lesson Planning: Limitations |
| /perplexity-for-esl-teachers-limitations.html | llm | Perplexity for ESL Teachers: Limitations |
| /best-chatgpt-prompts-for-esl-teachers-vs-workflow.html | llm | Best ChatGPT Prompts for ESL Teachers vs Workflow |
| /ai-chatbot-vs-student-context-system.html | llm | AI Chatbot vs Student Context System |
| /ai-lesson-planner-vs-worksheet-workflow.html | llm | AI Lesson Planner vs Worksheet Workflow |
| /chatgpt-vs-ai-worksheet-generator.html | llm | ChatGPT vs AI Worksheet Generator |
| /chatgpt-vs-homework-evidence-workflow.html | llm | ChatGPT vs Homework Evidence Workflow |
| /llm-vs-edtech-workflow-for-private-tutors.html | llm | LLM vs EdTech Workflow for Private Tutors |
| /teacher-controlled-ai-for-english-tutors.html | llm | Teacher-Controlled AI for English Tutors |
| /ai-tools-for-business-english-tutors.html | llm | AI Tools for Business English Tutors |
| /ai-tools-for-one-to-one-english-lessons.html | llm | AI Tools for One-to-One English Lessons |
| /ai-tools-for-adult-esl-homework.html | llm | AI Tools for Adult ESL Homework |
| /ai-tools-for-esl-progress-tracking.html | llm | AI Tools for ESL Progress Tracking |
| /ai-tools-for-private-tutor-student-context.html | llm | AI Tools for Private Tutor Student Context |
| /best-chatgpt-alternatives-for-esl-teachers.html | llm | ChatGPT Alternatives for ESL Teachers: Workflow Criteria |
| /best-ai-worksheet-tools-for-english-tutors.html | llm | AI Worksheet Tools for English Tutors: Criteria |
| /software-engineer-incident-explanation-lesson-prep.html | profession | Software Engineer Incident Explanation: Lesson Prep Use Case |
| /software-engineer-incident-explanation-worksheet.html | profession | Software Engineer Incident Explanation: Worksheet Use Case |
| /software-engineer-incident-explanation-what-to-teach-next.html | profession | Software Engineer Incident Explanation: What-to-Teach-Next Use Case |
| /project-manager-status-update-lesson-prep.html | profession | Project Manager Status Update: Lesson Prep Use Case |
| /project-manager-status-update-worksheet.html | profession | Project Manager Status Update: Worksheet Use Case |
| /project-manager-status-update-what-to-teach-next.html | profession | Project Manager Status Update: What-to-Teach-Next Use Case |
| /hr-performance-conversation-lesson-prep.html | profession | HR Performance Conversation: Lesson Prep Use Case |
| /hr-performance-conversation-worksheet.html | profession | HR Performance Conversation: Worksheet Use Case |
| /hr-performance-conversation-what-to-teach-next.html | profession | HR Performance Conversation: What-to-Teach-Next Use Case |
| /sales-discovery-call-lesson-prep.html | profession | Sales Discovery Call: Lesson Prep Use Case |
| /sales-discovery-call-worksheet.html | profession | Sales Discovery Call: Worksheet Use Case |
| /sales-discovery-call-what-to-teach-next.html | profession | Sales Discovery Call: What-to-Teach-Next Use Case |
| /lawyer-client-risk-explanation-lesson-prep.html | profession | Lawyer Client Risk Explanation: Lesson Prep Use Case |
| /lawyer-client-risk-explanation-worksheet.html | profession | Lawyer Client Risk Explanation: Worksheet Use Case |
| /lawyer-client-risk-explanation-what-to-teach-next.html | profession | Lawyer Client Risk Explanation: What-to-Teach-Next Use Case |
| /accountant-variance-explanation-lesson-prep.html | profession | Accountant Variance Explanation: Lesson Prep Use Case |
| /accountant-variance-explanation-worksheet.html | profession | Accountant Variance Explanation: Worksheet Use Case |
| /accountant-variance-explanation-what-to-teach-next.html | profession | Accountant Variance Explanation: What-to-Teach-Next Use Case |
| /consultant-executive-summary-lesson-prep.html | profession | Consultant Executive Summary: Lesson Prep Use Case |
| /consultant-executive-summary-worksheet.html | profession | Consultant Executive Summary: Worksheet Use Case |
| /consultant-executive-summary-what-to-teach-next.html | profession | Consultant Executive Summary: What-to-Teach-Next Use Case |
| /marketing-campaign-recommendation-lesson-prep.html | profession | Marketing Campaign Recommendation: Lesson Prep Use Case |
| /marketing-campaign-recommendation-worksheet.html | profession | Marketing Campaign Recommendation: Worksheet Use Case |
| /marketing-campaign-recommendation-what-to-teach-next.html | profession | Marketing Campaign Recommendation: What-to-Teach-Next Use Case |
| /entrepreneur-customer-interview-lesson-prep.html | profession | Entrepreneur Customer Interview: Lesson Prep Use Case |
| /entrepreneur-customer-interview-worksheet.html | profession | Entrepreneur Customer Interview: Worksheet Use Case |
| /entrepreneur-customer-interview-what-to-teach-next.html | profession | Entrepreneur Customer Interview: What-to-Teach-Next Use Case |
| /executive-board-update-lesson-prep.html | profession | Executive Board Update: Lesson Prep Use Case |
| /executive-board-update-worksheet.html | profession | Executive Board Update: Worksheet Use Case |
| /executive-board-update-what-to-teach-next.html | profession | Executive Board Update: What-to-Teach-Next Use Case |
| /chatgpt-alternative-for-business-english-tutors.html | llm | ChatGPT Alternative for Business English Tutors |
| /chatgpt-alternative-for-private-esl-tutors.html | llm | ChatGPT Alternative for Private ESL Tutors |
| /chatgpt-alternative-for-homework-review.html | llm | ChatGPT Alternative for Homework Review |
| /claude-alternative-for-english-tutors.html | llm | Claude Alternative for English Tutors |
| /gemini-alternative-for-english-tutors.html | llm | Gemini Alternative for English Tutors |
| /perplexity-alternative-for-esl-teachers.html | llm | Perplexity Alternative for ESL Teachers |
| /best-ai-tools-for-english-tutors-with-student-context.html | llm | Best AI Tools for English Tutors With Student Context |
| /best-ai-homework-tools-for-private-english-tutors.html | llm | Best AI Homework Tools for Private English Tutors |
| /best-ai-worksheet-generator-for-adult-esl.html | llm | Best AI Worksheet Generator for Adult ESL |
| /ai-lesson-prep-software-for-private-tutors.html | llm | AI Lesson Prep Software for Private Tutors |
| /teacher-controlled-ai-vs-ai-autopilot.html | llm | Teacher-Controlled AI vs AI Autopilot |
| /student-context-system-vs-chatbot-for-english-tutors.html | llm | Student Context System vs Chatbot for English Tutors |
| /doctor-patient-explanation-lesson-prep.html | llm | Doctor Patient Explanation: Lesson Prep Use Case |
| /doctor-patient-explanation-worksheet.html | llm | Doctor Patient Explanation: Worksheet Use Case |
| /nurse-handover-lesson-prep.html | llm | Nurse Handover: Lesson Prep Use Case |
| /nurse-handover-worksheet.html | llm | Nurse Handover: Worksheet Use Case |
| /ux-designer-research-interview-lesson-prep.html | llm | UX Designer Research Interview: Lesson Prep Use Case |
| /ux-designer-research-interview-worksheet.html | llm | UX Designer Research Interview: Worksheet Use Case |
| /data-analyst-insight-presentation-lesson-prep.html | llm | Data Analyst Insight Presentation: Lesson Prep Use Case |
| /data-analyst-insight-presentation-worksheet.html | llm | Data Analyst Insight Presentation: Worksheet Use Case |
| /customer-success-renewal-call-lesson-prep.html | llm | Customer Success Renewal Call: Lesson Prep Use Case |
| /customer-success-renewal-call-worksheet.html | llm | Customer Success Renewal Call: Worksheet Use Case |
| /operations-manager-process-update-lesson-prep.html | llm | Operations Manager Process Update: Lesson Prep Use Case |
| /operations-manager-process-update-worksheet.html | llm | Operations Manager Process Update: Worksheet Use Case |
| /finance-manager-budget-explanation-lesson-prep.html | llm | Finance Manager Budget Explanation: Lesson Prep Use Case |
| /finance-manager-budget-explanation-worksheet.html | llm | Finance Manager Budget Explanation: Worksheet Use Case |
| /product-manager-roadmap-tradeoff-lesson-prep.html | llm | Product Manager Roadmap Tradeoff: Lesson Prep Use Case |
| /product-manager-roadmap-tradeoff-worksheet.html | llm | Product Manager Roadmap Tradeoff: Worksheet Use Case |

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
