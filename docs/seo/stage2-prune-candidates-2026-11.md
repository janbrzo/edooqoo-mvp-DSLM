# Stage-2 prune candidates (prepared 2026-10-05, to execute only after the November checkpoint)

Decision source: `docs/seo/decisions-2026-10.md` item 1. Nothing here is implemented. Execute only if the go criteria in `docs/seo/checkpoint-2026-11.md` are met.

Population: indexable static pages with `maxContainment >= 0.5` (templated) and fewer than 10 impressions in the 3-month GSC window 2026-06-30..2026-09-29 (`npm run seo:audit-uniqueness` + GSC Pages export). 213 pages, 11 clicks and 327 impressions in total. Action is `noindex,follow` and removal from the sitemap, never deletion; URLs keep working.

## Summary

| Action | Pages |
|---|---:|
| NOINDEX (proposed) | 162 |
| PROTECTED: needs a decision, see below | 39 |
| SURVIVOR: stays indexed | 12 |

| Group | NOINDEX | PROTECTED | SURVIVOR |
|---|---:|---:|---:|
| blog | 104 | 24 | 0 |
| zawodowe | 36 | 0 | 10 |
| ai | 21 | 14 | 2 |
| inne | 1 | 1 | 0 |

Rules applied:
- Profession scenario pages (`*-worksheet`, `*-lesson-prep`, `*-what-to-teach-next`): one page per profession survives. Where all three variants are in this list, the `-worksheet` page survives; where one variant already has 10 or more impressions, that one is the survivor.
- AI/comparison cluster: three survivors, `/edooqoo-vs-chatgpt.html` (not in this list, it has 10+ impressions), `/chatgpt-alternative-for-english-tutors.html` and `/best-ai-tools-for-private-english-tutors.html`.
- PROTECTED = registry state `keep` (strategic) or linked from a cluster hub, home or what-to-teach-next. Noindexing these would break `seo:audit-internal-links` (priority hubs must not link to noindex pages) and the strategic set. For each one choose: (a) rewrite it (move it to the 53-post queue), (b) merge it into a survivor with a 301, or (c) noindex it and remove the hub link. Default if no decision: (a) for blog posts, (c) otherwise.

## NOINDEX list (162 pages)

