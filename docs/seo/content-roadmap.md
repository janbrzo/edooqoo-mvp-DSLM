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
- promote-or-refresh: 238
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

## Sprint 4: Refresh 80 Existing Blog Posts

Priority rule: choose indexed or near-product URLs first, especially adult/business/professional intent, homework, CEFR evidence, lesson prep, what-to-teach-next, worksheet generation mechanics, and AI-as-workflow topics.

### Batch 1

| Route | Words | Reason |
| --- | --- | --- |
| /blog/academic-language-functions-clil.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/academic-vocabulary-teaching-strategies.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/accent-coaching-techniques-esl.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/accent-reduction-activities-esl.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/action-research-esl-teachers.html | 1126 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adapting-task-difficulty-for-one-adult-english-learner.html | 1091 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adapting-textbook-tasks-for-adult-one-to-one-english-lessons.html | 1112 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-business-english-homework-feedback-loop.html | 1135 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-esl-student-profile-lesson-planning.html | 1122 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-learner-autonomy-in-private-english-lessons.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-learner-performance-evidence-beyond-tests.html | 1089 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-one-to-one-accessibility-adaptations-for-english-lessons.html | 1073 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-one-to-one-neurodivergent-english-lesson-adaptations.html | 1090 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-professional-task-projects-in-english-coaching.html | 1083 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/adult-vocabulary-retrieval-practice-not-games.html | 1058 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/ai-generated-listening-exercises-esl.html | 1113 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/ai-homework-grading-for-english-teachers.html | 1119 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/ai-powered-differentiation-esl.html | 1119 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/ai-tools-for-english-teachers-2026.html | 1120 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/ai-worksheet-generator-vs-lesson-planning-chatbot.html | 1143 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |

### Batch 2

| Route | Words | Reason |
| --- | --- | --- |
| /blog/art-based-language-activities-esl.html | 1090 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/authentic-listening-materials-esl.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/best-apps-learning-english-2026.html | 1089 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/best-lesson-prep-tool-for-english-tutors.html | 1129 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/best-workflow-for-private-english-tutors.html | 1146 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/between-session-homework-evidence-for-private-english-tutors.html | 1079 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/bilingual-education-models-comparison.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/bottom-up-top-down-listening-esl.html | 1096 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/building-esl-teaching-portfolio.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/business-english-material-generation-workflow.html | 1121 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cambridge-exam-preparation-tips-teachers.html | 1090 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/can-ai-plan-one-to-one-english-lesson.html | 1137 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cefr-aligned-worksheet-generation-workflow.html | 1121 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cefr-evidence-for-private-english-lessons.html | 1136 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/clil-methodology-complete-guide.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cloze-test-design-esl.html | 1083 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/collaborative-writing-activities-esl.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/communicative-language-teaching-activities.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/connected-speech-teaching-activities.html | 1084 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/consciousness-raising-grammar-tasks.html | 1084 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |

### Batch 3

| Route | Words | Reason |
| --- | --- | --- |
| /blog/contrastive-analysis-language-teaching.html | 1080 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cooperative-learning-structures-esl.html | 1079 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/corpus-linguistics-esl-teaching.html | 1084 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/course-evaluation-esl-programs.html | 1080 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cpd-planning-esl-teachers.html | 1080 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/creating-authentic-materials-esl.html | 1084 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/creating-english-tests-guide.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/creating-interactive-worksheets-online.html | 1110 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/creative-writing-activities-esl.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/critical-period-hypothesis-language.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/cross-cultural-communication-activities.html | 1081 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/culturally-responsive-teaching-esl.html | 1082 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/current-events-esl-lessons.html | 1087 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/data-driven-learning-esl-corpora.html | 1090 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/debate-activities-english-class.html | 1088 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/designing-english-midterm-final-exams.html | 1102 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/diagnostic-testing-english-learners.html | 1084 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/dictation-for-adult-listening-accuracy-evidence.html | 1099 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/dictogloss-technique-esl-teaching.html | 1083 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/digital-homework-tools-esl-teachers.html | 1117 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |

### Batch 4

| Route | Words | Reason |
| --- | --- | --- |
| /blog/digital-resource-curation-esl.html | 1100 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/discussion-questions-esl-topics.html | 1089 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/editable-ai-worksheets-for-adult-english-learners.html | 1139 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/emi-english-medium-instruction-guide.html | 1111 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/end-of-term-activities-esl.html | 1118 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/energy-management-esl-lessons.html | 1116 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/english-for-specific-purposes-guide.html | 1090 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/english-homework-ai-grading-workflow.html | 1121 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/english-tutor-material-organization-workflow.html | 1119 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/english-tutor-workflow-after-a-live-lesson.html | 1139 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/error-correction-techniques-esl.html | 1095 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/esl-exercise-type-selection-guide.html | 1114 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/extensive-reading-programs-esl.html | 1083 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/fill-in-the-blanks-exercises-best-practices.html | 1121 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/first-adult-one-to-one-english-lesson-evidence-capture.html | 1094 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/five-minute-filler-activities-esl.html | 427 | Matches Edooqoo strategic audience or product workflow without strong school-like drift. |
| /blog/formative-assessment-english-teaching.html | 1099 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/from-lesson-evidence-to-next-lesson-plan.html | 1139 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/from-student-goals-to-worksheet.html | 1123 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |
| /blog/gender-inclusive-language-esl.html | 1083 | Generated x1000 adult 1:1 article or refresh already uses the approved evidence-led tutor workflow format. |

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
