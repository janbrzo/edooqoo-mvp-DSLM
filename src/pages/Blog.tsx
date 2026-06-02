
import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';
import { SEO_META } from '@/constants/seoMeta';
import { BLOG_POSTS as AUTO_BLOG_POSTS } from '@/data/blogIndex';

// v6.9.22 — Post tiles always render as <a> for full-page nav to static .html files.
const PostLink: React.FC<{ href: string; className: string; children: React.ReactNode }> = ({ href, className, children }) => {
  // .html → static file (browser nav); clean path → React Router
  if (href.endsWith('.html')) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link to={href} className={className}>{children}</Link>;
};

interface BlogPost {
  title: string;
  description: string;
  href: string;
  category: string;
  date: string;
}

const blogPosts: BlogPost[] = [
  { title: "How to Create Grammar Worksheets with AI in 2026", description: "Step-by-step guide with best grammar topics by CEFR level and tips for effective practice.", href: "/blog/how-to-create-grammar-worksheets-with-ai.html", category: "Worksheet Creation", date: "June 1, 2025" },
  { title: "10 Vocabulary Teaching Strategies for ESL Teachers", description: "Proven strategies with AI worksheet examples for contextual learning and spaced repetition.", href: "/blog/vocabulary-teaching-strategies-esl.html", category: "Worksheet Creation", date: "June 2, 2025" },
  { title: "15 Reading Comprehension Activities for English Classes", description: "Activities from A1 to C2 with practical implementation tips.", href: "/blog/reading-comprehension-activities-english.html", category: "Worksheet Creation", date: "June 3, 2025" },
  { title: "Fill in the Blanks Exercises — Best Practices", description: "Types of gap-fill, creating effective distractors, and grading strategies.", href: "/blog/fill-in-the-blanks-exercises-best-practices.html", category: "Worksheet Creation", date: "June 4, 2025" },
  { title: "Differentiated Instruction in the English Classroom", description: "6 strategies for ESL/EFL with AI personalization examples.", href: "/blog/differentiated-instruction-english-classroom.html", category: "Teaching Methods", date: "June 5, 2025" },
  { title: "How to Assess English Level Using CEFR", description: "Complete teacher's guide with can-do statements and placement testing.", href: "/blog/how-to-assess-english-level-cefr.html", category: "Teaching Methods", date: "June 6, 2025" },
  { title: "Teaching English Online in 2026 — Complete Guide", description: "Setup, tools, engagement, scheduling, and growing your online tutoring business.", href: "/blog/teaching-english-online-complete-guide.html", category: "Teaching Methods", date: "June 7, 2025" },
  { title: "Spaced Repetition for Vocabulary Learning", description: "The science behind SM-2 algorithm and practical implementation for ESL.", href: "/blog/spaced-repetition-vocabulary-learning.html", category: "Teaching Methods", date: "June 8, 2025" },
  { title: "Best AI Tools for English Teachers in 2026", description: "Complete comparison of Edooqoo, ChatGPT, Twee, MagicSchool, and more.", href: "/blog/ai-tools-for-english-teachers-2026.html", category: "AI in Education", date: "June 9, 2025" },
  { title: "AI-Assisted Homework Review for English Teachers", description: "How teacher-reviewed AI assistance can support homework feedback workflows.", href: "/blog/ai-homework-grading-for-english-teachers.html", category: "AI in Education", date: "June 10, 2025" },
  { title: "AI-Generated Listening Exercises for ESL", description: "How text-to-speech technology changes language teaching.", href: "/blog/ai-generated-listening-exercises-esl.html", category: "AI in Education", date: "June 11, 2025" },
  { title: "Personalized Learning in English Teaching", description: "From theory to AI-powered practice with nano-skill tracking.", href: "/blog/personalized-learning-english-teaching.html", category: "AI in Education", date: "June 12, 2025" },
  { title: "Cambridge Exam Preparation Tips for Teachers", description: "Worksheet strategies for KET, PET, FCE, CAE, and CPE.", href: "/blog/cambridge-exam-preparation-tips-teachers.html", category: "Exam & Business", date: "June 13, 2025" },
  { title: "Teaching Business English — Complete Guide", description: "Key topics, industry vocabulary, role-play activities, and pricing.", href: "/blog/teaching-business-english-guide.html", category: "Exam & Business", date: "June 14, 2025" },
  { title: "IELTS Preparation Worksheets Guide", description: "Effective practice materials for all four IELTS sections.", href: "/blog/ielts-preparation-worksheets-guide.html", category: "Exam & Business", date: "June 15, 2025" },
  { title: "Communicative Language Teaching Activities for ESL", description: "Information gap, role-play, opinion exchange, and task-based CLT activities.", href: "/blog/communicative-language-teaching-activities.html", category: "Methodology", date: "June 16, 2025" },
  { title: "Task-Based Language Teaching Worksheets", description: "Pre-task, task cycle, and language focus phases with TBLT worksheet examples.", href: "/blog/task-based-language-teaching-worksheets.html", category: "Methodology", date: "June 17, 2025" },
  { title: "Flipped Classroom for English Teaching", description: "Pre-class worksheets and in-class communicative activities for ESL.", href: "/blog/flipped-classroom-english-teaching.html", category: "Methodology", date: "June 18, 2025" },
  { title: "Gamification in the English Classroom", description: "Points, badges, quests, and game-based activities for ESL/EFL classes.", href: "/blog/gamification-english-classroom.html", category: "Methodology", date: "June 19, 2025" },
  { title: "Scaffolding Strategies for English Learners", description: "10 scaffolding strategies with AI-differentiated worksheet examples.", href: "/blog/scaffolding-strategies-english-learners.html", category: "Methodology", date: "June 20, 2025" },
  { title: "Formative Assessment in English Teaching", description: "Exit tickets, self-assessment, peer feedback, and AI-assisted homework review strategies.", href: "/blog/formative-assessment-english-teaching.html", category: "Methodology", date: "June 21, 2025" },
  { title: "How to Teach English Grammar Effectively", description: "Proven grammar teaching strategies with inductive and deductive approaches.", href: "/blog/how-to-teach-english-grammar-effectively.html", category: "How to Teach", date: "June 22, 2025" },
  { title: "How to Teach Speaking in ESL Classes", description: "Fluency vs accuracy, discussion frameworks, and role-play techniques.", href: "/blog/how-to-teach-speaking-esl.html", category: "How to Teach", date: "June 23, 2025" },
  { title: "How to Teach Writing to ESL Students", description: "Process writing, genre-based approach, and effective feedback strategies.", href: "/blog/how-to-teach-writing-esl-students.html", category: "How to Teach", date: "June 24, 2025" },
  { title: "How to Teach English Pronunciation", description: "Minimal pairs, connected speech, stress and intonation techniques.", href: "/blog/how-to-teach-english-pronunciation.html", category: "How to Teach", date: "June 25, 2025" },
  { title: "How to Plan English Lessons Effectively", description: "PPP, ESA, TBL frameworks with lesson plan templates and timing.", href: "/blog/how-to-plan-english-lessons-effectively.html", category: "How to Teach", date: "June 26, 2025" },
  { title: "Classroom Management Tips for ESL Teachers", description: "Engagement techniques, behavior management, and motivation strategies.", href: "/blog/classroom-management-esl-tips.html", category: "How to Teach", date: "June 27, 2025" },
  { title: "Teaching English to Young Learners — Complete Guide", description: "Age-appropriate methods, TPR, songs, games, and classroom management for kids.", href: "/blog/teaching-english-to-young-learners.html", category: "Young Learners", date: "June 28, 2025" },
  { title: "20 ESL Games for Kids That Actually Work", description: "Tested classroom games for vocabulary, grammar, and speaking practice with young learners.", href: "/blog/esl-games-for-kids.html", category: "Young Learners", date: "June 29, 2025" },
  { title: "Teaching English to Teenagers — Strategies That Work", description: "Motivation, relevant topics, technology integration, and managing teenage dynamics.", href: "/blog/teaching-english-to-teenagers.html", category: "Young Learners", date: "June 30, 2025" },
  { title: "Using Songs and Music in the ESL Classroom", description: "Song-based activities for grammar, vocabulary, pronunciation, and listening skills.", href: "/blog/english-songs-activities-esl.html", category: "Young Learners", date: "July 1, 2025" },
  { title: "Storytelling Activities for ESL Classes", description: "Story-based lessons for reading, speaking, writing, and creative thinking.", href: "/blog/storytelling-activities-esl.html", category: "Young Learners", date: "July 2, 2025" },
  { title: "How to Teach Collocations in ESL Classes", description: "Collocation types, teaching strategies, and practice activities for natural English.", href: "/blog/teaching-collocations-esl.html", category: "Vocabulary", date: "July 3, 2025" },
  { title: "Teaching Idioms — Activities and Worksheets for ESL", description: "Context-based idiom teaching with categorized activities by CEFR level.", href: "/blog/teaching-idioms-esl-activities.html", category: "Vocabulary", date: "July 4, 2025" },
  { title: "15 Vocabulary Games for the ESL Classroom", description: "Engaging games for vocabulary review, acquisition, and retention.", href: "/blog/vocabulary-games-esl-classroom.html", category: "Vocabulary", date: "July 5, 2025" },
  { title: "Teaching Academic Vocabulary — Strategies for ESL", description: "AWL-based instruction, Tier 2-3 words, and academic register practice.", href: "/blog/academic-vocabulary-teaching-strategies.html", category: "Vocabulary", date: "July 6, 2025" },
  { title: "Word Formation Exercises — Prefixes, Suffixes, and Roots", description: "Morphology-based vocabulary building with exercises and worksheets.", href: "/blog/word-formation-exercises-english.html", category: "Vocabulary", date: "July 7, 2025" },
  { title: "Teaching Conditionals — Complete ESL Guide", description: "Zero to third conditional with timelines, practice activities, and common errors.", href: "/blog/teaching-conditionals-esl-guide.html", category: "Grammar", date: "July 8, 2025" },
  { title: "Teaching Passive Voice — Activities and Worksheets", description: "When and how to introduce passive voice with engaging transformation activities.", href: "/blog/teaching-passive-voice-activities.html", category: "Grammar", date: "July 9, 2025" },
  { title: "Teaching Reported Speech — Step-by-Step Guide", description: "Tense backshift rules, reporting verbs, and communicative practice activities.", href: "/blog/teaching-reported-speech-esl.html", category: "Grammar", date: "July 10, 2025" },
  { title: "Teaching Articles (A, An, The) — ESL Guide", description: "Rules, exceptions, and practice activities for English articles.", href: "/blog/teaching-articles-esl-guide.html", category: "Grammar", date: "July 11, 2025" },
  { title: "Error Correction Techniques for ESL Teachers", description: "Self-correction, peer correction, delayed correction, and reformulation strategies.", href: "/blog/error-correction-techniques-esl.html", category: "Grammar", date: "July 12, 2025" },
  { title: "How to Create Effective English Tests — Teacher's Guide", description: "Test design principles, item types, scoring, and validity for English assessment.", href: "/blog/creating-english-tests-guide.html", category: "Assessment", date: "July 13, 2025" },
  { title: "Creating Rubrics for English Language Assessment", description: "Analytic and holistic rubrics for writing, speaking, and project assessment.", href: "/blog/rubrics-for-english-teachers.html", category: "Assessment", date: "July 14, 2025" },
  { title: "Self-Assessment Strategies for ESL Students", description: "Can-do checklists, learning journals, and portfolio-based self-evaluation.", href: "/blog/self-assessment-strategies-esl.html", category: "Assessment", date: "July 15, 2025" },
  { title: "Peer Feedback Activities for English Classes", description: "Structured peer review, feedback frames, and collaborative assessment techniques.", href: "/blog/peer-feedback-activities-english.html", category: "Assessment", date: "July 16, 2025" },
  { title: "Diagnostic Testing for English Learners — How and When", description: "Placement tests, needs analysis, and identifying learning gaps.", href: "/blog/diagnostic-testing-english-learners.html", category: "Assessment", date: "July 17, 2025" },
  { title: "20 Warm-Up Activities for ESL Classes", description: "Quick 5-minute activities to start every lesson with energy and focus.", href: "/blog/warm-up-activities-esl.html", category: "Activities", date: "July 18, 2025" },
  { title: "Role-Play Activities for ESL — Ideas and Templates", description: "Scenario cards, role assignments, and language support for speaking practice.", href: "/blog/role-play-activities-esl.html", category: "Activities", date: "July 19, 2025" },
  { title: "Debate Activities for English Classes — Topics and Rules", description: "Structured debate formats, topic lists by level, and language of argumentation.", href: "/blog/debate-activities-english-class.html", category: "Activities", date: "July 20, 2025" },
  { title: "Pair Work Activities for ESL — 15 Ready-to-Use Ideas", description: "Information gap, interview, survey, and collaborative pair activities.", href: "/blog/pair-work-activities-esl.html", category: "Activities", date: "July 21, 2025" },
  { title: "Project-Based Learning in the English Classroom", description: "Long-term projects integrating all four skills with assessment criteria.", href: "/blog/project-based-learning-english.html", category: "Activities", date: "July 22, 2025" },
  { title: "TEFL Certification — Complete Guide for New Teachers", description: "TEFL vs TESOL vs CELTA, online vs in-person, costs, and career paths.", href: "/blog/tefl-certification-guide.html", category: "Professional Dev", date: "July 23, 2025" },
  { title: "Preventing Teacher Burnout — Strategies for ESL Teachers", description: "Workload management, boundaries, self-care, and sustainable teaching practices.", href: "/blog/teacher-burnout-prevention-esl.html", category: "Professional Dev", date: "July 24, 2025" },
  { title: "Building Your ESL Teaching Portfolio — What to Include", description: "Portfolio structure, sample materials, student testimonials, and digital tools.", href: "/blog/building-esl-teaching-portfolio.html", category: "Professional Dev", date: "July 25, 2025" },
  { title: "Using AI to Boost Teacher Productivity in 2026", description: "AI tools for lesson planning, worksheet creation, grading, and admin tasks.", href: "/blog/using-ai-teacher-productivity.html", category: "Professional Dev", date: "July 26, 2025" },
  { title: "Setting Up a Freelance ESL Business — Complete Guide", description: "Pricing, marketing, student acquisition, tools, and scaling strategies.", href: "/blog/setting-up-freelance-esl-business.html", category: "Professional Dev", date: "July 27, 2025" },
  { title: "Teaching Culture in the ESL Classroom", description: "Integrating cultural awareness, intercultural competence, and global citizenship.", href: "/blog/teaching-culture-esl-classroom.html", category: "Culture", date: "July 28, 2025" },
  { title: "Cross-Cultural Communication Activities for ESL", description: "Activities exploring cultural norms, body language, and communication styles.", href: "/blog/cross-cultural-communication-activities.html", category: "Culture", date: "July 29, 2025" },
  { title: "Using Films and Videos in English Teaching", description: "Film-based lessons, clip selection, viewing tasks, and discussion activities.", href: "/blog/using-films-english-teaching.html", category: "Culture", date: "July 30, 2025" },
  { title: "Teaching English Through Literature — Practical Guide", description: "Graded readers, poetry, short stories, and literature circles for ESL.", href: "/blog/teaching-english-through-literature.html", category: "Culture", date: "July 31, 2025" },
  { title: "Using Current Events in ESL Lessons", description: "News-based lessons, media literacy, and critical thinking activities.", href: "/blog/current-events-esl-lessons.html", category: "Culture", date: "August 1, 2025" },
  { title: "Best Apps for Learning English in 2026", description: "App comparison for vocabulary, grammar, speaking, and listening practice.", href: "/blog/best-apps-learning-english-2026.html", category: "Technology", date: "August 2, 2025" },
  { title: "Using Google Workspace for ESL Teachers", description: "Google Docs, Slides, Forms, and Classroom for English teaching workflows.", href: "/blog/using-google-workspace-esl-teachers.html", category: "Technology", date: "August 3, 2025" },
  { title: "Creating Interactive Worksheets Online — Tools and Tips", description: "Platforms and techniques for making engaging digital worksheets.", href: "/blog/creating-interactive-worksheets-online.html", category: "Technology", date: "August 4, 2025" },
  { title: "Video Conferencing Tips for Online ESL Teachers", description: "Zoom, Meet, and Teams optimization for effective online English lessons.", href: "/blog/video-conferencing-tips-online-esl.html", category: "Technology", date: "August 5, 2025" },
  { title: "AI Lesson Planning Strategies for English Teachers", description: "Using AI to plan, differentiate, and optimize English lessons.", href: "/blog/ai-lesson-planning-strategies.html", category: "Technology", date: "August 6, 2025" },
  { title: "Teaching English to Immigrants and Refugees", description: "Trauma-informed teaching, survival English, and community integration.", href: "/blog/teaching-english-immigrants-refugees.html", category: "Specialized", date: "August 7, 2025" },
  { title: "English for Specific Purposes (ESP) — Teacher's Guide", description: "Medical, legal, aviation, and technical English course design.", href: "/blog/english-for-specific-purposes-guide.html", category: "Specialized", date: "August 8, 2025" },
  { title: "Teaching English to Students with Learning Disabilities", description: "Dyslexia-friendly materials, ADHD strategies, and inclusive classroom design.", href: "/blog/teaching-english-learning-disabilities.html", category: "Specialized", date: "August 9, 2025" },
  { title: "Managing a Multilevel ESL Classroom", description: "Differentiation strategies, tiered tasks, and flexible grouping techniques.", href: "/blog/multilevel-esl-classroom-strategies.html", category: "Specialized", date: "August 10, 2025" },
  { title: "Teaching English One-to-One — Private Lesson Guide", description: "Needs analysis, lesson structure, pacing, and building rapport in private lessons.", href: "/blog/teaching-english-one-to-one.html", category: "Specialized", date: "August 11, 2025" },
  { title: "Teaching Email Writing to ESL Students", description: "Formal and informal email templates, register, and common mistakes.", href: "/blog/teaching-email-writing-esl.html", category: "Writing & Comm", date: "August 12, 2025" },
  { title: "Creative Writing Activities for ESL Classes", description: "Story starters, poetry, flash fiction, and collaborative writing projects.", href: "/blog/creative-writing-activities-esl.html", category: "Writing & Comm", date: "August 13, 2025" },
  { title: "Teaching Presentation Skills in English", description: "Structure, signposting language, visual aids, and delivery techniques.", href: "/blog/teaching-presentation-skills-english.html", category: "Writing & Comm", date: "August 14, 2025" },
  { title: "100 Discussion Questions for ESL Classes — By Topic", description: "Curated questions organized by topic and CEFR level for speaking practice.", href: "/blog/discussion-questions-esl-topics.html", category: "Writing & Comm", date: "August 15, 2025" },
  { title: "Teaching Formal vs Informal English — Register Guide", description: "Register awareness, academic vs conversational English, and style shifting.", href: "/blog/teaching-formal-informal-english.html", category: "Writing & Comm", date: "August 16, 2025" },
  { title: "First Day of ESL Class — Activities and Icebreakers", description: "Needs analysis, icebreakers, classroom rules, and first-lesson routines.", href: "/blog/first-day-esl-class-activities.html", category: "Lesson Resources", date: "August 17, 2025" },
  { title: "End-of-Term Activities for ESL Classes", description: "Review games, portfolio presentations, reflection activities, and celebrations.", href: "/blog/end-of-term-activities-esl.html", category: "Lesson Resources", date: "August 18, 2025" },
  { title: "Holiday-Themed ESL Activities and Worksheets", description: "Christmas, Halloween, Easter, and cultural holiday lesson ideas.", href: "/blog/holiday-themed-esl-activities.html", category: "Lesson Resources", date: "August 19, 2025" },
  { title: "Substitute Teacher ESL Lesson Plans — Ready to Go", description: "No-prep emergency lesson plans for substitute ESL teachers.", href: "/blog/substitute-teacher-esl-lesson-plans.html", category: "Lesson Resources", date: "August 20, 2025" },
  { title: "20 Five-Minute Filler Activities for ESL", description: "Quick activities for transitions, early finishers, and unexpected free time.", href: "/blog/five-minute-filler-activities-esl.html", category: "Lesson Resources", date: "August 21, 2025" },
  { title: "Teaching Linking Words and Connectors", description: "Conjunctions, discourse markers, and cohesion activities by CEFR level.", href: "/blog/teaching-linking-words-connectors.html", category: "Language Systems", date: "August 22, 2025" },
  { title: "Using Corpus Linguistics in ESL Teaching", description: "Concordancers, frequency lists, and data-driven learning activities.", href: "/blog/corpus-linguistics-esl-teaching.html", category: "Language Systems", date: "August 23, 2025" },
  { title: "Contrastive Analysis in Language Teaching", description: "L1 interference patterns, error prediction, and targeted practice strategies.", href: "/blog/contrastive-analysis-language-teaching.html", category: "Language Systems", date: "August 24, 2025" },
  { title: "Teaching Pragmatics in ESL — Politeness and Context", description: "Speech acts, politeness strategies, and context-appropriate language use.", href: "/blog/teaching-pragmatics-esl.html", category: "Language Systems", date: "August 25, 2025" },
  { title: "Setting Up Extensive Reading Programs for ESL", description: "Graded readers, reading logs, assessment, and motivation strategies.", href: "/blog/extensive-reading-programs-esl.html", category: "Language Systems", date: "August 26, 2025" },
  { title: "Teaching Minimal Pairs — Pronunciation Activities for ESL", description: "Minimal pair drills, card games, and listening discrimination exercises.", href: "/blog/teaching-minimal-pairs-esl.html", category: "Pronunciation", date: "August 27, 2025" },
  { title: "Teaching English Intonation and Stress Patterns", description: "Sentence stress, word stress, rising/falling intonation with practice activities.", href: "/blog/teaching-english-intonation-stress.html", category: "Pronunciation", date: "August 28, 2025" },
  { title: "Teaching Connected Speech — Activities and Exercises", description: "Linking, elision, assimilation, and weak forms with listening tasks.", href: "/blog/connected-speech-teaching-activities.html", category: "Pronunciation", date: "August 29, 2025" },
  { title: "Using the IPA Phonetic Alphabet in ESL Teaching", description: "When and how to introduce IPA symbols with practical classroom activities.", href: "/blog/ipa-phonetic-alphabet-esl-teaching.html", category: "Pronunciation", date: "August 30, 2025" },
  { title: "Accent Reduction Activities for ESL Students", description: "Intelligibility vs nativeness, diagnostic tools, and targeted practice.", href: "/blog/accent-reduction-activities-esl.html", category: "Pronunciation", date: "August 31, 2025" },
  { title: "Effective ESL Homework Strategies That Students Actually Do", description: "Meaningful homework design, accountability systems, and feedback loops.", href: "/blog/effective-esl-homework-strategies.html", category: "Homework", date: "September 1, 2025" },
  { title: "Teaching Study Skills to English Learners", description: "Note-taking, time management, vocabulary notebooks, and revision techniques.", href: "/blog/teaching-study-skills-english-learners.html", category: "Homework", date: "September 2, 2025" },
  { title: "Encouraging Self-Directed Learning in ESL Students", description: "Learner training, goal setting, and autonomy-building strategies.", href: "/blog/self-directed-learning-esl.html", category: "Homework", date: "September 3, 2025" },
  { title: "Flipped Homework — Reversing In-Class and At-Home Tasks", description: "Video-based pre-learning, in-class practice, and blended learning models.", href: "/blog/flipped-homework-esl-classroom.html", category: "Homework", date: "September 4, 2025" },
  { title: "Best Digital Homework Tools for ESL Teachers in 2026", description: "Platform comparison for assigning, tracking, and grading ESL homework online.", href: "/blog/digital-homework-tools-esl-teachers.html", category: "Homework", date: "September 5, 2025" },
  { title: "Motivating Reluctant ESL Learners — Practical Strategies", description: "Identifying barriers, building rapport, and creating meaningful learning experiences.", href: "/blog/motivating-reluctant-esl-learners.html", category: "Motivation", date: "September 6, 2025" },
  { title: "Building Intrinsic Motivation in Language Learning", description: "Self-determination theory, autonomy, competence, and relatedness in ESL.", href: "/blog/intrinsic-motivation-language-learning.html", category: "Motivation", date: "September 7, 2025" },
  { title: "Fostering Student Autonomy in the ESL Classroom", description: "Choice boards, learning contracts, and self-directed projects.", href: "/blog/student-autonomy-esl-classroom.html", category: "Motivation", date: "September 8, 2025" },
  { title: "Using Rewards in the ESL Classroom — Dos and Don'ts", description: "Token economies, praise strategies, and avoiding reward dependency.", href: "/blog/using-rewards-esl-classroom.html", category: "Motivation", date: "September 9, 2025" },
  { title: "Growth Mindset in Language Learning — Activities and Strategies", description: "Fixed vs growth mindset, error positivity, and effort-based feedback.", href: "/blog/growth-mindset-language-learning.html", category: "Motivation", date: "September 10, 2025" },
  { title: "Teaching the Subjunctive in English — When and How", description: "Mandative subjunctive, were-subjunctive, and practice contexts.", href: "/blog/teaching-subjunctive-english.html", category: "Advanced Grammar", date: "September 11, 2025" },
  { title: "Teaching Inversion in English — Advanced Grammar Activities", description: "Negative adverbials, conditional inversion, and formal register practice.", href: "/blog/teaching-inversion-english.html", category: "Advanced Grammar", date: "September 12, 2025" },
  { title: "Teaching Cleft Sentences — It-Clefts and What-Clefts", description: "Focus and emphasis structures with transformation and production activities.", href: "/blog/teaching-cleft-sentences-english.html", category: "Advanced Grammar", date: "September 13, 2025" },
  { title: "Teaching Ellipsis and Substitution in English", description: "Textual cohesion, so/do substitution, and discourse-level grammar.", href: "/blog/teaching-ellipsis-substitution-english.html", category: "Advanced Grammar", date: "September 14, 2025" },
  { title: "Teaching Mixed Conditionals — Activities and Worksheets", description: "Past-present and present-past conditionals with contextualized practice.", href: "/blog/teaching-mixed-conditionals-esl.html", category: "Advanced Grammar", date: "September 15, 2025" },
  { title: "Teaching Listening Strategies to ESL Students", description: "Top-down, bottom-up, and metacognitive strategies for listening comprehension.", href: "/blog/teaching-listening-strategies-esl.html", category: "Listening", date: "September 16, 2025" },
  { title: "Dictation Activities for the ESL Classroom", description: "Running dictation, dictogloss, partial dictation, and communicative dictation.", href: "/blog/dictation-activities-esl-classroom.html", category: "Listening", date: "September 17, 2025" },
  { title: "Using Podcasts in ESL Teaching — Activities and Lesson Plans", description: "Podcast selection, pre-listening tasks, and follow-up activities by level.", href: "/blog/using-podcasts-esl-teaching.html", category: "Listening", date: "September 18, 2025" },
  { title: "Teaching Note-Taking Skills in English Classes", description: "Cornell method, mind maps, abbreviations, and academic listening practice.", href: "/blog/teaching-note-taking-skills-english.html", category: "Listening", date: "September 19, 2025" },
  { title: "Using Authentic Listening Materials in ESL — Tips and Sources", description: "TED Talks, news broadcasts, interviews, and grading authentic input.", href: "/blog/authentic-listening-materials-esl.html", category: "Listening", date: "September 20, 2025" },
  { title: "Communicating with ESL Parents — Tips and Templates", description: "Multilingual communication, progress updates, and building home-school partnerships.", href: "/blog/communicating-with-esl-parents.html", category: "Communication", date: "September 21, 2025" },
  { title: "Writing Student Progress Reports for ESL Classes", description: "CEFR-aligned descriptors, strengths/areas format, and report templates.", href: "/blog/writing-student-progress-reports-esl.html", category: "Communication", date: "September 22, 2025" },
  { title: "Parent-Teacher Conferences for ESL — Preparation Guide", description: "Conference structure, visual aids, and navigating language barriers.", href: "/blog/parent-teacher-conferences-esl.html", category: "Communication", date: "September 23, 2025" },
  { title: "Advocating for ELL Students in Your School", description: "Policy awareness, accommodation requests, and data-driven advocacy.", href: "/blog/advocating-for-ell-students.html", category: "Communication", date: "September 24, 2025" },
  { title: "Collaborating with Mainstream Teachers as an ESL Specialist", description: "Co-teaching models, content-language integration, and shared planning.", href: "/blog/collaborating-with-mainstream-teachers-esl.html", category: "Communication", date: "September 25, 2025" },
  { title: "Managing Behavior in the ESL Classroom", description: "Positive discipline, behavior contracts, and de-escalation strategies for language classes.", href: "/blog/managing-behavior-esl-classroom.html", category: "Classroom Management", date: "October 26, 2025" },
  { title: "Seating Arrangements for the ESL Classroom — What Works", description: "U-shape, clusters, rows, and flexible seating with activity-type matching.", href: "/blog/seating-arrangements-esl-classroom.html", category: "Classroom Management", date: "October 27, 2025" },
  { title: "Smooth Transitions Between Activities in ESL Classes", description: "Transition signals, timer techniques, and maintaining momentum between tasks.", href: "/blog/transitions-activities-esl-classroom.html", category: "Classroom Management", date: "October 28, 2025" },
  { title: "Energy Management in ESL Lessons — Pacing and Flow", description: "Stirrers vs settlers, lesson arc, and balancing high-energy with focused work.", href: "/blog/energy-management-esl-lessons.html", category: "Classroom Management", date: "October 29, 2025" },
  { title: "Managing Large ESL Classes — Strategies for 30+ Students", description: "Monitoring techniques, choral work, group roles, and efficient feedback in large groups.", href: "/blog/managing-large-esl-classes.html", category: "Classroom Management", date: "October 30, 2025" },
  { title: "Teaching Essay Structure to ESL Students", description: "Introduction-body-conclusion, thesis statements, topic sentences, and paragraph unity.", href: "/blog/teaching-essay-structure-esl.html", category: "Writing", date: "October 31, 2025" },
  { title: "The Process Writing Approach in ESL Teaching", description: "Brainstorming, drafting, revising, editing, and publishing stages with classroom activities.", href: "/blog/process-writing-approach-esl.html", category: "Writing", date: "November 1, 2025" },
  { title: "Running Peer Editing Workshops in ESL Classes", description: "Training students in peer review, feedback forms, and structured editing protocols.", href: "/blog/peer-editing-workshops-esl.html", category: "Writing", date: "November 2, 2025" },
  { title: "Journal Writing for ESL Students — Ideas and Implementation", description: "Dialogue journals, reflective journals, and creative journal prompts by level.", href: "/blog/journal-writing-esl-students.html", category: "Writing", date: "November 3, 2025" },
  { title: "Portfolio Assessment for ESL Writing — Complete Guide", description: "Selection criteria, reflection tasks, showcase vs working portfolios, and grading.", href: "/blog/portfolio-assessment-esl-writing.html", category: "Writing", date: "November 4, 2025" },
  { title: "Teaching Medical English — Vocabulary, Scenarios, and Resources", description: "Medical terminology, patient communication, case studies, and role-plays for healthcare.", href: "/blog/teaching-medical-english.html", category: "ESP", date: "November 5, 2025" },
  { title: "Teaching Legal English — Contracts, Court Language, and Case Studies", description: "Legal vocabulary, contract analysis, moot court activities, and plain English drafting.", href: "/blog/teaching-legal-english.html", category: "ESP", date: "November 6, 2025" },
  { title: "Teaching English for Hospitality and Tourism", description: "Hotel, restaurant, and travel agency scenarios with functional language worksheets.", href: "/blog/teaching-english-hospitality-tourism.html", category: "ESP", date: "November 7, 2025" },
  { title: "Teaching English for IT Professionals", description: "Technical documentation, Agile vocabulary, code review language, and presentation skills.", href: "/blog/teaching-english-it-professionals.html", category: "ESP", date: "November 8, 2025" },
  { title: "Teaching Aviation English — ICAO Standards and Radiotelephony", description: "ICAO Level 4+ requirements, radiotelephony phrases, and emergency communication drills.", href: "/blog/teaching-aviation-english.html", category: "ESP", date: "November 9, 2025" },
  { title: "CLIL Methodology — A Complete Guide for Language Teachers", description: "Content and Language Integrated Learning: the 4Cs framework, lesson planning, and assessment.", href: "/blog/clil-methodology-complete-guide.html", category: "CLIL", date: "November 10, 2025" },
  { title: "Teaching Science Through English — CLIL Activities", description: "Lab reports, experiment descriptions, and scientific vocabulary scaffolding.", href: "/blog/teaching-science-through-english.html", category: "CLIL", date: "November 11, 2025" },
  { title: "English as Medium of Instruction (EMI) — Teacher's Guide", description: "Lecture scaffolding, academic language support, and student comprehension strategies.", href: "/blog/emi-english-medium-instruction-guide.html", category: "CLIL", date: "November 12, 2025" },
  { title: "Bilingual Education Models — Comparison and Implementation", description: "Transitional, maintenance, dual-language, and immersion models with pros and cons.", href: "/blog/bilingual-education-models-comparison.html", category: "CLIL", date: "November 13, 2025" },
  { title: "Teaching Academic Language Functions in CLIL", description: "Classifying, hypothesizing, comparing, evaluating — language frames by subject area.", href: "/blog/academic-language-functions-clil.html", category: "CLIL", date: "November 14, 2025" },
  { title: "Designing English Midterm and Final Exams", description: "Item types, specification tables, timing, difficulty calibration, and answer key design.", href: "/blog/designing-english-midterm-final-exams.html", category: "Assessment", date: "November 15, 2025" },
  { title: "Designing Cloze Tests for ESL — Types and Best Practices", description: "Fixed-ratio, rational, C-test, and banked cloze with scoring approaches.", href: "/blog/cloze-test-design-esl.html", category: "Assessment", date: "November 16, 2025" },
  { title: "Item Analysis for English Tests — Improving Your Exams", description: "Facility value, discrimination index, distractor analysis, and test reliability.", href: "/blog/item-analysis-english-tests.html", category: "Assessment", date: "November 17, 2025" },
  { title: "The Washback Effect in Language Testing", description: "Positive vs negative washback, test design for learning, and alignment strategies.", href: "/blog/washback-effect-language-testing.html", category: "Assessment", date: "November 18, 2025" },
  { title: "Alternative Assessment in the ESL Classroom", description: "Presentations, podcasts, vlogs, infographics, and performance-based assessment rubrics.", href: "/blog/alternative-assessment-esl-classroom.html", category: "Assessment", date: "November 19, 2025" },
  { title: "Neurodiversity in the ESL Classroom — ADHD, Autism, and Dyslexia", description: "Accommodations, multisensory techniques, and differentiated materials for neurodiverse learners.", href: "/blog/neurodiversity-esl-classroom.html", category: "Inclusive Teaching", date: "November 20, 2025" },
  { title: "Trauma-Informed Teaching in ESL Classes", description: "Safety, predictability, choice, and relationship-building for trauma-affected students.", href: "/blog/trauma-informed-teaching-esl.html", category: "Inclusive Teaching", date: "November 21, 2025" },
  { title: "Culturally Responsive Teaching in ESL — Practical Strategies", description: "Funds of knowledge, identity texts, and culturally sustaining pedagogy.", href: "/blog/culturally-responsive-teaching-esl.html", category: "Inclusive Teaching", date: "November 22, 2025" },
  { title: "Teaching Gender-Inclusive Language in ESL", description: "Pronouns, titles, occupational nouns, and navigating evolving language norms.", href: "/blog/gender-inclusive-language-esl.html", category: "Inclusive Teaching", date: "November 23, 2025" },
  { title: "Heritage Speakers in the ESL Classroom — Challenges and Strategies", description: "Bidialectal literacy, academic register development, and identity affirmation.", href: "/blog/heritage-speakers-esl-classroom.html", category: "Inclusive Teaching", date: "November 24, 2025" },
  { title: "Syllabus Design for ESL Courses — A Complete Guide", description: "Structural, notional-functional, and task-based syllabi with planning templates.", href: "/blog/syllabus-design-esl-courses.html", category: "Curriculum Design", date: "November 25, 2025" },
  { title: "Conducting Needs Analysis for ESL Students", description: "Questionnaires, interviews, placement data, and learning objectives mapping.", href: "/blog/needs-analysis-esl-students.html", category: "Curriculum Design", date: "November 26, 2025" },
  { title: "How to Select and Evaluate ESL Textbooks", description: "Evaluation criteria, piloting strategies, and textbook adaptation frameworks.", href: "/blog/selecting-esl-textbooks-guide.html", category: "Curriculum Design", date: "November 27, 2025" },
  { title: "Evaluating ESL Course Effectiveness — Methods and Tools", description: "Pre/post testing, student feedback, observation, and outcome analysis.", href: "/blog/course-evaluation-esl-programs.html", category: "Curriculum Design", date: "November 28, 2025" },
  { title: "Lesson Sequencing and Scaffolding in Curriculum Design", description: "Spiral curriculum, task complexity grading, and coherent lesson chains.", href: "/blog/lesson-sequencing-scaffolding-curriculum.html", category: "Curriculum Design", date: "November 29, 2025" },
  { title: "Drama Techniques for the ESL Classroom", description: "Hot-seating, freeze-frame, conscience alley, and forum theatre for language practice.", href: "/blog/drama-techniques-esl-classroom.html", category: "Drama & Arts", date: "November 30, 2025" },
  { title: "Improvisation Activities for ESL Students", description: "Yes-and, status games, character switches, and spontaneous dialogue building.", href: "/blog/improvisation-activities-esl.html", category: "Drama & Arts", date: "December 1, 2025" },
  { title: "Reader's Theatre in ESL — Scripts and Activities", description: "Script selection, fluency practice, intonation work, and performance preparation.", href: "/blog/readers-theatre-esl-activities.html", category: "Drama & Arts", date: "December 2, 2025" },
  { title: "Art-Based Language Activities for ESL Classes", description: "Drawing dictation, gallery walks, visual storytelling, and art response writing.", href: "/blog/art-based-language-activities-esl.html", category: "Drama & Arts", date: "December 3, 2025" },
  { title: "Using Comics and Graphic Novels in ESL Teaching", description: "Panel analysis, speech bubble writing, story creation, and visual literacy.", href: "/blog/using-comics-graphic-novels-esl.html", category: "Drama & Arts", date: "December 4, 2025" },
  { title: "Cooperative Learning Structures for ESL Classes", description: "Kagan structures, numbered heads, round robin, and rally coach for ESL.", href: "/blog/cooperative-learning-structures-esl.html", category: "Cooperative Learning", date: "December 5, 2025" },
  { title: "Jigsaw Activities for the ESL Classroom", description: "Expert groups, information sharing, and accountability in jigsaw reading/listening.", href: "/blog/jigsaw-activities-esl-classroom.html", category: "Cooperative Learning", date: "December 6, 2025" },
  { title: "Think-Pair-Share and Variations for ESL", description: "Write-pair-share, think-pair-square, and rally robin adaptations.", href: "/blog/think-pair-share-esl-variations.html", category: "Cooperative Learning", date: "December 7, 2025" },
  { title: "Managing Group Dynamics in the ESL Classroom", description: "Role assignment, participation balancing, and conflict resolution in group work.", href: "/blog/group-dynamics-esl-classroom.html", category: "Cooperative Learning", date: "December 8, 2025" },
  { title: "Collaborative Writing Activities for ESL Students", description: "Round-robin stories, wiki writing, peer drafting, and collaborative essays.", href: "/blog/collaborative-writing-activities-esl.html", category: "Cooperative Learning", date: "December 9, 2025" },
  { title: "Krashen's Hypotheses Applied to ESL Teaching", description: "Acquisition-learning, input hypothesis, monitor model, and affective filter in practice.", href: "/blog/krashen-hypotheses-esl-teaching.html", category: "SLA Theory", date: "December 10, 2025" },
  { title: "Learning Pacing in Adult ESL: Scientific vs Pragmatic Approaches", description: "Research-based reference on the spectrum behind the Edooqoo Learning Pacing slider — Krashen, Ellis, Sweller, Cepeda, Karpicke and more.", href: "/blog/learning-pacing-scientific-vs-pragmatic-esl.html", category: "SLA Theory", date: "April 21, 2026" },
  { title: "Interlanguage and Fossilization — What Teachers Need to Know", description: "Developmental stages, error analysis, and preventing fossilization strategies.", href: "/blog/interlanguage-fossilization-esl.html", category: "SLA Theory", date: "December 11, 2025" },
  { title: "Input and Output Hypotheses in the ESL Classroom", description: "Comprehensible input, pushed output, noticing hypothesis, and interaction.", href: "/blog/input-output-hypotheses-classroom.html", category: "SLA Theory", date: "December 12, 2025" },
  { title: "The Critical Period Hypothesis — Implications for Teaching", description: "Age effects, neuroplasticity, ultimate attainment, and pedagogical adaptations.", href: "/blog/critical-period-hypothesis-language.html", category: "SLA Theory", date: "December 13, 2025" },
  { title: "Motivation Theories in Language Learning — From Gardner to Dörnyei", description: "Integrative/instrumental motivation, L2 Motivational Self System, and classroom strategies.", href: "/blog/motivation-theories-language-learning.html", category: "SLA Theory", date: "December 14, 2025" },
  { title: "Action Research for ESL Teachers — A Practical Guide", description: "Research questions, data collection, analysis cycles, and classroom implementation.", href: "/blog/action-research-esl-teachers.html", category: "Professional Dev", date: "December 15, 2025" },
  { title: "Reflective Practice in Language Teaching", description: "Reflective journals, critical incidents, Kolb's cycle, and peer reflection groups.", href: "/blog/reflective-practice-language-teaching.html", category: "Professional Dev", date: "December 16, 2025" },
  { title: "Peer Observation for ESL Teachers — Protocols and Feedback", description: "Pre-observation meetings, focus areas, observation tools, and post-observation dialogue.", href: "/blog/peer-observation-esl-teachers.html", category: "Professional Dev", date: "December 17, 2025" },
  { title: "Mentoring New ESL Teachers — A Guide for Experienced Educators", description: "Mentoring models, scaffolded autonomy, feedback frameworks, and mentor development.", href: "/blog/mentoring-new-esl-teachers.html", category: "Professional Dev", date: "December 18, 2025" },
  { title: "CPD Planning for ESL Teachers — Building Your Development Path", description: "SMART goals, conference selection, online courses, and portfolio documentation.", href: "/blog/cpd-planning-esl-teachers.html", category: "Professional Dev", date: "December 19, 2025" },
  { title: "Adapting Textbooks for the ESL Classroom", description: "Adding, deleting, modifying, and extending textbook activities for your context.", href: "/blog/adapting-textbooks-esl-classroom.html", category: "Materials Dev", date: "December 20, 2025" },
  { title: "Creating Authentic Materials for ESL Teaching", description: "Realia, news articles, menus, and real-world texts with grading techniques.", href: "/blog/creating-authentic-materials-esl.html", category: "Materials Dev", date: "December 21, 2025" },
  { title: "Supplementing Coursebooks — Activities and Resources", description: "When and how to go beyond the book with complementary materials.", href: "/blog/supplementing-coursebooks-activities.html", category: "Materials Dev", date: "December 22, 2025" },
  { title: "Digital Resource Curation for ESL Teachers", description: "Organizing bookmarks, evaluating online resources, and building a teaching library.", href: "/blog/digital-resource-curation-esl.html", category: "Materials Dev", date: "December 23, 2025" },
  { title: "Materials Design Principles for ELT", description: "Tomlinson's principles, task design, sequencing, and piloting new materials.", href: "/blog/materials-design-principles-elt.html", category: "Materials Dev", date: "December 24, 2025" },
  // Phase 16: Pronunciation & Phonology Advanced (5)
  { title: "Teaching Word Stress Patterns to ESL Students", description: "Primary/secondary stress, compound nouns, stress shift rules, and drilling activities.", href: "/blog/teaching-word-stress-patterns-esl.html", category: "Pronunciation", date: "November 25, 2025" },
  { title: "Teaching Rhythm in English Speech — Stress-Timed Language", description: "Stress timing, content vs function words, and rhythm-based practice activities.", href: "/blog/teaching-rhythm-english-speech.html", category: "Pronunciation", date: "November 26, 2025" },
  { title: "Teaching Weak Forms in English — Schwa and Reduced Vowels", description: "Common weak forms, schwa identification, and natural speech listening practice.", href: "/blog/teaching-weak-forms-english.html", category: "Pronunciation", date: "November 27, 2025" },
  { title: "Phonemic Awareness Activities for ESL Learners", description: "Sound discrimination, phoneme segmentation, and minimal pair activities.", href: "/blog/phonemic-awareness-activities-esl.html", category: "Pronunciation", date: "November 28, 2025" },
  { title: "Accent Coaching Techniques for ESL Teachers", description: "Individual coaching, accent modification goals, and intelligibility focus.", href: "/blog/accent-coaching-techniques-esl.html", category: "Pronunciation", date: "November 29, 2025" },
  // Phase 16: Vocabulary Acquisition Advanced (5)
  { title: "Teaching Word Families and Morphology in ESL", description: "Prefixes, suffixes, roots, and productive word-building strategies.", href: "/blog/teaching-word-families-morphology-esl.html", category: "Vocabulary", date: "November 30, 2025" },
  { title: "Phrasal Verbs Teaching Strategies — From Avoidance to Mastery", description: "Particle meaning, context-based teaching, and systematic phrasal verb coverage.", href: "/blog/phrasal-verbs-teaching-strategies.html", category: "Vocabulary", date: "December 1, 2025" },
  { title: "The Lexical Approach in Language Teaching", description: "Chunks, collocations, Lewis's framework, and classroom implementation.", href: "/blog/lexical-approach-language-teaching.html", category: "Vocabulary", date: "December 2, 2025" },
  { title: "Vocabulary Notebook Strategies for ESL Students", description: "Organization systems, example sentences, visual associations, and review cycles.", href: "/blog/vocabulary-notebook-strategies-esl.html", category: "Vocabulary", date: "December 3, 2025" },
  { title: "Teaching Abstract Vocabulary to ESL Students", description: "Concept mapping, context clues, metaphor, and graded definition techniques.", href: "/blog/teaching-abstract-vocabulary-esl.html", category: "Vocabulary", date: "December 4, 2025" },
  // Phase 16: Grammar Teaching Advanced (5)
  { title: "Teaching Aspect in English Grammar — Perfect and Progressive", description: "Aspect vs tense, timeline visuals, and common L1 interference patterns.", href: "/blog/teaching-aspect-english-grammar.html", category: "Grammar", date: "December 5, 2025" },
  { title: "Teaching Modality in English — Must, Might, Could, Should", description: "Epistemic vs deontic modality, probability scale, and modal verb activities.", href: "/blog/teaching-modality-english-esl.html", category: "Grammar", date: "December 6, 2025" },
  { title: "Teaching Relative Clauses to ESL Students", description: "Defining vs non-defining, reduced relatives, and common errors by L1.", href: "/blog/teaching-relative-clauses-esl.html", category: "Grammar", date: "December 7, 2025" },
  { title: "Consciousness-Raising Grammar Tasks for ESL", description: "Discovery-based grammar, noticing activities, and guided induction.", href: "/blog/consciousness-raising-grammar-tasks.html", category: "Grammar", date: "December 8, 2025" },
  { title: "Teaching Determiners and Quantifiers in ESL", description: "Articles, demonstratives, quantifiers — common errors and practice activities.", href: "/blog/teaching-determiners-quantifiers-esl.html", category: "Grammar", date: "December 9, 2025" },
  // Phase 16: Listening Skills Advanced (5)
  { title: "Bottom-Up vs Top-Down Listening Strategies in ESL", description: "Decoding skills, schema activation, and integrated listening lesson design.", href: "/blog/bottom-up-top-down-listening-esl.html", category: "Listening", date: "December 10, 2025" },
  { title: "Teaching Note-Taking from Lectures — ESL Academic Skills", description: "Cornell method, abbreviation systems, and lecture comprehension scaffolding.", href: "/blog/teaching-note-taking-from-lectures.html", category: "Listening", date: "December 11, 2025" },
  { title: "Podcast-Based Listening Lessons for ESL Classes", description: "Podcast selection criteria, pre/while/post activities, and graded tasks.", href: "/blog/podcast-based-listening-lessons-esl.html", category: "Listening", date: "December 12, 2025" },
  { title: "The Dictogloss Technique in ESL Teaching", description: "Procedure, variations, grammar focus, and collaborative reconstruction.", href: "/blog/dictogloss-technique-esl-teaching.html", category: "Listening", date: "December 13, 2025" },
  { title: "Teaching Listening for Gist and Detail — Practical Activities", description: "Gist questions, detail scanning, and graded listening task sequences.", href: "/blog/teaching-listening-for-gist-detail.html", category: "Listening", date: "December 14, 2025" },
  // Phase 16: Young Learners & Teens Advanced (5)
  { title: "Teaching English to Preschoolers — Complete Guide", description: "Routine-based learning, songs, stories, and play-based language exposure.", href: "/blog/teaching-english-preschoolers-guide.html", category: "Young Learners", date: "December 15, 2025" },
  { title: "Total Physical Response (TPR) Activities for Young Learners", description: "Action commands, TPR storytelling, and extended TPR for vocabulary building.", href: "/blog/tpr-total-physical-response-activities.html", category: "Young Learners", date: "December 16, 2025" },
  { title: "Teen Engagement Strategies for ESL Classes", description: "Relevance, autonomy, social media integration, and project-based learning for teens.", href: "/blog/teen-engagement-strategies-esl.html", category: "Young Learners", date: "December 17, 2025" },
  { title: "Content-Based Instruction for Young ESL Learners", description: "Theme-based units, language through content, and cross-curricular planning.", href: "/blog/content-based-instruction-young-learners.html", category: "Young Learners", date: "December 18, 2025" },
  { title: "Teaching Literacy to Young ESL Learners — Phonics and Beyond", description: "Synthetic phonics, sight words, guided reading, and emergent literacy stages.", href: "/blog/teaching-literacy-young-esl-learners.html", category: "Young Learners", date: "December 19, 2025" },
  // Phase 16: Technology Integration Advanced (5)
  { title: "AI-Powered Differentiation in the ESL Classroom", description: "Teacher-reviewed worksheet adaptation, level support, and personalized learning paths with AI.", href: "/blog/ai-powered-differentiation-esl.html", category: "Technology", date: "December 20, 2025" },
  { title: "Using Chatbots for Language Practice — Teacher's Guide", description: "ChatGPT, character.ai, and custom bots for speaking and writing practice.", href: "/blog/using-chatbots-language-practice.html", category: "Technology", date: "December 21, 2025" },
  { title: "Screen-Free Technology Activities for ESL Classes", description: "QR hunts, audio journals, and tech-enhanced activities without screen dependency.", href: "/blog/screen-free-tech-activities-esl.html", category: "Technology", date: "December 22, 2025" },
  { title: "Data-Driven Learning with Corpora in ESL Teaching", description: "Concordance lines, COCA/BNC, and student corpus investigation activities.", href: "/blog/data-driven-learning-esl-corpora.html", category: "Technology", date: "December 23, 2025" },
  { title: "Choosing a Learning Management System for ESL Teaching", description: "Google Classroom, Moodle, Canvas comparison with ESL-specific requirements.", href: "/blog/learning-management-systems-esl.html", category: "Technology", date: "December 24, 2025" },
  // Phase 17: Edooqoo Feature Articles & High-Volume ESL Keywords (30)
  { title: "How to Use AI Flashcards for ESL Vocabulary Review", description: "SM-2-based flashcard review and vocabulary signals for future prep.", href: "/blog/ai-flashcards-vocabulary-esl.html", category: "AI in Education", date: "March 1, 2026" },
  { title: "AI Placement Tests for English Students", description: "Multi-skill CEFR-oriented diagnostics for student profile setup.", href: "/blog/ai-placement-tests-english-students.html", category: "AI in Education", date: "March 2, 2026" },
  { title: "How to Track Student Progress with AI", description: "Progress dashboards, skill signals, and teacher-reviewed next-step planning.", href: "/blog/tracking-student-progress-ai-esl.html", category: "AI in Education", date: "March 3, 2026" },
  { title: "30 Conversation Topics for Adult ESL Students", description: "Curated discussion topics by CEFR level for 1-on-1 and group adult classes.", href: "/blog/conversation-topics-adult-esl-students.html", category: "Activities", date: "March 4, 2026" },
  { title: "End-of-Lesson Reflection Activities for ESL Classes", description: "Exit tickets, self-assessment, and reflection prompts for lesson closure.", href: "/blog/end-of-lesson-reflection-activities-esl.html", category: "Activities", date: "March 5, 2026" },
  { title: "20 Writing Prompts for ESL Students — By Level", description: "Creative and academic writing prompts organized by CEFR level.", href: "/blog/writing-prompts-esl-students-by-level.html", category: "Writing", date: "March 6, 2026" },
  { title: "Error Correction Exercises — Complete ESL Guide", description: "Self-correction, peer correction, and teacher-led error correction activities.", href: "/blog/error-correction-exercises-esl-guide.html", category: "Grammar", date: "March 7, 2026" },
  { title: "How to Get More ESL Students — Marketing Guide", description: "Online marketing, referrals, social media, and local outreach strategies for tutors.", href: "/blog/getting-more-esl-students-marketing.html", category: "Professional Dev", date: "March 8, 2026" },
  { title: "How to Give Homework Feedback That Students Actually Read", description: "Actionable feedback strategies, audio comments, and feedback loops.", href: "/blog/homework-feedback-students-read.html", category: "Homework", date: "March 9, 2026" },
  { title: "Running Live English Lessons Online — Tools and Tips", description: "Platform comparison, engagement techniques, and tech setup for live lessons.", href: "/blog/live-english-lessons-online-tools.html", category: "Online Teaching", date: "March 10, 2026" },
  { title: "Micro-Lessons for Busy Adult ESL Students", description: "15-20 minute focused lessons for professionals with limited study time.", href: "/blog/micro-lessons-busy-adult-esl-students.html", category: "Specialized", date: "March 11, 2026" },
  { title: "Complete Guide to Online Homework for ESL Teachers", description: "Assigning, tracking, and grading homework digitally with AI support.", href: "/blog/online-homework-guide-esl-teachers.html", category: "Homework", date: "March 12, 2026" },
  { title: "Teaching Present Simple vs Present Continuous", description: "Timelines, concept checking, and common errors with practice activities.", href: "/blog/present-simple-vs-continuous-teaching.html", category: "Grammar", date: "March 13, 2026" },
  { title: "Pricing Your Private English Lessons — Complete Guide", description: "Market rates, value-based pricing, packages, and payment strategies.", href: "/blog/pricing-private-english-lessons-guide.html", category: "Professional Dev", date: "March 14, 2026" },
  { title: "Sentence Transformation Exercises for English Grammar Practice", description: "Key word transformations, rephrasing, and exam-style activities.", href: "/blog/sentence-transformation-exercises-english.html", category: "Grammar", date: "March 15, 2026" },
  { title: "How to Share Worksheets with Students Online", description: "Digital sharing methods, link-based access, and student portal integration.", href: "/blog/sharing-worksheets-students-online.html", category: "Technology", date: "March 16, 2026" },
  { title: "How to Create a Student Booking Page for English Lessons", description: "Online scheduling, calendar integration, and automated booking confirmation.", href: "/blog/student-booking-page-english-lessons.html", category: "Technology", date: "March 17, 2026" },
  { title: "Building a Student Portal for Your English Tutoring Business", description: "Centralized access to materials, homework, flashcards, and lesson scheduling.", href: "/blog/student-portal-english-tutoring.html", category: "Technology", date: "March 18, 2026" },
  { title: "How to Teach English to Complete Beginners (A0-A1)", description: "First lessons, survival English, visual aids, and TPR for absolute beginners.", href: "/blog/teaching-english-complete-beginners.html", category: "How to Teach", date: "March 19, 2026" },
  { title: "Teaching English for Customer Service", description: "Phone scripts, complaint handling, and polite language for service industries.", href: "/blog/teaching-english-customer-service.html", category: "ESP", date: "March 20, 2026" },
  { title: "Teaching English for Job Interviews — Activities and Phrases", description: "Common questions, STAR method, and role-play practice for interview prep.", href: "/blog/teaching-english-job-interviews-activities.html", category: "ESP", date: "March 21, 2026" },
  { title: "How to Teach English for Meetings — Phrases and Activities", description: "Meeting vocabulary, chairing language, and negotiation phrases with role-plays.", href: "/blog/teaching-english-meetings-phrases.html", category: "ESP", date: "March 22, 2026" },
  { title: "Teaching English to Senior Learners", description: "Pace adaptation, memory strategies, and age-appropriate materials for older adults.", href: "/blog/teaching-english-senior-learners.html", category: "Specialized", date: "March 23, 2026" },
  { title: "Teaching English Tenses — Complete Guide for ESL Teachers", description: "All 12 tenses with timelines, concept questions, and progressive teaching order.", href: "/blog/teaching-english-tenses-complete-guide.html", category: "Grammar", date: "March 24, 2026" },
  { title: "Teaching Paraphrasing Skills to ESL Students", description: "Synonym substitution, sentence restructuring, and academic integrity.", href: "/blog/teaching-paraphrasing-skills-esl.html", category: "Writing", date: "March 25, 2026" },
  { title: "Teaching Prepositions of Time and Place — ESL Activities", description: "In/on/at rules, visual aids, and error correction for preposition mastery.", href: "/blog/teaching-prepositions-time-place-esl.html", category: "Grammar", date: "March 26, 2026" },
  { title: "How to Teach Reading to ESL Beginners (A1-A2)", description: "Phonics, sight words, graded readers, and comprehension scaffolding for beginners.", href: "/blog/teaching-reading-esl-beginners.html", category: "Reading", date: "March 27, 2026" },
  { title: "Teaching Second Conditional — Activities and Worksheets", description: "Hypothetical situations, if-clause practice, and creative production activities.", href: "/blog/teaching-second-conditional-activities.html", category: "Grammar", date: "March 28, 2026" },
  { title: "Teaching Third Conditional — ESL Activities Guide", description: "Past regrets, mixed conditionals bridge, and contextualized practice.", href: "/blog/teaching-third-conditional-esl.html", category: "Grammar", date: "March 29, 2026" },
  { title: "How to Teach Vocabulary in Context — Methods and Activities", description: "Context clues, text-based vocabulary, and incidental learning strategies.", href: "/blog/teaching-vocabulary-in-context-methods.html", category: "Vocabulary", date: "March 30, 2026" },
  // Phase 18: High-Volume SEO Grammar & Tools (20)
  { title: "Phrasal Verbs Exercises — ESL Worksheets and Activities", description: "Gap-fill, matching, and context-based phrasal verb practice by CEFR level.", href: "/blog/phrasal-verbs-exercises-esl-worksheets.html", category: "Vocabulary", date: "April 1, 2026" },
  { title: "Modal Verbs Exercises for ESL Students — Complete Guide", description: "Can, could, should, must — exercises organized by function and level.", href: "/blog/modal-verbs-exercises-esl-guide.html", category: "Grammar", date: "April 2, 2026" },
  { title: "Free English Lesson Plan Template for ESL Teachers", description: "Downloadable lesson plan framework with timing, objectives, and activity slots.", href: "/blog/english-lesson-plan-template-free.html", category: "Lesson Resources", date: "April 3, 2026" },
  { title: "How to Teach Past Tenses in ESL — Simple, Continuous, Perfect", description: "Timeline visuals, concept checking questions, and progressive tense teaching.", href: "/blog/how-to-teach-past-tenses-esl.html", category: "Grammar", date: "April 4, 2026" },
  { title: "15 Vocabulary Activities for Adult ESL Learners", description: "Engaging vocabulary tasks designed for professional and academic adult students.", href: "/blog/vocabulary-activities-adult-learners.html", category: "Vocabulary", date: "April 5, 2026" },
  { title: "Teaching Comparatives and Superlatives — Activities and Worksheets", description: "Form rules, common errors, and communicative practice for comparison structures.", href: "/blog/teaching-comparative-superlative-esl.html", category: "Grammar", date: "April 6, 2026" },
  { title: "ESL Speaking Assessment Rubric — Free Download and Guide", description: "Criteria-based rubric for fluency, accuracy, pronunciation, and interaction.", href: "/blog/esl-speaking-assessment-rubric.html", category: "Assessment", date: "April 7, 2026" },
  { title: "Teaching Future Tenses in ESL — Will, Going To, Present Continuous", description: "Distinguishing future forms with timelines and contextualized practice.", href: "/blog/teaching-future-tenses-esl-guide.html", category: "Grammar", date: "April 8, 2026" },
  { title: "AI English Worksheet Generator — How It Works in 2026", description: "How AI generates CEFR-aligned worksheets with 29 exercise types in seconds.", href: "/blog/english-worksheet-generator-ai.html", category: "AI in Education", date: "April 9, 2026" },
  { title: "Teaching Question Formation to ESL Students — Activities", description: "Yes/no questions, wh-questions, indirect questions with drilling activities.", href: "/blog/teaching-question-formation-esl.html", category: "Grammar", date: "April 10, 2026" },
  { title: "Best Tools for Online English Tutors in 2026", description: "Platform comparison for scheduling, materials, video, and student management.", href: "/blog/online-english-tutor-tools-2026.html", category: "Technology", date: "April 11, 2026" },
  { title: "Teaching Gerunds and Infinitives — ESL Activities and Rules", description: "Verb patterns, common errors, and communicative activities for gerund/infinitive.", href: "/blog/teaching-gerunds-infinitives-esl.html", category: "Grammar", date: "April 12, 2026" },
  { title: "ESL Writing Assessment — Criteria, Rubrics, and Feedback", description: "Holistic and analytic rubrics for assessing ESL writing with actionable feedback.", href: "/blog/esl-writing-assessment-criteria.html", category: "Assessment", date: "April 13, 2026" },
  { title: "Teaching Phrasal Verbs in Context — Beyond Memorization", description: "Story-based, text-based, and corpus-informed phrasal verb teaching methods.", href: "/blog/teaching-phrasal-verbs-context-esl.html", category: "Vocabulary", date: "April 14, 2026" },
  { title: "How to Give an English Level Test — Placement Guide for Tutors", description: "Designing and administering placement tests with CEFR alignment.", href: "/blog/how-to-give-english-level-test.html", category: "Assessment", date: "April 15, 2026" },
  { title: "Teaching English Word Order — Activities for All Levels", description: "SVO patterns, adverb placement, and inversion with scaffolded activities.", href: "/blog/teaching-word-order-english-esl.html", category: "Grammar", date: "April 16, 2026" },
  { title: "Adult ESL Lesson Ideas by CEFR Level — A1 to C2", description: "Ready-to-use lesson concepts organized by proficiency level for adult learners.", href: "/blog/adult-esl-lesson-ideas-by-level.html", category: "Lesson Resources", date: "April 17, 2026" },
  { title: "English Homework Ideas That Students Actually Complete", description: "Motivating homework formats that increase completion rates and learning outcomes.", href: "/blog/english-homework-ideas-that-work.html", category: "Homework", date: "April 18, 2026" },
  { title: "Teaching Linking Expressions — However, Moreover, Furthermore", description: "Discourse markers for cohesion in academic and professional writing.", href: "/blog/teaching-linking-expressions-esl.html", category: "Writing", date: "April 19, 2026" },
  { title: "How to Run an ESL Business Online — Complete 2026 Guide", description: "Business setup, pricing, marketing, tools, and scaling strategies for online tutors.", href: "/blog/how-to-run-esl-business-online.html", category: "Professional Dev", date: "April 20, 2026" },
];