| Clicks | Impr | maxContainment | Route |
|---:|---:|---:|---|
| 0 | 9 | 0.85 | /best-chatgpt-prompts-for-esl-teachers-vs-workflow.html |
| 0 | 9 | 0.922 | /blog/academic-language-functions-clil.html |
| 0 | 9 | 0.931 | /blog/from-lesson-evidence-to-next-lesson-plan.html |
| 0 | 9 | 0.932 | /blog/how-private-english-tutors-use-ai-safely.html |
| 0 | 9 | 0.935 | /blog/how-to-build-student-context-for-english-tutoring.html |
| 1 | 9 | 0.911 | /blog/how-to-design-one-to-one-english-lessons-for-professionals.html |
| 0 | 8 | 0.875 | /ai-tools-for-esl-progress-tracking.html |
| 0 | 8 | 0.878 | /blog/teaching-modality-english-esl.html |
| 0 | 8 | 0.88 | /chatgpt-alternative-for-homework-review.html |
| 0 | 7 | 0.887 | /ai-tools-for-one-to-one-english-lessons.html |
| 0 | 7 | 0.938 | /blog/course-evaluation-esl-programs.html |
| 1 | 7 | 0.786 | /blog/krashen-hypotheses-esl-teaching.html |
| 0 | 7 | 0.87 | /blog/phonemic-awareness-activities-esl.html |
| 0 | 7 | 0.875 | /blog/private-english-tutor-homework-workflow.html |
| 0 | 7 | 0.78 | /blog/think-pair-share-esl-variations.html |
| 0 | 6 | 0.802 | /blog/selecting-esl-textbooks-guide.html |
| 0 | 5 | 0.918 | /blog/bottom-up-top-down-listening-esl.html |
| 0 | 5 | 0.931 | /blog/editable-ai-worksheets-for-adult-english-learners.html |
| 0 | 5 | 0.941 | /blog/gender-inclusive-language-esl.html |
| 0 | 5 | 0.851 | /blog/how-to-use-chatgpt-for-esl-lesson-prep-without-losing-context.html |
| 0 | 5 | 0.888 | /entrepreneur-customer-interview-what-to-teach-next.html |
| 2 | 5 | 0.66 | /esl-worksheets/environment/b2-upper-intermediate |
| 0 | 4 | 0.843 | /ai-lesson-prep-software-for-private-tutors.html |
| 0 | 4 | 0.936 | /blog/best-workflow-for-private-english-tutors.html |
| 0 | 4 | 0.928 | /blog/cooperative-learning-structures-esl.html |
| 0 | 4 | 0.942 | /blog/extensive-reading-programs-esl.html |
| 0 | 4 | 0.923 | /blog/how-to-use-student-context-in-ai-worksheet-generation.html |
| 0 | 4 | 0.895 | /blog/teacher-controlled-ai-lesson-prep.html |
| 0 | 4 | 0.857 | /gemini-for-esl-lesson-planning-limitations.html |
| 0 | 4 | 0.869 | /perplexity-for-esl-teachers-limitations.html |
| 0 | 3 | 0.832 | /best-ai-tools-for-english-tutors-with-student-context.html |
| 1 | 3 | 0.944 | /blog/accent-coaching-techniques-esl.html |
| 0 | 3 | 0.92 | /blog/authentic-listening-materials-esl.html |
| 0 | 3 | 0.931 | /blog/critical-period-hypothesis-language.html |
| 0 | 3 | 0.912 | /blog/how-to-build-an-adult-esl-lesson-from-real-work-tasks.html |
| 0 | 3 | 0.92 | /blog/how-to-review-homework-before-next-english-lesson.html |
| 1 | 3 | 0.901 | /blog/teaching-abstract-vocabulary-esl.html |
| 1 | 3 | 0.882 | /blog/teaching-aspect-english-grammar.html |
| 0 | 3 | 0.89 | /blog/what-to-teach-after-a-writing-homework.html |
| 0 | 3 | 0.873 | /customer-success-renewal-call-worksheet.html |
| 0 | 2 | 0.928 | /blog/collaborative-writing-activities-esl.html |
| 0 | 2 | 0.916 | /blog/how-to-review-ai-generated-esl-worksheets-before-teaching.html |
| 0 | 2 | 0.882 | /blog/how-to-track-adult-english-student-progress.html |
| 0 | 2 | 0.872 | /blog/how-to-turn-student-notes-into-esl-worksheets.html |
| 0 | 2 | 0.894 | /blog/input-output-evidence-in-adult-one-to-one-english-lessons.html |
| 0 | 2 | 0.866 | /blog/intercultural-communication-for-adult-professional-english.html |
| 0 | 2 | 0.874 | /operations-manager-process-update-worksheet.html |
| 0 | 1 | 0.901 | /ai-tools-for-adult-esl-homework.html |
| 0 | 1 | 0.897 | /ai-tools-for-business-english-tutors.html |
| 0 | 1 | 0.937 | /blog/adult-business-english-homework-feedback-loop.html |
| 0 | 1 | 0.874 | /blog/adult-learner-autonomy-in-private-english-lessons.html |
| 0 | 1 | 0.883 | /blog/adult-learner-performance-evidence-beyond-tests.html |
| 0 | 1 | 0.889 | /blog/adult-vocabulary-retrieval-practice-not-games.html |
| 0 | 1 | 0.874 | /blog/between-session-homework-evidence-for-private-english-tutors.html |
| 0 | 1 | 0.917 | /blog/cefr-evidence-for-private-english-lessons.html |
| 1 | 1 | 0.925 | /blog/creating-authentic-materials-esl.html |
| 0 | 1 | 0.939 | /blog/english-for-specific-purposes-guide.html |
| 0 | 1 | 0.876 | /blog/first-adult-one-to-one-english-lesson-evidence-capture.html |
| 0 | 1 | 0.92 | /blog/from-student-goals-to-worksheet.html |
| 0 | 1 | 0.916 | /blog/how-to-choose-an-ai-tool-for-private-english-tutoring.html |
| 0 | 1 | 0.906 | /blog/how-to-create-business-english-homework-that-gets-completed.html |
| 0 | 1 | 0.919 | /blog/how-to-plan-a-recurring-english-student-learning-loop.html |
| 0 | 1 | 0.919 | /blog/how-to-reduce-lesson-prep-time-for-private-english-tutors.html |
| 0 | 1 | 0.923 | /blog/how-to-track-progress-without-school-like-tests.html |
| 0 | 1 | 0.915 | /blog/how-to-turn-homework-errors-into-next-lesson-focus.html |
| 0 | 1 | 0.853 | /blog/peer-observation-esl-teachers.html |
| 0 | 1 | 0.878 | /blog/tutor-workflow-system-vs-lms-for-private-english-lessons.html |
| 0 | 1 | 0.898 | /blog/using-chatbots-language-practice.html |
| 0 | 1 | 0.896 | /blog/what-to-teach-after-a-speaking-lesson.html |
| 0 | 1 | 0.872 | /blog/why-chatgpt-is-not-enough-for-recurring-english-tutoring.html |
| 0 | 1 | 0.884 | /blog/why-generic-esl-worksheets-fail-adult-learners.html |
| 0 | 1 | 0.864 | /chatgpt-alternative-for-business-english-tutors.html |
| 0 | 1 | 0.891 | /hr-performance-conversation-what-to-teach-next.html |
| 0 | 1 | 0.84 | /perplexity-alternative-for-esl-teachers.html |
| 0 | 1 | 0.914 | /software-engineer-incident-explanation-what-to-teach-next.html |
| 0 | 0 | 0.915 | /accountant-variance-explanation-lesson-prep.html |
| 0 | 0 | 0.906 | /accountant-variance-explanation-what-to-teach-next.html |
| 0 | 0 | 0.863 | /ai-lesson-planner-vs-worksheet-workflow.html |
| 0 | 0 | 0.941 | /blog/academic-vocabulary-teaching-strategies.html |
| 0 | 0 | 0.866 | /blog/adapting-textbook-tasks-for-adult-one-to-one-english-lessons.html |
| 0 | 0 | 0.883 | /blog/adult-one-to-one-accessibility-adaptations-for-english-lessons.html |
| 0 | 0 | 0.871 | /blog/adult-one-to-one-neurodivergent-english-lesson-adaptations.html |
| 0 | 0 | 0.884 | /blog/adult-professional-task-projects-in-english-coaching.html |
| 0 | 0 | 0.938 | /blog/art-based-language-activities-esl.html |
| 0 | 0 | 0.943 | /blog/building-esl-teaching-portfolio.html |
| 0 | 0 | 0.935 | /blog/clil-methodology-complete-guide.html |
| 0 | 0 | 0.942 | /blog/contrastive-analysis-language-teaching.html |
| 0 | 0 | 0.936 | /blog/corpus-linguistics-esl-teaching.html |
| 0 | 0 | 0.922 | /blog/cpd-planning-esl-teachers.html |
| 0 | 0 | 0.939 | /blog/creating-interactive-worksheets-online.html |
| 0 | 0 | 0.928 | /blog/creative-writing-activities-esl.html |
| 0 | 0 | 0.921 | /blog/culturally-responsive-teaching-esl.html |
| 0 | 0 | 0.934 | /blog/data-driven-learning-esl-corpora.html |
| 0 | 0 | 0.925 | /blog/designing-english-midterm-final-exams.html |
| 0 | 0 | 0.869 | /blog/dictation-for-adult-listening-accuracy-evidence.html |
| 0 | 0 | 0.92 | /blog/digital-resource-curation-esl.html |
| 0 | 0 | 0.939 | /blog/emi-english-medium-instruction-guide.html |
| 0 | 0 | 0.917 | /blog/end-of-term-activities-esl.html |
| 0 | 0 | 0.935 | /blog/energy-management-esl-lessons.html |
| 0 | 0 | 0.92 | /blog/english-tutor-workflow-after-a-live-lesson.html |
| 0 | 0 | 0.928 | /blog/growth-mindset-language-learning.html |
| 0 | 0 | 0.882 | /blog/homework-before-lesson-workflow-for-adult-english-tutors.html |
| 0 | 0 | 0.933 | /blog/how-to-avoid-generic-ai-lesson-plans-for-adults.html |
| 0 | 0 | 0.881 | /blog/how-to-avoid-school-like-esl-materials-for-adults.html |
| 0 | 0 | 0.906 | /blog/how-to-keep-chatgpt-output-from-sounding-generic-in-esl-lessons.html |
| 0 | 0 | 0.926 | /blog/how-to-plan-next-lesson-from-homework-mistakes.html |
| 0 | 0 | 0.925 | /blog/how-to-prepare-business-english-lesson-in-one-minute.html |
| 0 | 0 | 0.807 | /blog/improvisation-activities-esl.html |
| 0 | 0 | 0.876 | /blog/information-gap-tasks-for-adult-workplace-communication.html |
| 0 | 0 | 0.807 | /blog/interlanguage-fossilization-esl.html |
| 0 | 0 | 0.879 | /blog/low-friction-review-loops-for-adult-english-learners.html |
| 0 | 0 | 0.868 | /blog/managing-lesson-focus-in-one-to-one-adult-english-lessons.html |
| 0 | 0 | 0.899 | /blog/phrasal-verbs-teaching-strategies.html |
| 0 | 0 | 0.903 | /blog/podcast-based-listening-lessons-esl.html |
| 0 | 0 | 0.885 | /blog/private-english-tutor-tool-stack.html |
| 0 | 0 | 0.879 | /blog/screen-free-tech-activities-esl.html |
| 0 | 0 | 0.806 | /blog/supplementing-coursebooks-activities.html |
| 0 | 0 | 0.902 | /blog/teaching-listening-for-gist-detail.html |
| 0 | 0 | 0.828 | /blog/teaching-literacy-young-esl-learners.html |
| 0 | 0 | 0.875 | /blog/teaching-note-taking-from-lectures.html |
| 0 | 0 | 0.889 | /blog/teaching-rhythm-english-speech.html |
| 0 | 0 | 0.894 | /blog/teaching-word-families-morphology-esl.html |
| 0 | 0 | 0.889 | /blog/transitioning-between-tasks-in-adult-one-to-one-english-lessons.html |
| 0 | 0 | 0.809 | /blog/using-comics-graphic-novels-esl.html |
| 0 | 0 | 0.903 | /blog/vocabulary-notebook-strategies-esl.html |
| 0 | 0 | 0.853 | /chatgpt-alternative-for-private-esl-tutors.html |
| 0 | 0 | 0.894 | /chatgpt-vs-ai-worksheet-generator.html |
| 0 | 0 | 0.9 | /chatgpt-vs-homework-evidence-workflow.html |
| 0 | 0 | 0.854 | /claude-alternative-for-english-tutors.html |
| 0 | 0 | 0.91 | /consultant-executive-summary-lesson-prep.html |
| 0 | 0 | 0.911 | /consultant-executive-summary-what-to-teach-next.html |
| 0 | 0 | 0.861 | /customer-success-renewal-call-lesson-prep.html |
| 0 | 0 | 0.882 | /data-analyst-insight-presentation-lesson-prep.html |
| 0 | 0 | 0.883 | /data-analyst-insight-presentation-worksheet.html |
| 0 | 0 | 0.899 | /doctor-patient-explanation-lesson-prep.html |
| 0 | 0 | 0.883 | /doctor-patient-explanation-worksheet.html |
| 0 | 0 | 0.893 | /entrepreneur-customer-interview-lesson-prep.html |
| 0 | 0 | 0.915 | /executive-board-update-lesson-prep.html |
| 0 | 0 | 0.885 | /executive-board-update-what-to-teach-next.html |
| 0 | 0 | 0.899 | /finance-manager-budget-explanation-lesson-prep.html |
| 0 | 0 | 0.869 | /finance-manager-budget-explanation-worksheet.html |
| 0 | 0 | 0.863 | /gemini-alternative-for-english-tutors.html |
| 0 | 0 | 0.889 | /hr-performance-conversation-lesson-prep.html |
| 0 | 0 | 0.89 | /lawyer-client-risk-explanation-lesson-prep.html |
| 0 | 0 | 0.913 | /lawyer-client-risk-explanation-what-to-teach-next.html |
| 0 | 0 | 0.853 | /llm-vs-edtech-workflow-for-private-tutors.html |
| 0 | 0 | 0.891 | /marketing-campaign-recommendation-lesson-prep.html |
| 0 | 0 | 0.885 | /marketing-campaign-recommendation-what-to-teach-next.html |
| 0 | 0 | 0.875 | /nurse-handover-lesson-prep.html |
| 0 | 0 | 0.858 | /nurse-handover-worksheet.html |
| 0 | 0 | 0.884 | /operations-manager-process-update-lesson-prep.html |
| 0 | 0 | 0.877 | /product-manager-roadmap-tradeoff-lesson-prep.html |
| 0 | 0 | 0.88 | /product-manager-roadmap-tradeoff-worksheet.html |
| 0 | 0 | 0.89 | /project-manager-status-update-lesson-prep.html |
| 0 | 0 | 0.895 | /project-manager-status-update-what-to-teach-next.html |
| 0 | 0 | 0.889 | /sales-discovery-call-lesson-prep.html |
| 0 | 0 | 0.894 | /sales-discovery-call-what-to-teach-next.html |
| 0 | 0 | 0.914 | /software-engineer-incident-explanation-lesson-prep.html |
| 0 | 0 | 0.829 | /student-context-system-vs-chatbot-for-english-tutors.html |
| 0 | 0 | 0.817 | /teacher-controlled-ai-vs-ai-autopilot.html |
| 0 | 0 | 0.874 | /ux-designer-research-interview-lesson-prep.html |
| 0 | 0 | 0.886 | /ux-designer-research-interview-worksheet.html |

