# Edooqoo RAG Context Audit

Generated from the synced local source tree. This file is an instruction manual for future AI agents extending edooqoo.com. It documents code-verifiable behavior only. It does not reproduce the protected worksheet generation prompt text.

Audit counts:
- Features documented: 28
- Components mapped: 332
- Page modules mapped: 76
- Routes mapped: 78
- Hooks mapped: 74
- Services mapped: 11
- Supabase Edge Function endpoints recorded: 77
- Typed database tables recorded: 56

Status vocabulary:
- PRODUCTION: route, component, hook, table, or endpoint is present and wired in the current codebase.
- BETA: code is present and partially wired, but completeness depends on scheduler/external execution not visible in the React source.
- ROADMAP: not used in this audit because roadmap-only claims are excluded unless code exists.

## Table of Contents
- [Product Runtime and Routing](#product-runtime-and-routing) - PRODUCTION
- [Authentication Anonymous Sessions and Account Claiming](#authentication-anonymous-sessions-and-account-claiming) - PRODUCTION
- [Teacher Dashboard and Student CRM](#teacher-dashboard-and-student-crm) - PRODUCTION
- [Worksheet Generation Form and One Minute Prep Entry](#worksheet-generation-form-and-one-minute-prep-entry) - PRODUCTION
- [Worksheet Generation Runtime and Media Pipeline](#worksheet-generation-runtime-and-media-pipeline) - PRODUCTION
- [Worksheet Editor Display Export and Downloads](#worksheet-editor-display-export-and-downloads) - PRODUCTION
- [Worksheet History Soft Delete and Recovery](#worksheet-history-soft-delete-and-recovery) - PRODUCTION
- [Public Shared Worksheets and Live Session Drawing](#public-shared-worksheets-and-live-session-drawing) - PRODUCTION
- [Homework Assignment and Interactive Submission](#homework-assignment-and-interactive-submission) - PRODUCTION
- [Flashcards and Spaced Repetition](#flashcards-and-spaced-repetition) - PRODUCTION
- [Digital Student Learning Model and One Minute Prep](#digital-student-learning-model-and-one-minute-prep) - PRODUCTION
- [Student Knowledge Base and Self Profile](#student-knowledge-base-and-self-profile) - PRODUCTION
- [Welcome Test and Placement Diagnostics](#welcome-test-and-placement-diagnostics) - PRODUCTION
- [Teacher Calendar Public Booking and Google Calendar](#teacher-calendar-public-booking-and-google-calendar) - PRODUCTION
- [Student Hub](#student-hub) - PRODUCTION
- [Billing Tokens Subscriptions and Export Payments](#billing-tokens-subscriptions-and-export-payments) - PRODUCTION
- [Public Gallery and Worksheet Publishing](#public-gallery-and-worksheet-publishing) - PRODUCTION
- [SEO Content Static Resources and AI Discovery Assets](#seo-content-static-resources-and-ai-discovery-assets) - PRODUCTION
- [SEO and AI Visibility Retrieval Map](#seo-and-ai-visibility-retrieval-map) - PRODUCTION
- [Free Browser Tools](#free-browser-tools) - PRODUCTION
- [Admin Dashboard Error Logs and Bug Reports](#admin-dashboard-error-logs-and-bug-reports) - PRODUCTION
- [Teacher Alerts and Closed Loop Monitoring](#teacher-alerts-and-closed-loop-monitoring) - BETA
- [Demo Mode](#demo-mode) - PRODUCTION
- [Data Model and Supabase Schema](#data-model-and-supabase-schema) - PRODUCTION
- [Edge Functions APIs and RPC Calls](#edge-functions-apis-and-rpc-calls) - PRODUCTION
- [Integrations and External Services](#integrations-and-external-services) - PRODUCTION
- [Frontend Component Inventory](#frontend-component-inventory) - PRODUCTION
- [State Management Hooks and Services Inventory](#state-management-hooks-and-services-inventory) - PRODUCTION
- [Configuration Build and Deployment Assets](#configuration-build-and-deployment-assets) - PRODUCTION

## Product Runtime and Routing
STATUS: PRODUCTION

PROBLEM: Teachers need one application surface that separates anonymous generation, authenticated teaching work, student-facing links, public SEO pages, and admin-only operations without mixing access rules.

EDOOQOO SOLUTION: App.tsx defines the route table and lazy imports page modules for dashboard, student details, worksheets, homework, flashcards, calendar, student hub, welcome tests, public gallery, SEO pages, tools, pricing, legal pages, auth pages, and admin pages. AuthenticatedPageShell, StickyNav, useAuthFlow, DemoContext, QueryClientProvider, TooltipProvider, HelmetProvider, and BrowserRouter wrap the runtime. The application uses English UI copy in the audited routes.

TECHNICAL MECHANICS: Core files: src/App.tsx, src/main.tsx, src/integrations/supabase/client.ts, vite.config.ts. Route count recorded from App.tsx: 78. Page modules recorded under src/pages: 76. The Supabase client uses project bvfrkzdlklyvnhlpleck, persistent localStorage auth, auto-refresh tokens, and typed Database definitions from src/integrations/supabase/types.ts. Public route groups include /, /demo, /pricing, /about, /prompts, /glossary, /exercise-types, /how-it-works, /one-minute-prep, /resources, /blog, /tools/*, /gallery, /features/*, /book/:token, /shared/:token, /homework/:token, /flashcards/:token, /welcome-test/:token, /test/:token, and /my*. Teacher routes include /dashboard, /student/:id, /worksheets, /worksheet/:id, /calendar, /calendar/settings, /calendar/logs, /teacher/alerts, /profile, /admin, and /admin/error-logs. Route inventory:
- / -> Index (./pages/Index)
- /demo -> DemoEntry (./pages/DemoEntry)
- /exit-demo -> ExitDemo (./pages/ExitDemo)
- /login -> Login (./pages/Login)
- /signup -> Signup (./pages/Signup)
- /forgot-password -> ForgotPassword (./pages/ForgotPassword)
- /reset-password -> ResetPassword (./pages/ResetPassword)
- /dashboard -> Dashboard (./pages/Dashboard)
- /profile -> Profile (./pages/Profile)
- /pricing -> Pricing (./pages/Pricing)
- /privacy-policy -> PrivacyPolicy (./pages/PrivacyPolicy)
- /privacy -> PrivacyPolicy (./pages/PrivacyPolicy)
- /terms -> TermsOfService (./pages/TermsOfService)
- /cookie-policy -> CookiePolicy (./pages/CookiePolicy)
- /student/:id -> StudentPage (./pages/StudentPage)
- /worksheets -> AllWorksheetsPage (./pages/AllWorksheetsPage)
- /worksheet/:id -> WorksheetPage (./pages/WorksheetPage)
- /worksheet-expired -> WorksheetExpiredPage (./pages/WorksheetExpiredPage)
- /homework/:token -> HomeworkPage (./pages/HomeworkPage)
- /homework/:id/review -> HomeworkReviewPage (./pages/HomeworkReviewPage)
- /flashcards/:token -> FlashcardsLearning (./pages/FlashcardsLearning)
- /my-flashcards/:studentEmail -> StudentPortal (./pages/StudentPortal)
- /test/:token -> StudentTestPage (./pages/StudentTestPage)
- /welcome-test/:token -> WelcomeTestPage (./pages/WelcomeTestPage)
- /success -> PaymentSuccess (./pages/PaymentSuccess)
- /payment-success -> PaymentSuccess (./pages/PaymentSuccess)
- /shared/:token -> SharedWorksheet (./pages/SharedWorksheet)
- /test-exercises -> TestExercises (./pages/TestExercises)
- /calendar -> CalendarPage (./pages/CalendarPage)
- /calendar/settings -> CalendarSettingsPage (./pages/CalendarSettingsPage)
- /calendar/logs -> CalendarLogHistoryPage (./components/calendar/CalendarLogHistoryPage)
- /about -> About (./pages/About)
- /prompts -> Prompts (./pages/Prompts)
- /glossary -> Glossary (./pages/Glossary)
- /exercise-types -> ExerciseTypes (./pages/ExerciseTypes)
- /how-it-works -> HowItWorks (./pages/HowItWorks)
- /one-minute-prep -> OneMinutePrep (./pages/OneMinutePrep)
- /resources -> Resources (./pages/Resources)
- /blog -> Blog (./pages/Blog)
- /esl-worksheets -> EslWorksheets (./pages/seo/EslWorksheets)
- /blog/english-games-for-learners -> EnglishGamesForLearners (./pages/seo/EnglishGamesForLearners)
- /blog/esl-games-for-teachers -> EslGamesForTeachers (./pages/seo/EslGamesForTeachers)
- /blog/teach-english-online-guide -> TeachEnglishOnlineGuide (./pages/seo/TeachEnglishOnlineGuide)
- /for-english-tutors -> ForEnglishTutors (./pages/seo/ForEnglishTutors)
- /resources/esl-class-toolkit -> EslClassToolkit (./pages/seo/EslClassToolkit)
- /esl-worksheets/:topic/:level -> TopicLevelPage (./pages/seo/programmatic/TopicLevelPage)
- /worksheets/:exerciseType/:topic -> ExerciseTopicPage (./pages/seo/programmatic/ExerciseTopicPage)
- /english-for/:persona -> PersonaPage (./pages/seo/programmatic/PersonaPage)
- /tools -> ToolsIndex (./pages/tools/ToolsIndex)
- /tools/cefr-level-test -> CefrLevelTest (./pages/tools/CefrLevelTest)
- /tools/lesson-plan-generator -> LessonPlanGenerator (./pages/tools/LessonPlanGenerator)
- /tools/vocab-cefr-checker -> VocabCefrChecker (./pages/tools/VocabCefrChecker)
- /gallery -> PublicGalleryIndex (./pages/gallery/PublicGalleryIndex)
- /gallery/:slug -> PublicGalleryWorksheetPage (./pages/gallery/PublicGalleryWorksheetPage)
- /features/dslm -> FeatureDSLM (./pages/features/FeatureDSLM)
- /features/homework -> FeatureHomework (./pages/features/FeatureHomework)
- /features/flashcards -> FeatureFlashcards (./pages/features/FeatureFlashcards)
- /features/calendar -> FeatureCalendar (./pages/features/FeatureCalendar)
- /features/live-sessions -> FeatureLiveSessions (./pages/features/FeatureLiveSessions)
- /features/placement-test -> FeaturePlacementTest (./pages/features/FeaturePlacementTest)
- /features/student-hub -> FeatureStudentHub (./pages/features/FeatureStudentHub)
- /book -> BookLandingPage (./pages/BookLandingPage)
- /book/:token -> PublicBookingPage (./pages/PublicBookingPage)
- /my -> StudentHubLanding (./pages/StudentHubLanding)
- /my/:teacherToken -> StudentHubDashboard (./pages/StudentHubDashboard)
- /my/:teacherToken/flashcards -> StudentHubFlashcards (./pages/StudentHubFlashcards)
- /my/:teacherToken/homework -> StudentHubHomework (./pages/StudentHubHomework)
- /my/:teacherToken/worksheets -> StudentHubWorksheets (./pages/StudentHubWorksheets)
- /my/:teacherToken/lessons -> StudentHubLessons (./pages/StudentHubLessons)
- /my/:teacherToken/settings -> StudentHubSettings (./pages/StudentHubSettings)
- /my/:teacherToken/profile -> StudentHubProfile (./pages/StudentHubProfile)
- /gcal-student-callback -> GCalStudentCallback (./pages/GCalStudentCallback)
- /my-lessons/:token -> StudentLessonsPage (./pages/StudentLessonsPage)
- /admin -> AdminDashboardPage (./pages/AdminDashboardPage)
- /admin/error-logs -> AdminErrorLogsPage (./pages/AdminErrorLogsPage)
- /status -> StatusPage (./pages/StatusPage)
- /teacher/alerts -> TeacherAlertsPage (./pages/TeacherAlertsPage)
- * -> NotFound (./pages/NotFound)

RAG KEYWORDS: React Router, Vite React, Supabase client, authenticated route, public route, student route, admin route, ESL app shell, teacher dashboard route, worksheet route, student hub route, SEO route, route audit, SPA architecture

## Authentication Anonymous Sessions and Account Claiming
STATUS: PRODUCTION

PROBLEM: Teachers can start generating before committing to an account, but they must not lose the worksheet when they later register.

EDOOQOO SOLUTION: useAuthFlow centralizes Supabase auth state, registered-user detection, anonymous-user detection, demo-user handling, and pending worksheet claim checks. Auth.tsx, Signup.tsx, Login.tsx, ForgotPassword.tsx, ResetPassword.tsx, GoogleSignInButton, EmailConfirmationModal, claimPendingWorksheets, markWorksheetForClaim, and claim-anonymous-worksheets provide account creation, login, reset, Google sign-in, and post-signup transfer of anonymous worksheet ownership.

TECHNICAL MECHANICS: Auth state is loaded through supabase.auth.getSession and onAuthStateChange. Signup.tsx redirects back to the 1-Minute Prep flow when the user arrived from /one-minute-prep or state.startOneMinutePrep. Auth.tsx supports plan-first registration and invokes create-subscription for paid plans before registration when selected. Anonymous worksheet IDs are stored client-side by useWorksheetClaim, then transferred through claimPendingWorksheets after a non-anonymous session appears. add-tokens grants Free Demo welcome tokens through an Edge Function. Database tables include profiles, worksheets, user_roles, token_transactions, subscriptions, and subscription_events. Edge Functions involved: add-tokens, claim-anonymous-worksheets, create-subscription, check-subscription-status, customer-portal, delete-account, verify-subscription-payment.

RAG KEYWORDS: Supabase Auth, anonymous worksheet, worksheet claim, Google sign-in, email confirmation, password reset, teacher account, signup redirect, Free Demo tokens, account conversion, ESL teacher login, authentication flow, registration, session storage

## Teacher Dashboard and Student CRM
STATUS: PRODUCTION

PROBLEM: A 1-on-1 adult English teacher needs a fast operational view of students, worksheet history, and follow-up tasks before preparing the next lesson.

EDOOQOO SOLUTION: Dashboard.tsx combines useStudents, useWorksheetHistory, useDeletedWorksheets, useWorksheetStats, useAllWorksheetHomework, useUpcomingLessonsCount, useTokenSystem, useOnboardingProgress, StudentList, RecentWorksheets, AddStudentDialog, WorksheetHomeworkList, and dashboard cards. StudentPage.tsx deepens the CRM view with tabs for overview, 1-Minute Prep/DSLM, homework, tests, flashcards, calendar, progress, skills, and events.

TECHNICAL MECHANICS: useStudents reads active rows from students by teacher_id, inserts new students with level, native language, main goal, target date, overdue-email flag, and default dslm_pacing_mode 30, rejects duplicate emails, soft-deletes via soft_delete_student RPC, updates students and triggers recalculate-pacing on meaningful goal/deadline changes, and emits studentUpdated. StudentPage.tsx uses useStudent, useStudents, useWorksheetHistory, useDeletedWorksheets, useStudentKnowledge, and useAllWorksheetHomework. Student creation can invoke gcal-sync to create permanent meeting rooms when calendar integration allows it. Tables include students, worksheets, homework_assignments, calendar_slots, calendar_settings, calendar_student_settings, student_events, student_learning_profiles, student_skill_metrics, student_progress_goals, and future_worksheet_suggestions.

RAG KEYWORDS: student management, ESL CRM, EFL learner profile, adult learner goal, student dashboard, worksheet history, lesson prep, student tab, teacher workflow, soft delete student, learner context, CEFR level, main goal, private tutor CRM

## Worksheet Generation Form and One Minute Prep Entry
STATUS: PRODUCTION

PROBLEM: Teachers waste prep time translating student goals into a complete worksheet input set before the generation step even starts.

EDOOQOO SOLUTION: WorksheetForm/index.tsx, AdvancedOptions, EnglishLevelSelector, ExerciseSelector, LanguageStyleSlider, StudentContextHint, TypewriterHint, NextStepsPresetBanner, TrackingFormWrapper, useWorksheetFormPersistence, useStudentSelector, useFutureTimeline, and useOneMinutePrep coordinate manual, random, smart, and DSLM-prefilled worksheet requests. The Index route opens the usable generator first and can auto-open AddStudentDialog from signup or 1-Minute Prep entry paths.

TECHNICAL MECHANICS: Form fields include lessonTime, lessonTopic, lessonGoal, grammarFocus, additionalInfo, englishLevel A1/A2, B1/B2, or C1/C2, languageStyle, selectedStudentId, exercises, selectedMediaFamily, and media mode picture/audio. The form supports manual exercise selection, random selection, and smart selection via suggest-exercises. It reads DSLM prefill keys from sessionStorage: prefillWorksheet, prefillExercises, prefillExerciseFocusMap, prefillMediaTypes, and autoGenerateWorksheet. It pads exercises to six or eight depending on lesson time. It persists drafts per user or anonymous session through useWorksheetFormPersistence. It never modifies the internal worksheet prompt engine; future prompt edits require an explicit request to update the Worksheet Generation Engine.

RAG KEYWORDS: 1-Minute Prep, worksheet form, ESL worksheet generator, CEFR selector, language style, exercise selector, smart exercises, lesson goal, grammar focus, adult ESL prep, private tutor prep, student context, session prefill, worksheet request

## Worksheet Generation Runtime and Media Pipeline
STATUS: PRODUCTION

PROBLEM: A teacher needs the generator to fail transparently, preserve entitlement rules, and return a usable worksheet without manually coordinating AI, media, database writes, and UI progress.

EDOOQOO SOLUTION: useWorksheetGeneration.tsx orchestrates the runtime; worksheetStreamService.ts posts to generateWorksheet with server-sent events; mediaService.ts invokes generate-audio and generate-image; processGeneratedWorksheet, exercise validation utilities, and WorksheetDisplay consume the resulting structured worksheet. The prompt wording and generation logic under supabase/functions/generateWorksheet is treated as protected IP and is not reproduced here.

TECHNICAL MECHANICS: The flow guards demo mode, duplicate clicks, token entitlement, and stale worksheet state. It calls check-subscription-status, pre-generates audio/image through generate-audio and generate-image when selected, then POSTs to /functions/v1/generateWorksheet with enableStreaming true, Authorization using the Supabase anon key, and body fields from the form plus userId. worksheetStreamService parses SSE events start, progress, done, and error, applies a 45-second heartbeat, and performs one silent retry only if no exercise has streamed. On success it validates exercise count, builds fallback vocabulary when needed, persists current worksheet state, updates the browser URL to /worksheet/:id, dispatches worksheetGenerationSuccess, consumes a token with useTokenSystem, and marks a used future_worksheet_suggestions record when generated from DSLM.

RAG KEYWORDS: worksheet generation, SSE streaming, Supabase Edge Function, generateWorksheet, audio generation, image generation, token entitlement, AI worksheet, ESL materials, adult learning worksheet, media exercise, generation progress, Gemini, Lovable AI Gateway

## Worksheet Editor Display Export and Downloads
STATUS: PRODUCTION

PROBLEM: Teachers need to edit generated materials and export usable student/teacher versions without losing the worksheet during navigation, payment return, or page reload.

EDOOQOO SOLUTION: WorksheetPage.tsx fetches a worksheet by ID; WorksheetDisplay, WorksheetContent, WorksheetToolbar, WorksheetHeader, ExerciseNavSidebar, MediaBadges, exercise renderer components, useWorksheetState, useWorksheetNavigation, useExerciseRegeneration, useSectionRegeneration, downloadSessionService, and PaymentSuccess.tsx implement viewing, editing, regeneration, navigation, and download unlocks.

TECHNICAL MECHANICS: WorksheetPage.tsx selects worksheets by id, enforces teacher ownership for registered users, allows ownerless anonymous worksheets for 24 hours, parses ai_response, and falls back to html_content. useWorksheetState stores currentWorksheet, currentEditableWorksheet, currentInputParams, currentGenerationTime, currentSourceCount, and currentWorksheetId in sessionStorage and clears download tokens separately. Download unlocks are tied to download_sessions and export_payments through create-export-payment, verify-export-payment, and sessionStorage downloadToken/downloadTokenExpiry. Exercise renderers under src/components/worksheet cover generated exercise types including fill blanks, multiple choice, matching, phrase matching, role play, grammar rules, vocabulary, audio, image, media exercises, speaking prompts, transformation, and summary sections.

RAG KEYWORDS: worksheet editor, editable worksheet, teacher version, student version, HTML export, PDF export, download session, worksheet toolbar, exercise renderer, media pin, worksheet restore, regenerate exercise, ESL worksheet display, generated materials

## Worksheet History Soft Delete and Recovery
STATUS: PRODUCTION

PROBLEM: A teacher with many 1-on-1 students needs fast recovery and filtering when worksheets accumulate across lessons.

EDOOQOO SOLUTION: AllWorksheetsPage.tsx uses useWorksheetHistory, useDeletedWorksheets, useAllWorksheetHomework, DeleteWorksheetButton, MediaBadges, WorksheetHomeworkList, filters, sorting, pagination, active/deleted tabs, and restore actions.

TECHNICAL MECHANICS: useWorksheetHistory reads worksheets by teacher_id with deleted_at null, supports server-side student filtering including unassigned, listView select projections, exact counts, pagination, lightweight recent mode, soft_delete_worksheet RPC deletion, and restore by setting deleted_at null. useDeletedWorksheets reads worksheets where deleted_at is not null and restores the same way. AllWorksheetsPage keeps currentPage, searchQuery, selectedStudent, sortBy, sortOrder, selectedWorksheets, activeTab, and per-row homework collapsibles. Related tables: worksheets, homework_assignments, students, worksheet_student_answers, download_sessions, export_payments.

RAG KEYWORDS: worksheet library, deleted worksheets, restore worksheet, soft delete, worksheet archive, student filter, worksheet search, teacher materials library, homework per worksheet, ESL worksheet management, unassigned worksheet, pagination

## Public Shared Worksheets and Live Session Drawing
STATUS: PRODUCTION

PROBLEM: Students need to work on shared worksheets without full accounts, while teachers need live-session control and review visibility.

EDOOQOO SOLUTION: SharedWorksheet.tsx, SharedWorksheetContent, SharedWorksheetEmailVerification, StudyModeButton, SharedWorksheetProgressBar, useInteractiveSharedWorksheet, ExerciseNavSidebar, DrawingToggleButton, DrawingToolbar, DrawingOverlay, and drawing types implement the shared worksheet experience.

TECHNICAL MECHANICS: SharedWorksheet loads data through get_worksheet_by_share_token RPC, checks if the current Supabase user owns the worksheet, bypasses email verification for the teacher, verifies students with verify_worksheet_student_email RPC, remembers verified email for 48 hours by token, and blocks unassigned worksheet access for non-teachers. useInteractiveSharedWorksheet loads answers through get_worksheet_student_answers, saves answers through save_worksheet_answer, tracks active time per exercise excluding inactive tab time, autosaves after 1.5 seconds, saves audio answer URLs, queues open-ended AI evaluations through needs_ai_evaluation and queue_worksheet_ai_evaluation, invokes process-pending-ai-evaluations after 10-minute inactivity, and polls evaluation state every 30 seconds. Teacher live mode can edit ai_response directly and draw over content using worksheet_drawings.

RAG KEYWORDS: shared worksheet, live session, student email verification, autosave answers, worksheet drawing, teacher edit mode, interactive worksheet, AI evaluation, answer visibility, study mode, ESL homework link, speaking answer, worksheet share token

## Homework Assignment and Interactive Submission
STATUS: PRODUCTION

PROBLEM: Adult learners need homework tied to the lesson, and teachers need submissions plus feedback signals without manually rebuilding the worksheet.

EDOOQOO SOLUTION: CreateHomeworkModal, HomeworkPage.tsx, HomeworkReviewPage.tsx, HomeworkExerciseRenderer, HomeworkProgressBar, HomeworkSpeakingRecorder, StudentEmailVerification, SendHomeworkEmailDialog, AiEvaluationBadge, AiEvalFeedbackButtons, useInteractiveHomework, useHomeworkExerciseGeneration, useHomeworkNotifications, and StudentHomeworkTab implement assignment, student work, and teacher review.

TECHNICAL MECHANICS: CreateHomeworkModal selects a student, deadline date/time, reminder hours, worksheet exercises, optional extra generated exercises, send-teacher-copy flag, and share link copying. It writes homework_assignments, generates share tokens through generate_homework_share_token RPC, and invokes send-homework-email. useInteractiveHomework verifies email through verify_homework_student_email, loads/saves answers through get_student_homework_answers and save_homework_answer, tracks active time, supports audio answers and transcriptions, computes local mastery, submits through submit_homework_answers, emits student_events through add_student_event, invokes verify-open-answers for open and speaking answers, stores ai_evaluation on homework_student_answers, and triggers insert_homework_submission_notification. Reminder support uses homework_notifications and send-homework-reminders.

RAG KEYWORDS: interactive homework, ESL homework, homework assignment, student submission, AI grading, open answer verification, speaking homework, homework reminder, teacher review, share token, adult learner follow-up, mastery score, homework email

## Flashcards and Spaced Repetition
STATUS: PRODUCTION

PROBLEM: Vocabulary from adult lessons decays quickly unless students get structured review connected to their real worksheet content.

EDOOQOO SOLUTION: FlashcardSetsSection, CreateFlashcardSetModal, AddFlashcardModal, ImportFromVocabularyModal, QuickImportToFlashcardsModal, QuickAddWordToFlashcardsModal, FlashcardSetEditor, FlashcardDisplay, LearningProgress, SessionSummary, ShareFlashcardSetModal, ShareAllFlashcardSetsModal, FlashcardsLearning.tsx, and hooks useFlashcardSets, useFlashcardCards, useFlashcardLearning, useFlashcardDefinition, useFlashcardTranslation power the module.

TECHNICAL MECHANICS: useFlashcardSets reads flashcard_sets with student, teacher, cards, and progress aggregates, creates/updates sets, soft-deletes through soft_delete_flashcard_set, and creates one-year share tokens through generate_flashcard_share_token. useFlashcardCards reads flashcard_cards, adds/updates/deletes/reorders cards, and bulk imports normalized vocabulary_sheet data from worksheets. FlashcardsLearning resolves get_flashcard_set_by_share_token, asks for learner email unless passed by Student Hub, supports browse and study modes, and routes back by returnTo. useFlashcardLearning calls get_flashcard_cards_for_learning, filters due/new/mistakes/all cards, duplicates cards for bidirectional sets, shuffles, applies SM-2 intervals, stores flashcard_progress by card_id, learner_identifier, and direction, and records last_response_time_ms and last_quality_rating.

RAG KEYWORDS: flashcards, spaced repetition, SM-2, vocabulary review, ESL vocabulary, bidirectional cards, learner email, flashcard set, vocabulary sheet import, CEFR vocabulary, memorization, retrieval practice, private English tutor

## Digital Student Learning Model and One Minute Prep
STATUS: PRODUCTION

PROBLEM: The teacher needs the next lesson to be based on the student's trajectory, not on generic topic lists or school-style unit plans.

EDOOQOO SOLUTION: DSLMTab, PathwayView, GoalsView, SkillsView, ProfileView, LearningTimeline, MacroTimeline, NextStepsSection, SuggestionEditorDialog, GenerateStepsDialog, BehavioralStatsCard, ConfidenceBadge, useFutureTimeline, useCurriculumPhases, useStudentProgress, usePacingProposals, useBehavioralStats, useSkillMetrics, generate-timeline, generate-curriculum-phases, recalculate-pacing, and pacing-periodic-check implement the 1-Minute Prep context layer.

TECHNICAL MECHANICS: DSLMTab has Pathway, Goals, Skills, and Profile sections with mobile horizontal nav and desktop sticky sidebar. useFutureTimeline manages future_worksheet_suggestions with next_step or phase_step type, generation, replacement, add, edit, mark used, restore, delete, and active suggestion padding to eight exercises. generate-timeline reads students, student_skill_metrics, student_knowledge_entries, student_progress_goals, worksheets, optional dslm_curriculum_phases, and existing suggestions, then returns sanitized suggestions with exercise focus map and media family. useCurriculumPhases reads/inserts/updates/soft-deletes dslm_curriculum_phases and invokes generate-curriculum-phases. recalculate-pacing computes dslm_pacing_mode from goals, deadlines, level, skill metrics, welcome profile traits, and self-profile entries; proposal mode writes pacing_proposals instead of mutating students. The internal prompt text is not reproduced.

RAG KEYWORDS: DSLM, Digital Student Learning Model, 1-Minute Prep, next lesson suggestion, ESL pathway, curriculum phases, adult learning goals, pacing mode, learner profile, skill metrics, CEFR progression, worksheet recommendation, andragogy

## Student Knowledge Base and Self Profile
STATUS: PRODUCTION

PROBLEM: Adult ESL lessons become generic when the teacher cannot preserve professional context, preferences, constraints, recurring mistakes, and real-life goals.

EDOOQOO SOLUTION: StudentKnowledgeTab, AddEntryModal, EditEntryModal, KnowledgeEntryCard, KnowledgeFilters, StudentContextPanel, StudentProfileSummary, StudentHubProfile.tsx, constants/studentSelfProfile, useStudentKnowledge, useStudentProgress, get-student-self-profile, update-student-self-profile, and classify-knowledge-entry capture and organize learner context.

TECHNICAL MECHANICS: useStudentKnowledge reads student_knowledge_entries with filters and tags from get_student_tags RPC, adds/updates/deletes entries, soft-deletes through soft_delete_knowledge_entry, marks current/outdated through RPCs, archives used entries, and confirms current entries through metadata. New Notes entries trigger classify-knowledge-entry as a best-effort Edge Function. StudentHubProfile loads self-profile fields through get-student-self-profile and saves each field group through update-student-self-profile. Self-profile data is stored as student_knowledge_entries category Self-Profile. useStudentProgress manages student_progress_goals and student_learning_elements, including add/update/delete/archive/unarchive and pacing recalculation proposals on goal changes.

RAG KEYWORDS: student knowledge, learner context, adult ESL profile, self-profile, professional goals, learning preferences, recurring mistakes, knowledge entry, student goal, learning element, tutor notes, learner biography, andragogical context

## Welcome Test and Placement Diagnostics
STATUS: PRODUCTION

PROBLEM: A teacher needs diagnostic evidence for level, skills, traits, and starting path before building a personalized adult ESL plan.

EDOOQOO SOLUTION: StudentTestsTab, StudentTestPage.tsx, WelcomeTestPage.tsx, WelcomeTestSuggestion, WelcomeTestHistory, TestProgress, SectionCelebration, BrainResetGames, SpeakingRecorder, ListeningPlayer, useStudentTests, useWelcomeTest, useWelcomeTestActions, useWelcomeTestHistory, generate-welcome-test-audio, process-welcome-test, transcribe-audio, send-welcome-test-completion-email, and backfill-welcome-test-auto-apply implement tests.

TECHNICAL MECHANICS: useStudentTests manages student_tests, student_test_questions, and test_skill_results, creates welcome tests idempotently unless retake, generates share tokens through generate_test_share_token RPC, sets a 90-day TTL for welcome tests and 30 days for other tests, and calculates results through calculate_test_results. WelcomeTestPage verifies email against students.student_email, stores local 24-hour token email, handles teacher preview/read-only, instructions, test, paused, completed, and section celebration states. useWelcomeTest loads test data with get_test_by_share_token, updates status assigned to in_progress, saves answers, tracks tab visibility adjusted time, uploads speaking recordings, emits student_events with nano-skill ratings and traits, completes through calculate_test_results, and invokes process-welcome-test. process-welcome-test writes profile, skill metrics, events, AI summary, retake evolution, notification email, transcription, and pacing recalculation. Prompt text is not reproduced.

RAG KEYWORDS: welcome test, placement test, diagnostic test, CEFR placement, ESL assessment, speaking recorder, listening test, learner traits, skill metrics, test share token, adult English level, onboarding assessment, proficiency diagnostics

## Teacher Calendar Public Booking and Google Calendar
STATUS: PRODUCTION

PROBLEM: 1-on-1 tutors need scheduling, lesson links, student booking, payment tracking, and worksheet context in one operational calendar.

EDOOQOO SOLUTION: CalendarPage.tsx, CalendarSettingsPage.tsx, CalendarLogHistoryPage, CalendarDayView, CalendarWeekView, CalendarMonthView, CalendarScheduleView, CalendarToolbar, UnifiedSlotModal, SlotDetailModal, LinkWorksheetModal, RecurringBookingModal, PaymentHistoryModal, StudentBookingsSection, StudentCalendarTab, PublicBookingPage.tsx, useCalendarSlots, useCalendarSettings, useCalendarRecurrence, useCalendarVacations, useCalendarNotifications, usePublicBooking, and Google Calendar Edge Functions implement the module.

TECHNICAL MECHANICS: useCalendarSlots reads calendar_slots by date range, view mode day/week/month/schedule, optional student_id, and showDeleted. It auto-marks past booked and confirmed slots as needs_review, prevents overlaps, deletes available slots when a lesson is booked into them, applies per-student default meeting links from calendar_student_settings, writes calendar_slot_logs, inserts calendar_notifications, invokes send-calendar-notification-email, and conditionally invokes gcal-sync. useCalendarSettings creates default settings with public_calendar_token if missing and stores booking mode, slot limits, public calendar flag, reminders, payment settings, Google Calendar options, timezone, display hours, reschedule rules, buffer minutes, and email notification flags. usePublicBooking resolves hub_token, public_calendar_token, or slug, shows available and pending slots, books by email, uses find_student_by_email RPC, writes booking status and notifications, emails teacher/student, invokes gcal-sync and student-gcal-sync, and polls/realtime-refreshes. Calendar export uses calendar-export-csv.

RAG KEYWORDS: teacher calendar, lesson booking, public booking, Google Calendar sync, Google Meet link, recurring lesson, booking confirmation, payment tracking, calendar slot, student reschedule, ESL scheduling, online English lesson, private tutor calendar

## Student Hub
STATUS: PRODUCTION

PROBLEM: Adult learners need a simple portal for lessons, homework, worksheets, flashcards, and self-profile without creating a full teacher account.

EDOOQOO SOLUTION: StudentHubLanding, StudentHubDashboard, StudentHubFlashcards, StudentHubHomework, StudentHubWorksheets, StudentHubLessons, StudentHubProfile, StudentHubSettings, StudentHubLayout, StudentHubStats, HubGoogleSignInButton, useStudentHubData, find-teachers-by-student-email, get-student-hub-data, get-student-self-profile, and update-student-self-profile implement the hub.

TECHNICAL MECHANICS: StudentHubLanding stores student_hub_email in localStorage for 30 days, finds teachers by student email through find-teachers-by-student-email, supports multiple teacher selection, optional password checks and verification through get-student-hub-data actions, and Google email resolution. useStudentHubData invokes get-student-hub-data with token and email and returns teacherName, teacherEmail, studentName, studentId, studentEmail, englishLevel, flashcardSets, homeworks, sharedWorksheets, upcomingLessons, and aggregate stats. StudentHubDashboard links into flashcard browse/study URLs with email and returnTo, homework share links, shared worksheet links, lesson booking, Google Calendar template creation, worksheet links attached to lessons, and Join buttons for meeting links.

RAG KEYWORDS: student hub, learner portal, student materials, homework dashboard, flashcard portal, shared worksheets, lesson portal, email access, hub token, adult learner portal, ESL student access, teacher token, self-profile

## Billing Tokens Subscriptions and Export Payments
STATUS: PRODUCTION

PROBLEM: A worksheet generator needs clear usage limits, paid plan management, rollover accounting, and export payment recovery without blocking legitimate teacher work.

EDOOQOO SOLUTION: useTokenSystem, usePlanLogic, useSubscriptionSync, Pricing.tsx, Profile.tsx, PaymentSuccess.tsx, PricingCalculator, ConfirmDowngradeDialog, FreeWeekBanner, create-subscription, stripe-webhook, check-subscription-status, customer-portal, downgrade-subscription, finalize-upgrade, verify-subscription-payment, repair-subscriptions, create-export-payment, verify-export-payment, and downloadSessionService implement billing.

TECHNICAL MECHANICS: useTokenSystem reads profiles fields including available_tokens, subscription_type, monthly_worksheet_limit, monthly_worksheets_used, is_tokens_frozen, rollover_tokens, and total_worksheets_created, then allows generation when tokens remain or monthly limit remains and tokens are not frozen. consumeToken calls consume_token RPC. usePlanLogic defines Free Demo 2, Side-Gig 15 at 9 USD, and Full-Time 30/60/90/120 at 19/39/59/79 USD, calculates upgrades, lower plan states, and recommendations by lessons per week. Pricing/Profile invoke create-subscription for checkout and customer-portal for management; lower plans call downgrade-subscription after ConfirmDowngradeDialog. Profile handles Stripe return through finalize-upgrade and check-subscription-status. Export payments write export_payments and download_sessions; PaymentSuccess verifies Stripe session and stores downloadToken in sessionStorage.

RAG KEYWORDS: billing, Stripe, worksheet tokens, subscription, Side-Gig plan, Full-Time plan, rollover tokens, export payment, download unlock, customer portal, downgrade plan, subscription status, token economy, ESL SaaS billing

## Public Gallery and Worksheet Publishing
STATUS: PRODUCTION

PROBLEM: Public examples help teachers inspect output quality without exposing private student work or interactive answer workflows.

EDOOQOO SOLUTION: PublicGalleryIndex.tsx, PublicGalleryWorksheetPage.tsx, GalleryExerciseRenderer, publish-worksheet, unpublish-worksheet, bulk-publish-worksheets, regenerate-gallery-sitemap, sitemap-xml, and worksheet public fields implement the gallery surface.

TECHNICAL MECHANICS: PublicGalleryIndex reads worksheets where is_public is true, selects id, public_slug, title, public_topic, public_level, public_exercise_types, published_at, and public_view_count, filters by public_level and topic, paginates 24 items, and emits ItemList JSON-LD. PublicGalleryWorksheetPage resolves public_slug, shows soft removal when is_public is false, parses ai_response for static exercise previews, emits LearningResource JSON-LD, and links visitors to signup for interactive generation. Publishing functions mutate worksheet public fields and gallery sitemap generation. Tables: worksheets. Public access is read-only; student answers, teacher edits, downloads, and AI review are not exposed in gallery preview.

RAG KEYWORDS: public worksheet gallery, ESL worksheet examples, free worksheet preview, CEFR filter, worksheet publishing, public_slug, LearningResource schema, static worksheet, gallery sitemap, teacher-published worksheet, public ESL materials

## SEO Content Static Resources and AI Discovery Assets
STATUS: PRODUCTION

PROBLEM: Teachers and AI agents need crawlable factual pages that explain capabilities and point back to the real product modules.

EDOOQOO SOLUTION: PageSeo, SEO_META, About, Blog, Prompts, Glossary, ExerciseTypes, HowItWorks, OneMinutePrep, Resources, seo pages, features pages, scripts/seo/generate-citable-pages.mjs, generate-ai-resources.mjs, build-blog-index.mjs, prerender-spa-routes.mjs, audit-seo-assets.mjs, public/llms.txt, public/llms-full.txt, public/llms-answers.txt, public/knowledge-graph.json, public/openapi.yaml, public/sitemap.xml, and public/.well-known/ai-plugin.json implement discovery.

TECHNICAL MECHANICS: App.tsx exposes SEO routes for /about, /prompts, /glossary, /exercise-types, /how-it-works, /one-minute-prep, /resources, /blog, /esl-worksheets, /for-english-tutors, /resources/esl-class-toolkit, /teach-english-online, /esl-games-for-teachers, /english-games-for-learners, /features/*, /tools/*, and programmatic worksheet/persona routes. package.json build:seo runs citable generation, blog index build, AI resource generation, Vite build, SPA prerendering, and SEO audit. The current audit overwrites docs/llm-context.md, public/llms.txt, and root llms.txt as the requested RAG source of truth.

RAG KEYWORDS: SEO, llms.txt, AI discovery, citable pages, sitemap, schema.org, FAQ JSON-LD, ESL content, programmatic SEO, teacher resources, search landing page, public route, AI agent documentation

## SEO and AI Visibility Retrieval Map
STATUS: PRODUCTION

PROBLEM: English teachers search by workflow pain, not by Edooqoo feature names.

EDOOQOO SOLUTION: Edooqoo maps lesson prep, material generation, homework review, vocabulary practice, student management, progress tracking, booking, and student access to canonical public URLs.

TECHNICAL MECHANICS: public/llms.txt, public/llms-full.txt, public/llms-answers.txt, public/knowledge-graph.json, public/openapi.yaml, public/sitemap.xml, scripts/seo/generate-citable-pages.mjs, scripts/seo/generate-ai-resources.mjs, scripts/seo/seo-route-manifest.mjs, and scripts/seo/audit-seo-assets.mjs expose the retrieval map. Each public page must include direct-answer text, visible mechanics, self-canonical URL, JSON-LD matching visible content, and internal links to its hub page. src/components/landing/HeroHeadline.tsx exposes the homepage canonical workflow links to /one-minute-prep, /ai-worksheet-generator-for-english-teachers.html, /esl-student-progress-tracking-tool.html, /ai-grading-tool-for-english-homework.html, and /vocabulary-exercise-generator.html. scripts/seo/generate-citable-pages.mjs generates citation-first static pages for worksheet generation, 1-Minute Prep, CEFR, Business English, grammar, vocabulary, homework review, editable worksheet output, tutor CRM, Student Hub, calendar booking, progress tracking, and adult Business English prep. scripts/seo/generate-ai-resources.mjs writes root llms.txt and public/llms.txt with production-only feature lines, search-intent clusters, docs/llm-context.md anchors, and canonical public URLs. scripts/seo/audit-seo-assets.mjs rejects BETA or ROADMAP entries in public/llms.txt, checks llm-context.md anchor resolution, validates citable-page sections, validates JSON-LD types, validates sitemap uniqueness, and rejects private app routes in public sitemap output.

RAG KEYWORDS: AI Overview citation, Perplexity citation, ChatGPT Browse, llms.txt, answer engine optimization, ESL worksheet generator, English tutor workflow, CEFR progress tracking, homework grading, private tutor CRM, AI lesson prep, citation-ready page

## Free Browser Tools
STATUS: PRODUCTION

PROBLEM: Teachers sometimes need quick standalone teaching utilities without logging into the full worksheet workflow.

EDOOQOO SOLUTION: ToolsIndex.tsx, LessonPlanGenerator.tsx, VocabCefrChecker.tsx, CefrLevelTest.tsx, PageSeo, and related tool routes implement the public tools.

TECHNICAL MECHANICS: LessonPlanGenerator runs locally in browser state, accepts topic, CEFR level, duration, learner goal, and learner persona, generates six timed stages, supports copying text and downloading HTML, and emits FAQ and HowTo JSON-LD. VocabCefrChecker and CefrLevelTest are separate route modules under src/pages/tools. Tools are linked from /tools and do not write Supabase rows in the audited code paths. They are public SEO utilities and not the same as the authenticated worksheet generation engine.

RAG KEYWORDS: ESL tools, lesson plan generator, CEFR checker, vocabulary level, free teaching tool, adult ESL lesson plan, browser utility, no signup tool, EFL tool, lesson stages, printable plan, teacher resource

## Admin Dashboard Error Logs and Bug Reports
STATUS: PRODUCTION

PROBLEM: The operator needs to diagnose account, subscription, generation, and UI problems without guessing from user reports.

EDOOQOO SOLUTION: AdminDashboardPage.tsx, AdminErrorLogsPage.tsx, submit-bug-report, submitFeedback, admin-impersonate, cleanup-anonymous-users, test-model-failure-logger, audit-llm-models, send-model-audit-email, and user_roles implement operational controls.

TECHNICAL MECHANICS: AdminDashboardPage checks user_roles for role admin, redirects non-admins to /dashboard, reads profiles, hides anonymous accounts from the teacher list, shows teacher counts, active subscriptions, total worksheets, total tokens, opens admin-impersonate URLs, and invokes cleanup-anonymous-users. AdminErrorLogsPage gates by admin role, reads error_logs and bug_reports, hydrates reporter profiles from profiles, creates signed URLs for bug-reports storage attachments, filters by severity/component/status/search, marks error_logs resolved, and updates bug report statuses new, triaged, in_progress, resolved, or wontfix with resolution notes. Tables: user_roles, profiles, error_logs, bug_reports, admin_activity_log.

RAG KEYWORDS: admin dashboard, error logs, bug report, teacher impersonation, user roles, support operations, system diagnostics, issue triage, Supabase storage signed URL, admin-only route, anonymous cleanup, production support

## Teacher Alerts and Closed Loop Monitoring
STATUS: BETA

PROBLEM: Teachers need actionable system signals when student engagement, pacing, quality, or token usage needs intervention.

EDOOQOO SOLUTION: TeacherAlertsPage.tsx, useTeacherAlerts, CalendarNotificationBell, teacher_alerts, closed_loop_signals, loop-pacing-aggregator, loop-student-engagement, loop-token-economy, loop-worksheet-quality, pacing-periodic-check, process-pending-ai-evaluations, notify-generation-failure, and system_health_metrics provide the monitoring layer.

TECHNICAL MECHANICS: useTeacherAlerts reads teacher_alerts for the authenticated teacher, excludes dismissed alerts, orders by created_at, polls every 60 seconds, and exposes unreadCount, markRead, dismiss, and markAllRead. TeacherAlertsPage displays severity low/medium/high, source_loop_id, CTA URL, created time, read state, and dismiss controls. Closed-loop Edge Functions are present in supabase/functions and write/read signals across teacher_alerts, closed_loop_signals, student_events, student_skill_metrics, pacing_proposals, system_health_metrics, token_transactions, and pending_worksheet_ai_evaluations. This is marked BETA because the user-facing alert inbox is wired, but background loop completeness depends on scheduled invocation configuration outside the React source.

RAG KEYWORDS: teacher alerts, closed loop, student engagement, pacing alert, worksheet quality, token economy, system signal, teacher notification, student risk, ESL analytics, learning analytics, background monitor, alert inbox

## Demo Mode
STATUS: PRODUCTION

PROBLEM: A prospective teacher needs to inspect the product before sign-up, while production data and paid actions must remain protected.

EDOOQOO SOLUTION: DemoEntry.tsx, ExitDemo.tsx, DemoContext, useDemoGuard, demo data modules, DashboardPreviewBackground, and demo-aware hooks such as useAuthFlow, useStudents, useWorksheetHistory, useDeletedWorksheets, useFlashcardSets, useProfile, useCalendarSettings, useCalendarSlots, useTeacherAlerts, and useTokenSystem implement read-only demonstration paths.

TECHNICAL MECHANICS: Demo mode supplies synthetic teacher/profile/student/worksheet/flashcard data, returns early from Supabase reads in demo-aware hooks, blocks mutating actions with showDemoBlockedToast, and allows some read-only modal previews. /demo enters demo mode and /exit-demo exits. The Vite build isolates demoWorksheetContent, mockWorksheetData, and mockNewExercisesData into demo-content and mock-data chunks so demo assets are separated from the main bundle. Demo mode is not a production data source and does not create database rows.

RAG KEYWORDS: demo mode, product preview, read-only demo, mock worksheet, sample student, no signup preview, ESL SaaS demo, blocked action, synthetic data, dashboard preview, anonymous trial, teacher demo

## Data Model and Supabase Schema
STATUS: PRODUCTION

PROBLEM: Future agents need table-level field names and relationship cues before changing any feature that persists teaching or learner data.

EDOOQOO SOLUTION: src/integrations/supabase/types.ts is the generated typed source for table fields and relationships; supabase/migrations contains SQL for tables, indexes, policies, RPCs, and operational changes. This section maps every typed table found in the codebase.

TECHNICAL MECHANICS: Typed table count: 56. Frontend table calls recorded: 37. Edge Function table calls recorded: 50. Migration indexes recorded: 8. Migration RPC/function definitions recorded: 4. Table field catalog:
- admin_activity_log: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- app_internal_config: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- bug_reports: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_gcal_tokens: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_notifications: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_payment_records: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_recurrence_rules: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_settings: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_slot_logs: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_slots: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_student_settings: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- calendar_teacher_vacations: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- closed_loop_signals: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- download_sessions: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- dslm_curriculum_phases: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- email_send_log: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- error_logs: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- export_payments: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- feedbacks: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- flashcard_cards: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- flashcard_progress: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- flashcard_sets: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- future_worksheet_suggestions: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- geolocation_cache: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- homework_assignments: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- homework_notifications: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- homework_student_answers: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- homework_teacher_comments: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- homework_teacher_corrections: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- model_health_checks: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- pacing_proposals: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- pending_worksheet_ai_evaluations: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- processed_upgrade_sessions: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- profiles: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- student_events: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_gcal_tokens: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_knowledge_entries: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_learning_elements: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_learning_profiles: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_progress_goals: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_skill_metrics: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_test_questions: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- student_tests: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- students: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- subscription_events: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- subscriptions: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- system_health_metrics: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- teacher_ai_eval_feedback: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- teacher_alerts: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- test_skill_results: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- token_transactions: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- user_events: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- user_roles: fields: . Relationships: no generated foreign-key relationship listed in types.ts.
- worksheet_drawings: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- worksheet_student_answers: fields: foreignKeyName, columns, isOneToOne, referencedRelation, referencedColumns. Relationships: no generated foreign-key relationship listed in types.ts.
- worksheets: fields: . Relationships: no generated foreign-key relationship listed in types.ts.

Index catalog from migrations:
- idx_email_send_log_recipient_template: supabase/migrations/20260505064801_45a8e80c-6a10-4530-9c60-06c0e31371cf.sql
- idx_mhc_recent: supabase/migrations/20260527053649_4e525edd-877a-497e-8a53-710465c11cc3.sql
- idx_ske_archived_at: supabase/migrations/20260506081856_5f5e0e5d-baaa-44b7-b197-35340563d261.sql
- idx_ske_used_in_worksheet: supabase/migrations/20260506081856_5f5e0e5d-baaa-44b7-b197-35340563d261.sql
- idx_worksheets_public: supabase/migrations/20260519195659_1d0dda8d-dc80-427b-9c7b-9c562e694f90.sql
- idx_worksheets_public_slug: supabase/migrations/20260519195659_1d0dda8d-dc80-427b-9c7b-9c562e694f90.sql
- idx_worksheets_public_topic: supabase/migrations/20260519195659_1d0dda8d-dc80-427b-9c7b-9c562e694f90.sql
- uq_one_active_welcome_attempt: supabase/migrations/20260526063012_1afc9ce1-e369-4341-acfb-7c1b60e6e5d9.sql

RAG KEYWORDS: Supabase schema, database tables, RLS, foreign keys, typed Database, Postgres, ESL app data model, worksheet table, student table, homework table, flashcard table, calendar table, billing table, migration index

## Edge Functions APIs and RPC Calls
STATUS: PRODUCTION

PROBLEM: Future agents need to know which endpoints exist and which features depend on them before changing API names, payloads, or response expectations.

EDOOQOO SOLUTION: supabase/functions contains Edge Functions for worksheet generation, media, DSLM, tests, homework, flashcards, calendar, billing, public SEO, admin, alerts, tracking, and maintenance. Frontend invokes use supabase.functions.invoke or direct /functions/v1/generateWorksheet streaming; RPCs are called through supabase.rpc.

TECHNICAL MECHANICS: Endpoint count: 77. Edge Functions are HTTP Supabase Functions; browser invocations through supabase.functions.invoke are POST requests with JSON bodies unless the function handles callbacks/webhooks or the streaming service posts directly. generateWorksheet is called by worksheetStreamService with a streaming POST body including form fields, userId, and enableStreaming true, returning SSE events. API endpoint catalog:
- add-rls-policies: Edge Function endpoint in supabase/functions/add-rls-policies; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- add-tokens: Edge Function endpoint in supabase/functions/add-tokens; frontend callers: src/pages/Auth.tsx.
- admin-impersonate: Edge Function endpoint in supabase/functions/admin-impersonate; frontend callers: src/pages/AdminDashboardPage.tsx.
- audit-llm-models: Edge Function endpoint in supabase/functions/audit-llm-models; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- backfill-welcome-test-auto-apply: Edge Function endpoint in supabase/functions/backfill-welcome-test-auto-apply; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- bulk-publish-worksheets: Edge Function endpoint in supabase/functions/bulk-publish-worksheets; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- calendar-export-csv: Edge Function endpoint in supabase/functions/calendar-export-csv; frontend callers: src/pages/CalendarPage.tsx, src/pages/CalendarSettingsPage.tsx.
- calendar-handle-reschedule-decision: Edge Function endpoint in supabase/functions/calendar-handle-reschedule-decision; frontend callers: src/components/calendar/SlotDetailModal.tsx.
- check-subscription-status: Edge Function endpoint in supabase/functions/check-subscription-status; frontend callers: src/hooks/useProfile.tsx, src/hooks/useSubscriptionSync.tsx, src/hooks/useWorksheetGeneration.tsx, src/pages/Pricing.tsx, src/pages/Profile.tsx.
- claim-anonymous-worksheets: Edge Function endpoint in supabase/functions/claim-anonymous-worksheets; frontend callers: src/hooks/useWorksheetClaim.ts.
- classify-knowledge-entry: Edge Function endpoint in supabase/functions/classify-knowledge-entry; frontend callers: src/hooks/useStudentKnowledge.tsx.
- cleanup-anonymous-users: Edge Function endpoint in supabase/functions/cleanup-anonymous-users; frontend callers: src/pages/AdminDashboardPage.tsx.
- create-export-payment: Edge Function endpoint in supabase/functions/create-export-payment; frontend callers: src/components/PaymentPopup.tsx.
- create-subscription: Edge Function endpoint in supabase/functions/create-subscription; frontend callers: src/components/worksheet/FormView.tsx, src/pages/Auth.tsx, src/pages/Pricing.tsx, src/pages/Profile.tsx.
- customer-portal: Edge Function endpoint in supabase/functions/customer-portal; frontend callers: src/pages/Pricing.tsx, src/pages/Profile.tsx.
- delete-account: Edge Function endpoint in supabase/functions/delete-account; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- downgrade-subscription: Edge Function endpoint in supabase/functions/downgrade-subscription; frontend callers: src/pages/Pricing.tsx, src/pages/Profile.tsx.
- fetch-media: Edge Function endpoint in supabase/functions/fetch-media; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- finalize-upgrade: Edge Function endpoint in supabase/functions/finalize-upgrade; frontend callers: src/pages/Profile.tsx.
- find-teachers-by-student-email: Edge Function endpoint in supabase/functions/find-teachers-by-student-email; frontend callers: src/pages/BookLandingPage.tsx, src/pages/StudentHubLanding.tsx.
- format-worksheet-prompt: Edge Function endpoint in supabase/functions/format-worksheet-prompt; frontend callers: src/utils/promptFormatter.ts.
- gcal-auth-callback: Edge Function endpoint in supabase/functions/gcal-auth-callback; frontend callers: src/pages/CalendarSettingsPage.tsx.
- gcal-auth-start: Edge Function endpoint in supabase/functions/gcal-auth-start; frontend callers: src/pages/CalendarSettingsPage.tsx.
- gcal-sync: Edge Function endpoint in supabase/functions/gcal-sync; frontend callers: src/components/calendar/RecurringBookingModal.tsx, src/components/calendar/SlotDetailModal.tsx, src/hooks/useCalendarSlots.tsx, src/hooks/usePublicBooking.tsx, src/hooks/useStudents.tsx, src/pages/CalendarPage.tsx, src/pages/CalendarSettingsPage.tsx, src/pages/StudentPage.tsx.
- generate-audio: Edge Function endpoint in supabase/functions/generate-audio; frontend callers: src/services/mediaService.ts.
- generate-curriculum-phases: Edge Function endpoint in supabase/functions/generate-curriculum-phases; frontend callers: src/hooks/dslm/useCurriculumPhases.tsx.
- generate-image: Edge Function endpoint in supabase/functions/generate-image; frontend callers: src/services/mediaService.ts.
- generate-media-exercises: Edge Function endpoint in supabase/functions/generate-media-exercises; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- generate-timeline: Edge Function endpoint in supabase/functions/generate-timeline; frontend callers: src/hooks/useFutureTimeline.tsx.
- generate-welcome-test-audio: Edge Function endpoint in supabase/functions/generate-welcome-test-audio; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- generateWorksheet: Edge Function endpoint in supabase/functions/generateWorksheet; frontend callers: src/components/worksheet/AddExerciseModal.tsx, src/hooks/useHomeworkExerciseGeneration.tsx, src/services/exerciseRegenerationService.ts, src/services/worksheetService/apiService.ts, src/services/worksheetStreamService.ts.
- get-demo-locale: Edge Function endpoint in supabase/functions/get-demo-locale; frontend callers: src/pages/DemoEntry.tsx.
- get-student-bookings: Edge Function endpoint in supabase/functions/get-student-bookings; frontend callers: src/components/calendar/StudentBookingsSection.tsx, src/pages/StudentHubLessons.tsx.
- get-student-hub-data: Edge Function endpoint in supabase/functions/get-student-hub-data; frontend callers: src/hooks/useStudentHubData.tsx, src/pages/StudentHubLanding.tsx, src/pages/StudentHubSettings.tsx.
- get-student-self-profile: Edge Function endpoint in supabase/functions/get-student-self-profile; frontend callers: src/pages/StudentHubProfile.tsx.
- loop-pacing-aggregator: Edge Function endpoint in supabase/functions/loop-pacing-aggregator; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- loop-student-engagement: Edge Function endpoint in supabase/functions/loop-student-engagement; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- loop-token-economy: Edge Function endpoint in supabase/functions/loop-token-economy; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- loop-worksheet-quality: Edge Function endpoint in supabase/functions/loop-worksheet-quality; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- notify-generation-failure: Edge Function endpoint in supabase/functions/notify-generation-failure; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- pacing-periodic-check: Edge Function endpoint in supabase/functions/pacing-periodic-check; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- process-pending-ai-evaluations: Edge Function endpoint in supabase/functions/process-pending-ai-evaluations; frontend callers: src/components/WorksheetDisplay.tsx, src/hooks/useInteractiveSharedWorksheet.tsx, src/hooks/useLiveSessionAnswers.tsx.
- process-welcome-test: Edge Function endpoint in supabase/functions/process-welcome-test; frontend callers: src/hooks/useWelcomeTest.tsx.
- publish-worksheet: Edge Function endpoint in supabase/functions/publish-worksheet; frontend callers: src/components/worksheet/PublishWorksheetButton.tsx.
- recalculate-pacing: Edge Function endpoint in supabase/functions/recalculate-pacing; frontend callers: src/components/dslm/PacingModeSlider.tsx, src/hooks/useStudentProgress.tsx, src/hooks/useStudents.tsx.
- regenerate-gallery-sitemap: Edge Function endpoint in supabase/functions/regenerate-gallery-sitemap; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- repair-subscriptions: Edge Function endpoint in supabase/functions/repair-subscriptions; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- send-calendar-notification-email: Edge Function endpoint in supabase/functions/send-calendar-notification-email; frontend callers: src/components/calendar/RecurringBookingModal.tsx, src/components/calendar/SlotDetailModal.tsx, src/hooks/useCalendarSlots.tsx, src/hooks/usePublicBooking.tsx.
- send-flashcard-email: Edge Function endpoint in supabase/functions/send-flashcard-email; frontend callers: src/components/flashcards/ShareAllFlashcardSetsModal.tsx, src/components/flashcards/ShareFlashcardSetModal.tsx.
- send-homework-email: Edge Function endpoint in supabase/functions/send-homework-email; frontend callers: src/components/homework/CreateHomeworkModal.tsx, src/components/homework/SendHomeworkEmailDialog.tsx.
- send-homework-reminders: Edge Function endpoint in supabase/functions/send-homework-reminders; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- send-model-audit-email: Edge Function endpoint in supabase/functions/send-model-audit-email; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- send-test-email: Edge Function endpoint in supabase/functions/send-test-email; frontend callers: src/components/dashboard/WelcomeTestSuggestion.tsx, src/components/student-tests/ShareTestModal.tsx, src/components/student-tests/StudentTestsTab.tsx, src/hooks/useWelcomeTestActions.ts.
- send-welcome-email: Edge Function endpoint in supabase/functions/send-welcome-email; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- send-welcome-test-completion-email: Edge Function endpoint in supabase/functions/send-welcome-test-completion-email; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- send-worksheet-email: Edge Function endpoint in supabase/functions/send-worksheet-email; frontend callers: src/components/ShareWorksheetModal.tsx.
- sitemap-xml: Edge Function endpoint in supabase/functions/sitemap-xml; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- stripe-webhook: Edge Function endpoint in supabase/functions/stripe-webhook; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- student-gcal-auth-callback: Edge Function endpoint in supabase/functions/student-gcal-auth-callback; frontend callers: src/pages/GCalStudentCallback.tsx.
- student-gcal-auth-start: Edge Function endpoint in supabase/functions/student-gcal-auth-start; frontend callers: src/pages/StudentHubSettings.tsx.
- student-gcal-sync: Edge Function endpoint in supabase/functions/student-gcal-sync; frontend callers: src/components/calendar/RecurringBookingModal.tsx, src/components/calendar/SlotDetailModal.tsx, src/hooks/usePublicBooking.tsx, src/pages/CalendarPage.tsx.
- submit-bug-report: Edge Function endpoint in supabase/functions/submit-bug-report; frontend callers: src/components/bug-report/BugReportModal.tsx.
- submitFeedback: Edge Function endpoint in supabase/functions/submitFeedback; frontend callers: src/services/worksheetService/feedbackService.ts.
- suggest-exercises: Edge Function endpoint in supabase/functions/suggest-exercises; frontend callers: src/components/WorksheetForm/index.tsx.
- test-model-failure-logger: Edge Function endpoint in supabase/functions/test-model-failure-logger; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- test-send-reminder: Edge Function endpoint in supabase/functions/test-send-reminder; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- test-webhook: Edge Function endpoint in supabase/functions/test-webhook; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- track-student-event: Edge Function endpoint in supabase/functions/track-student-event; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- track-user-event: Edge Function endpoint in supabase/functions/track-user-event; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.
- transcribe-audio: Edge Function endpoint in supabase/functions/transcribe-audio; frontend callers: src/utils/audioEvalUtils.ts.
- translate-flashcard: Edge Function endpoint in supabase/functions/translate-flashcard; frontend callers: src/components/flashcards/ImportFromVocabularyModal.tsx, src/components/flashcards/QuickAddWordToFlashcardsModal.tsx, src/components/flashcards/QuickImportToFlashcardsModal.tsx, src/hooks/useFlashcardDefinition.tsx, src/hooks/useFlashcardTranslation.tsx.
- unpublish-worksheet: Edge Function endpoint in supabase/functions/unpublish-worksheet; frontend callers: src/components/worksheet/PublishWorksheetButton.tsx.
- update-student-self-profile: Edge Function endpoint in supabase/functions/update-student-self-profile; frontend callers: src/pages/StudentHubProfile.tsx.
- upload-to-r2: Edge Function endpoint in supabase/functions/upload-to-r2; frontend callers: src/components/welcome-test/SpeakingRecorder.tsx.
- verify-export-payment: Edge Function endpoint in supabase/functions/verify-export-payment; frontend callers: src/pages/PaymentSuccess.tsx.
- verify-open-answers: Edge Function endpoint in supabase/functions/verify-open-answers; frontend callers: src/components/worksheet/ExerciseSection.tsx, src/hooks/useInteractiveHomework.tsx.
- verify-subscription-payment: Edge Function endpoint in supabase/functions/verify-subscription-payment; frontend callers: none found in src; may be webhook, cron, admin, or server-to-server.

RPC call catalog:
- add_student_event: called from src/components/worksheet/ExerciseSection.tsx, src/hooks/dslm/useStudentEvents.tsx, src/hooks/useInteractiveHomework.tsx, src/hooks/useWelcomeTest.tsx, supabase/functions/track-student-event/index.ts.
- add_tokens: called from supabase/functions/add-tokens/index.ts, supabase/functions/stripe-webhook/index.ts, supabase/functions/verify-subscription-payment/index.ts.
- calculate_test_results: called from src/hooks/useStudentTests.tsx, src/hooks/useWelcomeTest.tsx, supabase/functions/process-welcome-test/index.ts.
- consume_token: called from src/hooks/useTokenSystem.tsx.
- exec_sql: called from supabase/functions/add-rls-policies/index.ts.
- find_student_by_email: called from src/hooks/usePublicBooking.tsx.
- generate_flashcard_share_token: called from src/hooks/useFlashcardSets.tsx.
- generate_homework_share_token: called from src/components/homework/CreateHomeworkModal.tsx.
- generate_public_slug: called from supabase/functions/bulk-publish-worksheets/index.ts, supabase/functions/publish-worksheet/index.ts.
- generate_test_share_token: called from src/hooks/useStudentTests.tsx.
- generate_worksheet_share_token: called from src/components/ShareWorksheetModal.tsx.
- get_active_model_issues: called from src/pages/StatusPage.tsx.
- get_flashcard_cards_for_learning: called from src/hooks/useFlashcardLearning.tsx.
- get_flashcard_set_by_share_token: called from src/pages/FlashcardsLearning.tsx.
- get_homework_by_share_token: called from src/pages/HomeworkPage.tsx.
- get_homework_comments: called from src/pages/HomeworkReviewPage.tsx.
- get_public_status: called from src/pages/StatusPage.tsx.
- get_student_homework_answers: called from src/hooks/useInteractiveHomework.tsx.
- get_student_meeting_link: called from src/hooks/usePublicBooking.tsx.
- get_student_tags: called from src/hooks/useStudentKnowledge.tsx.
- get_test_by_share_token: called from src/hooks/useStudentTests.tsx, src/hooks/useWelcomeTest.tsx.
- get_test_status_by_share_token: called from src/pages/WelcomeTestPage.tsx.
- get_worksheet_by_share_token: called from src/pages/SharedWorksheet.tsx.
- get_worksheet_live_answers: called from src/hooks/useLiveSessionAnswers.tsx.
- get_worksheet_student_answers: called from src/hooks/useInteractiveSharedWorksheet.tsx.
- increment_worksheet_download_count: called from src/services/worksheetService/trackingService.ts.
- insert_homework_submission_notification: called from src/hooks/useInteractiveHomework.tsx.
- mark_homework_completed: called from src/components/dashboard/WorksheetHomeworkList.tsx, src/components/student-homework/StudentHomeworkTab.tsx, src/pages/HomeworkPage.tsx.
- mark_knowledge_current: called from src/hooks/useStudentKnowledge.tsx.
- mark_knowledge_outdated: called from src/hooks/useStudentKnowledge.tsx.
- needs_ai_evaluation: called from src/hooks/useInteractiveSharedWorksheet.tsx, supabase/functions/process-pending-ai-evaluations/index.ts.
- queue_worksheet_ai_evaluation: called from src/hooks/useInteractiveSharedWorksheet.tsx.
- save_homework_answer: called from src/hooks/useInteractiveHomework.tsx.
- save_teacher_comment: called from src/pages/HomeworkReviewPage.tsx.
- save_worksheet_answer: called from src/hooks/useInteractiveSharedWorksheet.tsx.
- soft_delete_flashcard_set: called from src/hooks/useFlashcardSets.tsx.
- soft_delete_knowledge_entry: called from src/hooks/useStudentKnowledge.tsx.
- soft_delete_student: called from src/hooks/useStudents.tsx.
- soft_delete_user_account: called from supabase/functions/delete-account/index.ts.
- soft_delete_worksheet: called from src/hooks/useWorksheetHistory.tsx.
- submit_homework_answers: called from src/hooks/useInteractiveHomework.tsx.
- track_user_event: called from supabase/functions/track-user-event/index.ts, supabase/functions/verify-export-payment/index.ts.
- verify_homework_student_email: called from src/hooks/useInteractiveHomework.tsx.
- verify_worksheet_student_email: called from src/hooks/useInteractiveSharedWorksheet.tsx.

RAG KEYWORDS: Supabase Edge Function, API endpoint, RPC, generateWorksheet, webhook, serverless function, ESL SaaS backend, function payload, response shape, database RPC, API audit, function catalog

## Integrations and External Services
STATUS: PRODUCTION

PROBLEM: A teacher-facing SaaS fails if external dependencies are invisible, because generation, payment, email, media, calendar, and storage behavior become hard to debug.

EDOOQOO SOLUTION: Supabase is the database/auth/storage/function layer; Lovable AI Gateway model calls appear in generation and analysis functions; Stripe powers subscriptions/export payments; Resend-style email functions send student and teacher emails; Google Calendar and Google OAuth support calendar sync; upload-to-r2 and fetch-media support media; React Query, React Router, Tailwind, Radix, Shadcn, lucide-react, date-fns, fabric, html2pdf.js, and react-helmet-async support the frontend.

TECHNICAL MECHANICS: Supabase URL and anon key are hardcoded in src/integrations/supabase/client.ts. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are used by worksheetStreamService for the streaming function call. Stripe Edge Functions include create-subscription, stripe-webhook, customer-portal, downgrade-subscription, finalize-upgrade, verify-subscription-payment, create-export-payment, and verify-export-payment. Calendar integration functions include gcal-auth-start, gcal-auth-callback, gcal-sync, student-gcal-auth-start, student-gcal-auth-callback, and student-gcal-sync. Email functions include send-homework-email, send-flashcard-email, send-calendar-notification-email, send-welcome-email, send-welcome-test-completion-email, send-test-email, send-worksheet-email, send-homework-reminders, send-model-audit-email, and notify-generation-failure.

RAG KEYWORDS: Supabase integration, Stripe integration, Google Calendar, Google OAuth, email service, Resend, Lovable AI Gateway, AI model, R2 storage, media upload, React Query, Tailwind, Radix UI, SaaS integration

## Frontend Component Inventory
STATUS: PRODUCTION

PROBLEM: Future agents need a component map before changing UI behavior, because many workflows share worksheet, student, calendar, and homework primitives.

EDOOQOO SOLUTION: Components are grouped by folder and feature area; detailed props and state are defined in the individual TypeScript modules, while this inventory tells agents where each module belongs before opening the source.

TECHNICAL MECHANICS: Component file count: 332. Component groups:
- Worksheet Display (61): src/components/worksheet/AddExerciseModal.tsx, src/components/worksheet/AudioPlayer.tsx, src/components/worksheet/DemoWatermark.tsx, src/components/worksheet/DraftTeacherNotes.tsx, src/components/worksheet/ExerciseAnswerQuestions.tsx, src/components/worksheet/ExerciseAnswerQuestionsAudio.tsx, src/components/worksheet/ExerciseCategorize.tsx, src/components/worksheet/ExerciseCompleteWord.tsx, src/components/worksheet/ExerciseContent.tsx, src/components/worksheet/ExerciseDescribe.tsx, src/components/worksheet/ExerciseDialogue.tsx, src/components/worksheet/ExerciseErrorCorrection.tsx, src/components/worksheet/ExerciseFillInBlanks.tsx, src/components/worksheet/ExerciseFillInBlanksAudio.tsx, src/components/worksheet/ExerciseGapText.tsx, src/components/worksheet/ExerciseHeader.tsx, src/components/worksheet/ExerciseListeningComprehension.tsx, src/components/worksheet/ExerciseMatching.tsx, src/components/worksheet/ExerciseMatchingHalves.tsx, src/components/worksheet/ExerciseMultipleChoice.tsx, src/components/worksheet/ExerciseMultipleChoiceAudio.tsx, src/components/worksheet/ExerciseNavSidebar.tsx, src/components/worksheet/ExerciseNegativePrefixes.tsx, src/components/worksheet/ExerciseOddOneOut.tsx, src/components/worksheet/ExerciseParaphrasing.tsx, src/components/worksheet/ExerciseReading.tsx, src/components/worksheet/ExerciseRegenerateModal.tsx, src/components/worksheet/ExerciseSection.tsx, src/components/worksheet/ExerciseSectionUtils.tsx, src/components/worksheet/ExerciseSentenceTransformation.tsx, src/components/worksheet/ExerciseSynonymsAntonyms.tsx, src/components/worksheet/ExerciseTrueFalseAudio.tsx, src/components/worksheet/ExerciseWordOrder.tsx, src/components/worksheet/ExerciseWritingTask.tsx, src/components/worksheet/FeedbackDialog.tsx, src/components/worksheet/FormView.tsx, src/components/worksheet/GenerationView.tsx, src/components/worksheet/GrammarRules.tsx, src/components/worksheet/InputParamsCard.tsx, src/components/worksheet/LiveAudioPlayer.tsx, src/components/worksheet/LiveSessionQuickNotes.tsx, src/components/worksheet/MediaBadges.tsx, src/components/worksheet/MediaDisplay.tsx, src/components/worksheet/MediaSection.tsx, src/components/worksheet/NanoSkillBadge.tsx, src/components/worksheet/NanoSkillMasteryModal.tsx, src/components/worksheet/PublishWorksheetButton.tsx, src/components/worksheet/RatingButtons.tsx, src/components/worksheet/RatingSection.tsx, src/components/worksheet/SectionRegenerateModal.tsx, src/components/worksheet/SelectWordMode.tsx, src/components/worksheet/TeacherNotes.tsx, src/components/worksheet/TeacherTipSection.tsx, src/components/worksheet/VocabularySheet.tsx, src/components/worksheet/WarmupSection.tsx, src/components/worksheet/WorksheetContainer.tsx, src/components/worksheet/WorksheetContent.tsx, src/components/worksheet/WorksheetHeader.tsx, src/components/worksheet/WorksheetHomeworkSection.tsx, src/components/worksheet/WorksheetToolbar.tsx, src/components/worksheet/WorksheetViewTracking.tsx
- Worksheet Form (14): src/components/WorksheetForm/AdvancedOptions.tsx, src/components/WorksheetForm/EnglishLevelSelector.tsx, src/components/WorksheetForm/ExerciseSelector.tsx, src/components/WorksheetForm/FormField.tsx, src/components/WorksheetForm/LanguageStyleSlider.tsx, src/components/WorksheetForm/NextStepsPresetBanner.tsx, src/components/WorksheetForm/StudentContextHint.tsx, src/components/WorksheetForm/TrackingFormWrapper.tsx, src/components/WorksheetForm/TypewriterHint.tsx, src/components/WorksheetForm/constants.ts, src/components/WorksheetForm/index.tsx, src/components/WorksheetForm/placeholderSets.ts, src/components/WorksheetForm/suggestionSets.ts, src/components/WorksheetForm/types.ts
- DSLM (29): src/components/dslm/BehavioralStatsCard.tsx, src/components/dslm/CollapsibleSection.tsx, src/components/dslm/CompactSuggestionCard.tsx, src/components/dslm/ConfidenceBadge.tsx, src/components/dslm/ConfirmDeleteDialog.tsx, src/components/dslm/ConfirmTypeToDeleteDialog.tsx, src/components/dslm/DSLMTab.tsx, src/components/dslm/EditExerciseSelector.tsx, src/components/dslm/EventLogPanel.tsx, src/components/dslm/GenerateStepsDialog.tsx, src/components/dslm/GoalsView.tsx, src/components/dslm/LazySection.tsx, src/components/dslm/LearningTimeline.tsx, src/components/dslm/MacroTimeline.tsx, src/components/dslm/MasterySparkline.tsx, src/components/dslm/NextStepBanner.tsx, src/components/dslm/NextStepsSection.tsx, src/components/dslm/PacingModeSlider.tsx, src/components/dslm/PacingProposalCard.tsx, src/components/dslm/PacingProposalsBell.tsx, src/components/dslm/PathwayView.tsx, src/components/dslm/ProfileView.tsx, src/components/dslm/ScrollableStepList.tsx, src/components/dslm/SectionSkeleton.tsx, src/components/dslm/SkillsOverviewPanel.tsx, src/components/dslm/SkillsView.tsx, src/components/dslm/StudentNavBadges.tsx, src/components/dslm/StudentPathwayBadges.tsx, src/components/dslm/SuggestionEditDialog.tsx
- Dashboard (8): src/components/dashboard/AddStudentButton.tsx, src/components/dashboard/AddStudentDialog.tsx, src/components/dashboard/CompactStatsBar.tsx, src/components/dashboard/HomeworkOverviewWidget.tsx, src/components/dashboard/StudentCard.tsx, src/components/dashboard/StudentPaymentMeetingCard.tsx, src/components/dashboard/WelcomeTestSuggestion.tsx, src/components/dashboard/WorksheetHomeworkList.tsx
- Homework (11): src/components/homework/AiEvalFeedbackButtons.tsx, src/components/homework/AiEvalFeedbackModal.tsx, src/components/homework/AiEvaluationBadge.tsx, src/components/homework/CreateHomeworkModal.tsx, src/components/homework/HomeworkExerciseRenderer.tsx, src/components/homework/HomeworkNotificationBadge.tsx, src/components/homework/HomeworkProgressBar.tsx, src/components/homework/HomeworkSpeakingRecorder.tsx, src/components/homework/InteractiveExerciseWrapper.tsx, src/components/homework/SendHomeworkEmailDialog.tsx, src/components/homework/StudentEmailVerification.tsx
- Flashcards (16): src/components/flashcards/AddFlashcardModal.tsx, src/components/flashcards/CreateFlashcardSetModal.tsx, src/components/flashcards/DeleteFlashcardSetModal.tsx, src/components/flashcards/FlashcardDisplay.tsx, src/components/flashcards/FlashcardFABs.tsx, src/components/flashcards/FlashcardSetCard.tsx, src/components/flashcards/FlashcardSetEditor.tsx, src/components/flashcards/FlashcardSetsSection.tsx, src/components/flashcards/ImportFromVocabularyModal.tsx, src/components/flashcards/LearningProgress.tsx, src/components/flashcards/QuickAddWordToFlashcardsModal.tsx, src/components/flashcards/QuickImportToFlashcardsModal.tsx, src/components/flashcards/SessionSummary.tsx, src/components/flashcards/ShareAllFlashcardSetsModal.tsx, src/components/flashcards/ShareFlashcardSetModal.tsx, src/components/flashcards/ViewFlashcardSetsModal.tsx
- Calendar (16): src/components/calendar/CalendarDayView.tsx, src/components/calendar/CalendarLogHistoryPage.tsx, src/components/calendar/CalendarMonthView.tsx, src/components/calendar/CalendarNotificationBell.tsx, src/components/calendar/CalendarScheduleView.tsx, src/components/calendar/CalendarSlotCard.tsx, src/components/calendar/CalendarToolbar.tsx, src/components/calendar/CalendarWeekView.tsx, src/components/calendar/GCalStatusButton.tsx, src/components/calendar/LinkWorksheetModal.tsx, src/components/calendar/PaymentHistoryModal.tsx, src/components/calendar/RecurringBookingModal.tsx, src/components/calendar/SlotDetailModal.tsx, src/components/calendar/StudentBookingsSection.tsx, src/components/calendar/StudentCalendarTab.tsx, src/components/calendar/UnifiedSlotModal.tsx
- Student Hub (3): src/components/student-hub/HubGoogleSignInButton.tsx, src/components/student-hub/StudentHubLayout.tsx, src/components/student-hub/StudentHubStats.tsx
- Welcome Test (9): src/components/welcome-test/BrainResetGame.tsx, src/components/welcome-test/BrainResetGames.tsx, src/components/welcome-test/BrainResetReactionGame.tsx, src/components/welcome-test/BrainResetSequenceGame.tsx, src/components/welcome-test/InstructionScreen.tsx, src/components/welcome-test/ListeningPlayer.tsx, src/components/welcome-test/SpeakingRecorder.tsx, src/components/welcome-test/WelcomeTestActionsPanel.tsx, src/components/welcome-test/WelcomeTestComparisonView.tsx
- Student Knowledge (12): src/components/student-knowledge/OneMinutePrepCard.tsx, src/components/student-knowledge/StudentKnowledgeEditDialog.tsx, src/components/student-knowledge/StudentKnowledgeEntryCard.tsx, src/components/student-knowledge/StudentKnowledgeFAB.tsx, src/components/student-knowledge/StudentKnowledgeFilterBar.tsx, src/components/student-knowledge/StudentKnowledgeFloatingPanel.tsx, src/components/student-knowledge/StudentKnowledgeLessonIdeasButton.tsx, src/components/student-knowledge/StudentKnowledgeMiniList.tsx, src/components/student-knowledge/StudentKnowledgeQuickAddModal.tsx, src/components/student-knowledge/StudentKnowledgeSection.tsx, src/components/student-knowledge/StudentKnowledgeSidePanel.tsx, src/components/student-knowledge/StudentKnowledgeToggleButton.tsx
- Landing (15): src/components/landing/EcosystemSection.tsx, src/components/landing/FeatureNavPills.tsx, src/components/landing/FinalCTA.tsx, src/components/landing/HeroHeadline.tsx, src/components/landing/NavStudentSwitcher.tsx, src/components/landing/OneMinutePrepHeroProofSwitcher.tsx, src/components/landing/OneMinutePrepProofSection.tsx, src/components/landing/ParticlesBackground.tsx, src/components/landing/PricingTeaser.tsx, src/components/landing/SignupPromptDialog.tsx, src/components/landing/StartOneMinutePrepDialog.tsx, src/components/landing/StatsBar.tsx, src/components/landing/StickyNav.tsx, src/components/landing/TestimonialsRow.tsx, src/components/landing/ValueCards.tsx
- SEO (3): src/components/seo/PageSeo.tsx, src/components/seo/ProgrammaticSeoLayout.tsx, src/components/seo/SeoLandingLayout.tsx
- Feature Marketing (9): src/components/features/DSLMBadge.tsx, src/components/features/FeatureBenefits.tsx, src/components/features/FeatureCTA.tsx, src/components/features/FeatureComparisonTable.tsx, src/components/features/FeatureFAQ.tsx, src/components/features/FeatureHero.tsx, src/components/features/FeaturePageLayout.tsx, src/components/features/FeatureSteps.tsx, src/components/features/RelatedFeatures.tsx
- Shared Worksheet (5): src/components/shared/DeadlinePicker.tsx, src/components/shared/SharedWorksheetContent.tsx, src/components/shared/SharedWorksheetEmailVerification.tsx, src/components/shared/SharedWorksheetProgressBar.tsx, src/components/shared/StudyModeButton.tsx
- Drawing (7): src/components/drawing/DrawingColorPicker.tsx, src/components/drawing/DrawingOverlay.tsx, src/components/drawing/DrawingStrokeWidth.tsx, src/components/drawing/DrawingToggleButton.tsx, src/components/drawing/DrawingToolButton.tsx, src/components/drawing/DrawingToolbar.tsx, src/components/drawing/index.ts
- Profile (2): src/components/profile/DeleteAccountDialog.tsx, src/components/profile/EditableProfileField.tsx
- UI Primitives (55): src/components/ui/AppBackground.tsx, src/components/ui/AutoResizeTextarea.tsx, src/components/ui/BackgroundPatternSwitcher.tsx, src/components/ui/accordion.tsx, src/components/ui/alert-dialog.tsx, src/components/ui/alert.tsx, src/components/ui/aspect-ratio.tsx, src/components/ui/avatar.tsx, src/components/ui/badge.tsx, src/components/ui/breadcrumb.tsx, src/components/ui/button.tsx, src/components/ui/calendar.tsx, src/components/ui/card.tsx, src/components/ui/carousel.tsx, src/components/ui/chart.tsx, src/components/ui/checkbox.tsx, src/components/ui/collapsible.tsx, src/components/ui/command.tsx, src/components/ui/context-menu.tsx, src/components/ui/dialog.tsx, src/components/ui/draggable-dialog.tsx, src/components/ui/drawer.tsx, src/components/ui/dropdown-menu.tsx, src/components/ui/empty-state.tsx, src/components/ui/form.tsx, src/components/ui/hover-card.tsx, src/components/ui/input-otp.tsx, src/components/ui/input.tsx, src/components/ui/label.tsx, src/components/ui/loading-button.tsx, src/components/ui/menubar.tsx, src/components/ui/navigation-menu.tsx, src/components/ui/pagination.tsx, src/components/ui/popover.tsx, src/components/ui/progress.tsx, src/components/ui/radio-group.tsx, src/components/ui/resizable.tsx, src/components/ui/scroll-area.tsx, src/components/ui/select.tsx, src/components/ui/separator.tsx, src/components/ui/sheet.tsx, src/components/ui/sidebar.tsx, src/components/ui/skeleton.tsx, src/components/ui/slider.tsx, src/components/ui/sonner.tsx, src/components/ui/switch.tsx, src/components/ui/table.tsx, src/components/ui/tabs.tsx, src/components/ui/textarea.tsx, src/components/ui/toast.tsx, src/components/ui/toaster.tsx, src/components/ui/toggle-group.tsx, src/components/ui/toggle.tsx, src/components/ui/tooltip.tsx, src/components/ui/use-toast.ts
- Other Components (57): src/components/AdminImpersonationBanner.tsx, src/components/AuthenticatedPageShell.tsx, src/components/ConfirmDowngradeDialog.tsx, src/components/CookieBanner.tsx, src/components/DashboardPreviewBackground.tsx, src/components/DeleteWorksheetButton.tsx, src/components/DuplicateWorksheetButton.tsx, src/components/DuplicateWorksheetModal.tsx, src/components/EmailConfirmationModal.tsx, src/components/FreeWeekBanner.tsx, src/components/GeneratingModal.tsx, src/components/GlobalFooter.tsx, src/components/GoogleSignInButton.tsx, src/components/IsometricBackground.tsx, src/components/LoginRequiredModal.tsx, src/components/OnboardingChecklist.tsx, src/components/PaymentPopup.tsx, src/components/PricingCalculator.tsx, src/components/PricingSection.tsx, src/components/RatingSection.tsx, src/components/RenameDialog.tsx, src/components/RouteCanonicalUpdater.tsx, src/components/ShareWorksheetModal.tsx, src/components/Sidebar.tsx, src/components/StudentEditDialog.tsx, src/components/StudentRequiredModal.tsx, src/components/StudentSelector.tsx, src/components/StudentSwitcherPopover.tsx, src/components/TeacherTipBox.tsx, src/components/TokenPaywall.tsx, src/components/TokenPaywallModal.tsx, src/components/WorksheetDisplay.tsx, src/components/WorksheetRating.tsx, src/components/anon/AnonFeatureCarousel.tsx, src/components/anon/AnonFeatureMockup.tsx, src/components/anon/AnonPostWorksheetCTA.tsx, src/components/anon/AnonPostWorksheetLandingPage.tsx, src/components/anon/AnonPreWorksheetBanner.tsx, src/components/anon/MiniFeatureGrid.tsx, src/components/anon/WelcomeBackBanner.tsx, src/components/bug-report/BugReportButton.tsx, src/components/bug-report/BugReportModal.tsx, src/components/gallery/GalleryExerciseRenderer.tsx, src/components/notifications/UnifiedBell.tsx, src/components/onboarding/SpotlightOverlay.tsx, src/components/student-homework/StudentHomeworkTab.tsx, src/components/student-progress/EditGoalDialog.tsx, src/components/student-progress/GoalCard.tsx, src/components/student-progress/GoalProgressBar.tsx, src/components/student-progress/StudentProgressTab.tsx, src/components/student-tests/ShareTestModal.tsx, src/components/student-tests/StudentTestsTab.tsx, src/components/student-tests/TestDates.tsx, src/components/student-tests/TestDetailsView.tsx, src/components/student-tests/WelcomeTestResults.tsx, src/components/student/DslmExplainerBanner.tsx, src/components/teacher/TeacherAlertsBell.tsx

RAG KEYWORDS: component inventory, React component, props, state, UI module, worksheet component, DSLM component, homework component, flashcard component, calendar component, student hub component, shadcn component, lucide icon, ESL UI

## State Management Hooks and Services Inventory
STATUS: PRODUCTION

PROBLEM: Changing state in one area can corrupt worksheet recovery, student context, auth, billing, or shared-link behavior if hooks are not mapped first.

EDOOQOO SOLUTION: Hooks under src/hooks and services under src/services are the state and side-effect boundary. Feature code prefers hooks over global stores; browser storage is used intentionally for worksheet recovery, hub email persistence, signup redirects, and share-link verification memory.

TECHNICAL MECHANICS: Hook count: 74. Service count: 11. Hook inventory:
- src/hooks/dslm/useBehavioralStats.tsx
- src/hooks/dslm/useCurriculumPhases.tsx
- src/hooks/dslm/useStudentEvents.tsx
- src/hooks/dslm/useStudentProfile.tsx
- src/hooks/use-mobile.tsx
- src/hooks/use-toast.ts
- src/hooks/useAllWorksheetHomework.tsx
- src/hooks/useAnonymousAuth.tsx
- src/hooks/useAuthFlow.tsx
- src/hooks/useAuthUser.tsx
- src/hooks/useCalendarNotifications.tsx
- src/hooks/useCalendarRecurrence.tsx
- src/hooks/useCalendarSettings.tsx
- src/hooks/useCalendarSlotLogs.tsx
- src/hooks/useCalendarSlots.tsx
- src/hooks/useCalendarVacations.tsx
- src/hooks/useCanonical.ts
- src/hooks/useDeletedWorksheets.tsx
- src/hooks/useDemoGuard.ts
- src/hooks/useDownloadStatus.tsx
- src/hooks/useDownloadTracking.tsx
- src/hooks/useDrawingCanvas.ts
- src/hooks/useEventTracking.tsx
- src/hooks/useExerciseRegeneration.tsx
- src/hooks/useFlashcardCards.tsx
- src/hooks/useFlashcardDefinition.tsx
- src/hooks/useFlashcardLearning.tsx
- src/hooks/useFlashcardSets.tsx
- src/hooks/useFlashcardTranslation.tsx
- src/hooks/useFutureTimeline.tsx
- src/hooks/useGoalProgress.ts
- src/hooks/useHomeworkExerciseGeneration.tsx
- src/hooks/useHomeworkNotifications.tsx
- src/hooks/useInteractiveHomework.tsx
- src/hooks/useInteractiveSharedWorksheet.tsx
- src/hooks/useLiveSessionAnswers.tsx
- src/hooks/useOnboardingProgress.tsx
- src/hooks/useOneMinutePrep.tsx
- src/hooks/usePacingProposals.tsx
- src/hooks/usePaymentTracking.tsx
- src/hooks/usePlanLogic.tsx
- src/hooks/useProfile.tsx
- src/hooks/usePublicBooking.tsx
- src/hooks/useScrollAnimation.ts
- src/hooks/useSectionRegeneration.tsx
- src/hooks/useSignupLinkState.ts
- src/hooks/useSkillMetrics.tsx
- src/hooks/useSpotlight.ts
- src/hooks/useStudent.tsx
- src/hooks/useStudentHubData.tsx
- src/hooks/useStudentKnowledge.tsx
- src/hooks/useStudentNextStepsCount.ts
- src/hooks/useStudentProgress.tsx
- src/hooks/useStudentSelector.tsx
- src/hooks/useStudentTests.tsx
- src/hooks/useStudents.tsx
- src/hooks/useSubscriptionSync.tsx
- src/hooks/useTeacherAlerts.tsx
- src/hooks/useTheme.ts
- src/hooks/useTokenSystem.tsx
- src/hooks/useUpcomingLessonsCount.tsx
- src/hooks/useWelcomeTest.tsx
- src/hooks/useWelcomeTestActions.ts
- src/hooks/useWelcomeTestHistory.tsx
- src/hooks/useWorksheetClaim.ts
- src/hooks/useWorksheetFormPersistence.ts
- src/hooks/useWorksheetGeneration.tsx
- src/hooks/useWorksheetGenerationTracking.tsx
- src/hooks/useWorksheetHistory.tsx
- src/hooks/useWorksheetNavigation.tsx
- src/hooks/useWorksheetRating.ts
- src/hooks/useWorksheetState.tsx
- src/hooks/useWorksheetStats.tsx
- src/hooks/useWorksheetTimes.ts

Service inventory:
- src/services/downloadSessionService.ts
- src/services/exerciseRegenerationService.ts
- src/services/mediaService.ts
- src/services/worksheetService.ts
- src/services/worksheetService/apiService.ts
- src/services/worksheetService/duplicateService.ts
- src/services/worksheetService/feedbackService.ts
- src/services/worksheetService/index.ts
- src/services/worksheetService/trackingService.ts
- src/services/worksheetService/updateService.ts
- src/services/worksheetStreamService.ts

Primary storage keys include currentWorksheet, currentEditableWorksheet, currentInputParams, currentGenerationTime, currentSourceCount, currentWorksheetId, forceNewWorksheet, returningFromPayment, downloadToken, downloadTokenExpiry, prefillWorksheet, prefillExercises, prefillExerciseFocusMap, prefillMediaTypes, autoGenerateWorksheet, student_hub_email, worksheet_email_token, pending worksheet claim IDs, and signup navigation state. Supabase realtime is used for calendar slots and public booking updates.

RAG KEYWORDS: React hook, state management, service layer, sessionStorage, localStorage, Supabase realtime, worksheet state, auth state, token state, student state, calendar state, homework state, RAG hook map, frontend data flow

## Configuration Build and Deployment Assets
STATUS: PRODUCTION

PROBLEM: Teachers experience regressions when build, SEO, function, or bundle behavior changes without understanding the deployment mechanics.

EDOOQOO SOLUTION: package.json, vite.config.ts, tailwind.config.ts, postcss.config.js, tsconfig files, supabase/config.toml, scripts/seo, public assets, and generated dist assets define the build system. build:seo is the main SEO-aware production build script.

TECHNICAL MECHANICS: package.json defines dev, build, build:dev, lint, preview, seo:generate-citable, seo:generate-ai, seo:audit, build:seo, build:seo:to-public, and prerender:seo. Vite uses @vitejs/plugin-react-swc, @ alias to src, dev server host :: on port 8080, es2020 target, sourcemap only in development, debugger dropping in production, manual chunks for demo-content, mock-data, react-vendor, supabase, and lucide, and Lovable componentTagger only in development. supabase/config.toml sets project_id bvfrkzdlklyvnhlpleck and disables JWT verification for selected public/admin maintenance functions. SEO build scripts generate citable pages, blog index, AI resources, prerendered SPA routes, and audit assets.

RAG KEYWORDS: Vite build, Tailwind, TypeScript, Supabase config, SEO build, prerender, bundle chunks, deployment assets, Lovable tagger, build script, production source maps, ESL SaaS deployment, public assets


---

## v6.9.34 — Onboarding hardening, AddStudent v4, gallery & LLM audit fix

STATUS: PRODUCTION

PROBLEM: (1) Spotlight checklist deep-links sometimes failed on the second click and the dim layer swallowed clicks on visually un-dimmed buttons. (2) AddStudentDialog had an unhelpful third "Skip Welcome Test" mode, the "Also send Welcome Test" checkbox in `know` mode defaulted off, and `defer` mode skipped the actual email send when the dialog was invoked with an `onStudentAdded` callback. (3) Generator did not auto-start generation when entered from a 1-Minute Prep suggestion if the form state needed an extra hydration tick. (4) `Reset Onboarding` button in `/profile` did not surface the freshly empty checklist. (5) Public gallery had two conflicting CEFR filters (chip row + legacy dropdown), and several exercise renderers (`word-order`, `complete-word`, `matching-halves`, `negative-prefixes`) rendered raw JSON because their data accepted alternate key names. (6) Monthly LLM audit reported two failures: `openai/gpt-5-mini` 400 ("max_tokens reached") and `google/gemini-2.0-flash` 400 ("invalid model").

EDOOQOO SOLUTION: Spotlight overlay panels are now `pointer-events-none` so they never absorb clicks; closing is via ESC, an explicit × button in the hint tooltip, or by clicking the highlighted element. Each checklist deep-link runs `navigate(...)` + `triggerSpotlight(focusId)` 700 ms later + `refreshProgress()` 1.8 s later, so clicks always fire spotlight regardless of URL state and the checklist updates promptly after the action. `AddStudentDialog` is reduced to two modes (`know`, `defer`) with the Welcome Test checkbox defaulting on for `know`, and `defer` now triggers an inline Welcome Test creation + `send-test-email` invoke even when `onStudentAdded` overrides navigation. `Signup` always lands on `/?action=add-student`. `WorksheetForm` keeps the `autoGenerateWorksheet` sessionStorage flag until either `requestSubmit()` actually fires or a 10 s safety timer expires, with a `useEffect` keyed on `[lessonTopic, selectedStudentId]` driving the retry. `WelcomeTestSuggestion` shows a "Send reminder" button when the pending test was sent ≥48 h ago. Public gallery exposes a single chip row (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `All`) and the level filter uses `ilike` to match composite stored values like `A1/A2`; renderers accept many more key aliases. `audit-llm-models` sends `max_completion_tokens: 16` for GPT-5 family (reasoning consumes tokens before output) and replaces the retired `google/gemini-2.0-flash` with `google/gemini-3-flash-preview`.

TECHNICAL MECHANICS: `src/components/onboarding/SpotlightOverlay.tsx` (non-blocking dim, × close button, URL effect keyed on `_` cache-buster). `src/hooks/useSpotlight.ts` (auto-stamps `at: Date.now()`). `src/components/OnboardingChecklist.tsx` (`navAndSpotlight` helper, `onboarding:refresh` window event listener). `src/pages/Profile.tsx` (post-reset `navigate('/dashboard')`). `src/components/dashboard/AddStudentDialog.tsx` (removed `manual` mode, inline auto-send Welcome Test via `student_tests`/`student_test_questions` insert + `share_token` + `send-test-email`). `src/pages/Signup.tsx` (`postSignupPath` and `emailRedirectTo` always end with `/?action=add-student`). `src/pages/Index.tsx` (robust action consumer). `src/components/WorksheetForm/index.tsx` (`useEffect` driven auto-submit with 10 s safety timeout). `src/components/dashboard/WelcomeTestSuggestion.tsx` (`sentAt` from `student_tests.created_at`, 48 h reminder button invokes `send-test-email` with `reminder: true`). `src/pages/gallery/PublicGalleryIndex.tsx` (single chip row + `ilike` query). `src/components/gallery/GalleryExerciseRenderer.tsx` (matching/word-order/complete-word/negative-prefixes key expansion). `supabase/functions/audit-llm-models/index.ts` (`max_completion_tokens: 16` for GPT-5 family, `google/gemini-3-flash-preview` swap).

RAG KEYWORDS: spotlight overlay, pointer-events, onboarding checklist, focus deep link, triggerSpotlight, AddStudentDialog v4, Welcome Test autosend, send-test-email reminder, autoGenerateWorksheet retry, reset onboarding, signup add-student, public gallery CEFR ilike, gallery exercise renderer aliases, word-order tokens, matching halves, negative prefixes, complete word, audit-llm-models, gpt-5 max_completion_tokens, gemini-3-flash-preview

---

## v6.9.35 - Root crawlability and AI audit hardening

STATUS: PRODUCTION

PROBLEM: AI-search audit tools and answer-engine crawlers may inspect the raw homepage HTML before React hydration. The root SPA shell already declared AI resources and product schema, but raw crawlers needed an explicit root canonical, root WebPage schema, root FAQPage schema, and crawlable no-JS product summary. The local SEO audit also needed to fail if the root page became thin for no-JS crawlers or if unverified Review/AggregateRating schema was added for score-chasing.

EDOOQOO SOLUTION: The root `index.html` now exposes a raw `https://edooqoo.com/` canonical, root WebPage JSON-LD, root FAQPage JSON-LD, and a `<noscript>` summary that mirrors the factual public product definition for adult 1:1 ESL/EFL teachers. The no-JS fallback points crawlers to `/one-minute-prep`, direct worksheet-generator citation pages, ESL worksheet hubs, tools, gallery, legal pages, `llms.txt`, and `knowledge-graph.json`. The global footer exposes the existing `/terms` route beside Privacy Policy, Cookie Policy, and Status.

TECHNICAL MECHANICS: `index.html` keeps the React root unchanged and still lets `PageSeo` override canonical tags after hydration for SPA routes. `index.html` adds root `WebPage` and `FAQPage` JSON-LD without adding `Person`, `Review`, `AggregateRating`, phone, address, NIP, REGON, certification, or unverified testimonial claims. `scripts/seo/audit-seo-assets.mjs` checks raw root canonical, title, description, required JSON-LD types, no-JS fallback word count, required no-JS links, and absence of unverified `Review` or `AggregateRating` schema. `scripts/seo/generate-ai-resources.mjs` emits v6.9.35 AI resources and adds root `WebPage`/`FAQPage` nodes to `knowledge-graph.json`. `src/components/GlobalFooter.tsx` links to `/terms`. No root prerender route was added, so `dist/index.html` remains the SPA fallback behavior for client-routed pages. No Worksheet Generation Engine prompt, parameter, wording, or internal logic changed.

RAG KEYWORDS: root crawlability, no-JS homepage summary, raw homepage canonical, FAQPage schema, WebPage schema, AI visibility audit, Geoboard audit, answer engine optimization, LLM crawler fallback, llms.txt citation, knowledge-graph.json, Terms of Service footer link, no fake reviews, no AggregateRating without evidence, adult ESL tutor workflow, 1:1 English teacher prep

### v6.9.35 — Onboarding click-through, post-signup nav, gallery polish

PROBLEM: SpotlightOverlay wrapper swallowed clicks on the highlighted element (users had to ESC first). AddStudent autosend failed with `student_tests?select=id 400` due to a `deleted_at` filter on a non-exposed column. "Generate worksheet ↗" from 1-Minute Prep filled the form but never auto-submitted because the 500ms setTimeout was cancelled by rapid `lessonTopic` dep changes. Dashboard add-student stayed on `/dashboard` without focus hand-off because `onStudentAdded` short-circuited default navigation. Post-signup Add Student modal failed to open when Supabase email confirmation stripped `?action=add-student`. Welcome Test reminder email body/subject was identical to the initial invitation. `/gallery` had no header so visitors could not reach login/signup/home. `matching-halves` rows shaped `{prompt, options}`, `word-order` rows shaped `{shuffled_sentence}`, and `complete-word` rows with `before/after/full_word` fell through to JSON dump. audit-llm-models still failed for `openai/gpt-5-mini` because 16 reasoning tokens were insufficient.

EDOOQOO SOLUTION: SpotlightOverlay root div is `pointer-events-none`; only the hint tooltip stays interactive. AddStudent autosend query drops the `deleted_at` filter. WorksheetForm auto-submit waits 2× requestAnimationFrame after `lessonTopic` hydrates and fires `requestSubmit()` synchronously; the watchdog timer extended to 30s. Dashboard's `<AddStudentDialog>` no longer passes `onStudentAdded`, so the default flow navigates to `/student/:id?tab=dslm&view=goals&focus=add-goal-modal` (autosend ON) or `/student/:id?tab=dslm&view=pathway&focus=send-welcome-test` (autosend OFF). Signup + Google OAuth signup write `localStorage['post-signup-add-student']='1'` before redirect; Index opens AddStudentDialog when flag OR `?action=add-student` is present AND `isRegisteredUser` is true, then clears the flag. send-test-email accepts `reminder: true` and renders a distinct reminder body + subject. New `src/components/public/PublicTopNav.tsx` (Logo, Gallery, Exercises, Sign in, Get started) is mounted on `/gallery` and `/gallery/:slug`. GalleryExerciseRenderer adds an MC-style fallback for `matching-halves {prompt, options}`, accepts `shuffled_sentence`/`scrambled_sentence` for `word-order`, and accepts `before/context/clue/sentence` (left col) + `full_word/complete/after/result` (right col) for `complete-word`/`negative-prefixes`/`word-formation`. audit-llm-models GPT-5 family probe uses `max_completion_tokens: 128`.

TECHNICAL MECHANICS: Files — `src/components/onboarding/SpotlightOverlay.tsx`, `src/components/dashboard/AddStudentDialog.tsx`, `src/components/WorksheetForm/index.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Signup.tsx`, `src/components/GoogleSignInButton.tsx`, `src/pages/Index.tsx`, `supabase/functions/send-test-email/index.ts`, `supabase/functions/audit-llm-models/index.ts`, `src/pages/gallery/PublicGalleryIndex.tsx`, `src/pages/gallery/PublicGalleryWorksheetPage.tsx`, `src/components/gallery/GalleryExerciseRenderer.tsx`, `src/components/public/PublicTopNav.tsx` (new). `DSLMTab.tsx` already dispatches `dslm:addGoal` when `focus=add-goal-modal`, so no change needed there. No DB migrations, no RLS changes, no Worksheet Generation Engine changes.

RAG KEYWORDS: spotlight clickthrough, pointer-events-none overlay, welcome test autosend 400, student_tests deleted_at, autoGenerateWorksheet rAF, 1-minute prep generate worksheet auto-start, post-signup add student modal, supabase emailRedirectTo flag, dashboard add student navigation focus handoff, welcome test reminder email body, gallery sticky nav, public top nav anonymous, word order shuffled_sentence renderer, matching halves multiple choice fallback, complete-word before after, gpt-5-mini max_completion_tokens 128, audit-llm-models smoke test

## v6.9.36 - Onboarding Runtime Hardening, Gallery Static Rendering, Model Audit Alignment

PROBLEM: AddStudentDialog autosend kept failing because the inline insert used `student_tests.status='pending'`, which the DB CHECK rejects (allowed values: draft/assigned/in_progress/completed/reviewed). "Generate worksheet ↗" from 1-Minute Prep filled the form but auto-submit fired before `selectedStudentId` had hydrated from `preSelectedStudent`. After signup (email or Google) the `?action=add-student` flag was set but `Index.tsx` only mounted `AddStudentDialog` in the public branch, so authenticated users never saw the modal. Navigating to DSLM Goals with `focus=add-goal-modal` dispatched a one-shot `dslm:addGoal` window event before `GoalsView` mounted behind `LazySection`, so the modal silently failed to open. Public gallery still rendered blank cards for Word Order, Matching Halves, and Complete Word because the static renderer rejected several valid stored shapes. Hero H1 clipped the descender of "g" in "teachers" due to tight `leading-[1.1]` on a gradient-clipped span. Daily LLM audit kept recording false 400 failures for `lovable-gateway/openai/gpt-5-mini`, a Gateway alias not used by app runtime, whose minimal chat probe hits GPT-5 reasoning-token caps.

EDOOQOO SOLUTION: New canonical helper `src/lib/welcomeTest/ensureWelcomeTest.ts` owns the welcome-test creation pipeline (draft insert → idempotent question seeding → `generate_test_share_token` RPC → status hand-off to `assigned`) and a sibling `sendWelcomeTestEmail` helper invokes `send-test-email`; `AddStudentDialog` now calls these helpers instead of duplicating the workflow. `WorksheetForm` replaces its timeout/rAF retry with a deterministic readiness gate keyed on `[lessonTopic, selectedStudentId, selectedExercises, selectedMediaTypes, exerciseFocusMap]`; `StudentPage` writes a richer `autoGenerateWorksheetRequest` marker (studentId, suggestionId, createdAt) so the gate only submits when the intended student is selected. `GoogleSignInButton` in signup mode redirects to `/?action=add-student` (not `/dashboard`); `Index.tsx` now mounts `<AddStudentDialog>` in BOTH authenticated and public branches. `DSLMTab` handles `focus=add-goal-modal` by calling `setPendingAddGoal(true)` directly (state-driven), and `GoalsView` defaults the new-goal type to `supporting` when consuming that signal. `GalleryExerciseRenderer` adds shared `asArray` / `firstNonEmptyArr` / `splitTokens` / `maskWordFromAnswer` helpers and expanded normalizers for matching, matching-halves, word-order, complete-word, negative-prefixes, and word-formation; `PublicGalleryWorksheetPage` accepts alternate JSON shapes (`worksheet.exercises`, `sections[].exercises`). `HeroHeadline` relaxes H1 line-height to `leading-[1.18]` and adds `pb-1 leading-[1.2]` to the gradient span. `audit-llm-models` drops the unused `lovable-gateway/openai/gpt-5-mini` daily probe and promotes direct OpenAI `gpt-5-mini-2025-08-07` into the daily set; monthly set is deduplicated.

TECHNICAL MECHANICS: New file `src/lib/welcomeTest/ensureWelcomeTest.ts` (exports `ensureWelcomeTest`, `sendWelcomeTestEmail`; uses `.maybeSingle()` for the profile lookup to suppress 406 console noise). `src/components/dashboard/AddStudentDialog.tsx` replaces inline DB code with helper calls. `src/components/WorksheetForm/index.tsx` adds `autoSubmitFiredRef` + `autoSubmitRequestRef`; readiness effect submits exactly once via `setTimeout(0)+rAF`; watchdog clears both `autoGenerateWorksheet` and `autoGenerateWorksheetRequest` after 30s. `src/pages/StudentPage.tsx` writes `autoGenerateWorksheetRequest` alongside the legacy flag. `src/components/GoogleSignInButton.tsx` selects `/?action=add-student` only for signup mode without pending claims. `src/pages/Index.tsx` mounts `AddStudentDialog` after `TokenPaywallModal` in the authenticated shell. `src/components/dslm/DSLMTab.tsx` URL-focus handler calls `handleScrollTo('goals')` + `setPendingAddGoal(true)` instead of dispatching `dslm:addGoal`. `src/components/dslm/GoalsView.tsx` seeds `newGoal.type='supporting'` before opening. `src/components/gallery/GalleryExerciseRenderer.tsx` rewrite of matching/word-order/complete-word/negative-prefixes/word-formation. `src/pages/gallery/PublicGalleryWorksheetPage.tsx` exercises-array fallback. `src/components/landing/HeroHeadline.tsx` typography fix. `supabase/functions/audit-llm-models/index.ts` daily/monthly targets re-aligned with real runtime model paths. SANCTITY: no Worksheet Generation Engine prompt/logic change, no DB migration, no RLS change, no Stripe change.

RAG KEYWORDS: ensureWelcomeTest helper, welcome test draft assigned, generate_test_share_token RPC, student_tests status check constraint, autoGenerateWorksheetRequest, readiness gate, requestSubmit deterministic, Google signup action=add-student, AddStudentDialog authenticated shell, DSLMTab pendingAddGoal state-driven, GoalsView supporting goal default, gallery renderer normalizer asArray splitTokens maskWordFromAnswer, matching-halves sentence_start sentence_end, word-order scrambled_sentence fallback, complete-word masked before after, hero descender leading pb-1, audit-llm-models direct openai gpt-5-mini-2025-08-07, removed lovable-gateway gpt-5-mini probe