const Blog = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  // v6.9.22 — Keep only posts whose .html file exists in public/blog/.
  // Eliminates ~50 dangling links to deleted files (the original 404 source).
  const validHrefs = useMemo(() => new Set(AUTO_BLOG_POSTS.map(p => p.url)), []);
  const livePosts = useMemo(() => blogPosts.filter(p => validHrefs.has(p.href)), [validHrefs]);

  // Add any file that exists but wasn't in the curated list, using auto-extracted meta.
  const curatedHrefs = useMemo(() => new Set(blogPosts.map(p => p.href)), []);
  const orphanFromFiles = useMemo(() =>
    AUTO_BLOG_POSTS
      .filter(p => !curatedHrefs.has(p.url))
      .map(p => ({ title: p.title, description: p.description, href: p.url, category: p.category, date: p.date || '2026-01-01' })),
    [curatedHrefs]
  );
  const allPosts = useMemo(() => [...livePosts, ...orphanFromFiles], [livePosts, orphanFromFiles]);

  const categories = [...new Set(allPosts.map(p => p.category))];

  const blogLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Edooqoo Blog",
    description: SEO_META.blog.description,
    url: "https://edooqoo.com/blog",
    publisher: { "@type": "Organization", name: "Edooqoo", url: "https://edooqoo.com" },
    blogPost: allPosts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://edooqoo.com${p.href}`,
      datePublished: p.date,
    })),
  };

  // v6.9.1 — Internal linking widget for newest posts. GSC reports newly
  // published blog posts as "Discovered – currently not indexed" because
  // sitemap lists them but no on-site link points to them. Showing the
  // 8 most recent posts at the top of /blog gives Googlebot a fresh
  // internal link path on the next crawl.
  const recentPosts = [...allPosts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <PageSeo {...SEO_META.blog} jsonLd={blogLd} />
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</Link>
            <Link to="/signup" state={fromState} className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity">Sign Up Free</Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-4">Edooqoo Blog</h1>
        <p className="text-lg text-muted-foreground mb-12">
          Practical articles for English teachers — AI teaching tips, worksheet guides, CEFR assessment, and ESL/EFL best practices.
        </p>

        <section className="mb-12 rounded-2xl border border-border bg-secondary/40 p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
            <span className="text-xs text-muted-foreground">Updated {recentPosts[0]?.date}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentPosts.map(post => (
              <PostLink
                key={post.href}
                href={post.href}
                className="block rounded-lg border bg-card p-3 hover:shadow-md hover:border-violet-200 transition-all"
              >
                <div className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold mb-1">{post.category}</div>
                <div className="font-medium text-foreground text-sm leading-snug mb-1">{post.title}</div>
                <div className="text-xs text-muted-foreground">{post.date}</div>
              </PostLink>
            ))}
          </div>
        </section>

        {categories.map(cat => (
          <section key={cat} className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">{cat}</h2>
            <div className="space-y-4">
              {allPosts.filter(p => p.category === cat).map(post => (
                <PostLink
                  key={post.href}
                  href={post.href}
                  className="block rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{post.title}</h3>
                      <p className="text-sm text-muted-foreground">{post.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{post.date}</span>
                  </div>
                </PostLink>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default Blog;