## PROTECTED list (39 pages)

| Clicks | Impr | maxContainment | Route | Why protected |
|---:|---:|---:|---|---|
| 0 | 7 | 0.93 | /blog/best-lesson-prep-tool-for-english-tutors.html | strategic in registry (keep) |
| 0 | 7 | 0.507 | /blog/setting-up-freelance-esl-business.html | strategic in registry (keep) |
| 1 | 6 | 0.93 | /blog/formative-assessment-english-teaching.html | strategic in registry (keep) + linked from a cluster hub |
| 1 | 6 | 0.503 | /blog/materials-design-principles-elt.html | strategic in registry (keep) |
| 0 | 5 | 0.92 | /blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 5 | 0.863 | /teacher-controlled-ai-for-english-tutors.html | linked from a cluster hub |
| 0 | 4 | 0.859 | /best-ai-worksheet-tools-for-english-tutors.html | linked from a cluster hub |
| 1 | 4 | 0.911 | /blog/english-homework-ai-grading-workflow.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 4 | 0.508 | /blog/teacher-burnout-prevention-esl.html | strategic in registry (keep) |
| 0 | 3 | 0.923 | /blog/ai-homework-grading-for-english-teachers.html | linked from a cluster hub |
| 0 | 3 | 0.928 | /blog/can-ai-plan-one-to-one-english-lesson.html | strategic in registry (keep) |
| 0 | 3 | 0.906 | /blog/digital-homework-tools-esl-teachers.html | linked from a cluster hub |
| 0 | 3 | 0.512 | /blog/personalized-learning-english-teaching.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 2 | 0.857 | /ai-chatbot-vs-student-context-system.html | linked from a cluster hub |
| 0 | 1 | 0.863 | /blog/esl-exercise-type-selection-guide.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 1 | 0.855 | /chatgpt-for-esl-teachers-limitations.html | linked from a cluster hub |
| 0 | 0 | 0.667 | /ai-lesson-prep-tool-vs-chatbot.html | linked from a cluster hub |
| 0 | 0 | 0.689 | /ai-tools-for-private-english-tutors.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 0 | 0.876 | /blog/adapting-task-difficulty-for-one-adult-english-learner.html | linked from a cluster hub |
| 0 | 0 | 0.847 | /blog/ai-powered-differentiation-esl.html | strategic in registry (keep) |
| 0 | 0 | 0.926 | /blog/business-english-material-generation-workflow.html | strategic in registry (keep) |
| 0 | 0 | 0.921 | /blog/cefr-aligned-worksheet-generation-workflow.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 0 | 0.94 | /blog/english-tutor-material-organization-workflow.html | strategic in registry (keep) |
| 0 | 0 | 0.925 | /blog/homework-mistakes-next-english-lesson.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 0 | 0.928 | /blog/how-english-tutors-track-what-to-teach-next.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 0 | 0.872 | /blog/motivation-theories-language-learning.html | strategic in registry (keep) |
| 0 | 0 | 0.935 | /blog/student-progress-to-worksheet-feedback-loop.html | strategic in registry (keep) |
| 0 | 0 | 0.51 | /blog/task-based-language-teaching-worksheets.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 0 | 0.509 | /blog/teaching-business-english-guide.html | strategic in registry (keep) + linked from a cluster hub |
| 0 | 0 | 0.877 | /blog/teaching-listening-strategies-esl.html | strategic in registry (keep) |
| 0 | 0 | 0.818 | /edooqoo-vs-busyteacher.html | linked from a cluster hub |
| 0 | 0 | 0.813 | /edooqoo-vs-claude.html | linked from a cluster hub |
| 0 | 0 | 0.812 | /edooqoo-vs-kahoot.html | linked from a cluster hub |
| 0 | 0 | 0.804 | /edooqoo-vs-magicschool.html | linked from a cluster hub |
| 0 | 0 | 0.81 | /edooqoo-vs-perplexity.html | linked from a cluster hub |
| 0 | 0 | 0.781 | /edooqoo-vs-quizlet.html | linked from a cluster hub |
| 0 | 0 | 0.794 | /edooqoo-vs-twee.html | linked from a cluster hub |
| 0 | 0 | 0.782 | /edooqoo-vs-wordwall.html | linked from a cluster hub |
| 0 | 0 | 0.675 | /worksheet-generator-for-language-schools.html | linked from a cluster hub |

## SURVIVORS from the same population (12 pages)

| Clicks | Impr | maxContainment | Route |
|---:|---:|---:|---|
| 0 | 1 | 0.926 | /accountant-variance-explanation-worksheet.html |
| 0 | 1 | 0.654 | /chatgpt-alternative-for-english-tutors.html |
| 0 | 1 | 0.905 | /consultant-executive-summary-worksheet.html |
| 0 | 0 | 0.673 | /best-ai-tools-for-private-english-tutors.html |
| 0 | 0 | 0.902 | /entrepreneur-customer-interview-worksheet.html |
| 0 | 0 | 0.926 | /executive-board-update-worksheet.html |
| 0 | 0 | 0.899 | /hr-performance-conversation-worksheet.html |
| 0 | 0 | 0.918 | /lawyer-client-risk-explanation-worksheet.html |
| 0 | 0 | 0.899 | /marketing-campaign-recommendation-worksheet.html |
| 0 | 0 | 0.895 | /project-manager-status-update-worksheet.html |
| 0 | 0 | 0.902 | /sales-discovery-call-worksheet.html |
| 0 | 0 | 0.9 | /software-engineer-incident-explanation-worksheet.html |

## Implementation notes (for the later PR)

- Mechanism: content registry `noindex` state (like the 17 legacy noindex routes), not pSEO policy; the generators then drop them from the sitemap, llms resources and cluster-hub links. Run `npm run seo:sync-generated` until `git status` is clean.
- Expected audit effects to handle in the same PR: `seo:audit-internal-links` (remove hub links to pruned pages, check strategic top 40/120 still meet the incoming-link minimums), `seo:audit-sitemap-integrity` (URL count falls by about 162), `seo:audit-martha-test` (x1000 routes that become noindex), `seo:audit-x1000-plan` (counts of "x1000 generated pages").
- Do not prune a URL that gained 10 or more impressions after 2026-09-29: recompute the population from a fresh GSC Pages export before executing.
