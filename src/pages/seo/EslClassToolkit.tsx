import React from 'react';
import { Link } from 'react-router-dom';
import SeoLandingLayout from '@/components/seo/SeoLandingLayout';

const collectionLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'ESL Class Toolkit — Materials, Plans, Activities',
  description: 'Complete ESL class toolkit: lesson plan templates, AI worksheet generator, placement test, flashcards. Designed for 1-on-1 and small group adult classes.',
  url: 'https://edooqoo.com/resources/esl-class-toolkit',
};

const EslClassToolkit = () => (
  <SeoLandingLayout
    seo={{
      title: 'ESL Class Toolkit — Materials, Plans, Activities',
      description: 'Complete ESL class toolkit: lesson plan templates, worksheet generator, placement test, flashcards. For 1-on-1 and small group classes.',
      path: '/resources/esl-class-toolkit',
      extraJsonLd: collectionLd,
    }}
    h1="ESL Class Toolkit — Materials, Plans, Activities"
    lead="Everything you need to run an ESL class for adult learners: placement test, lesson plan templates, worksheet generator, homework engine, vocabulary flashcards, and progress tracking. Designed for 1-on-1 and small groups (2-6 learners)."
    problems={[
      'Free ESL resource sites give you isolated PDFs with no system — no placement test, no progress tracking, no homework follow-up.',
      'Paid ESL coursebooks (Headway, Outcomes, Business Result) lock you into a fixed syllabus that does not adapt to individual learner needs.',
      'Building your own ESL system from scratch with Google Docs and Quizlet takes 40+ hours of setup and falls apart by month 3.',
    ]}
    solutionHeading="Five components every ESL class needs"
    solutions={[
      { title: 'Placement test', body: '49-question Welcome Test producing CEFR estimation, skill radar, and personalized Learning Path.' },
      { title: 'Worksheets', body: '29 exercise types generated in 60 seconds, personalized to each learner profile.' },
      { title: 'Homework with grading', body: 'Assign exercises with deadlines. AI grades open + closed answers overnight.' },
    ]}
    listHeading="The complete ESL class toolkit"
    listIntro="Each component links to its dedicated page. Start with the placement test, generate the first worksheet, assign homework, track DSLM metrics."
    list={[
      { title: 'Welcome Test (49-question placement)', body: 'Grammar, vocabulary, reading, listening, speaking. Whisper TTS for audio sections. Outputs a Learning Profile with CEFR estimation and identified weaknesses.', href: '/features/placement-test' },
      { title: 'Worksheet generator (29 exercise types)', body: '20 basic + 5 audio + 4 picture exercises. CEFR A1-C2. Generated in 60 seconds with student personalization.', href: '/exercise-types' },
      { title: 'Lesson plan templates', body: 'Use Edooqoo worksheets as the lesson plan. Each worksheet doubles as material + structure for a 60-90 minute class.', href: '/blog/english-games-for-learners' },
      { title: 'Homework engine with AI grading', body: 'Select exercises, set deadline, AI grades on submission. Teacher review in 30 seconds. Email reminders automated.', href: '/features/homework' },
      { title: 'Vocabulary flashcards (SM-2 spaced repetition)', body: 'Auto-generated from worksheet vocabulary. Students review in Student Hub. Mastery feeds back into DSLM.', href: '/features/flashcards' },
      { title: 'Progress tracking (DSLM)', body: 'Nano-skill metrics updated after every exercise. Mastery trends, gap identification, next-lesson suggestions.', href: '/features/dslm' },
      { title: 'Student Hub portal', body: 'Students access worksheets, homework, flashcards, lesson recordings in one place. No account, no app install.', href: '/features/student-hub' },
      { title: 'Calendar + booking + Stripe', body: 'Public booking page. Google Calendar sync. Stripe payments. Vacation blocks. Email reminders.', href: '/features/calendar' },
    ]}
    body={
      <>
        <h2 className="text-xl font-bold text-foreground mt-0">Why most ESL class toolkits fail</h2>
        <p>The internet has thousands of free ESL PDFs but no system to assemble them into a coherent class. The teacher ends up gluing PDFs together in Google Docs, manually tracking which student saw which exercise, manually grading homework over WhatsApp, and rebuilding flashcards in Quizlet. By month 3 the system collapses and the teacher reverts to ad-hoc lesson prep.</p>
        <p>Edooqoo replaces the toolkit with one workflow: placement test produces the Learning Profile, the Profile drives worksheet generation, worksheets become lesson material AND homework, homework grading updates progress metrics, metrics inform the next worksheet. The loop closes itself with no manual tracking.</p>
        <h2 className="text-xl font-bold text-foreground">Toolkit for 1-on-1 vs small groups (2-6 learners)</h2>
        <p>1-on-1: full personalization. Every worksheet targets the individual Learning Profile. Homework grading and DSLM tracking work per-student. This is the optimal use case.</p>
        <p>Small group (2-6): generate one worksheet at the groups average CEFR level. Run live exercises during the lesson. Assign homework individually (each learner gets the same worksheet but progress tracking stays per-student). DSLM continues to track each learner separately.</p>
        <h2 className="text-xl font-bold text-foreground">How to run a class start to finish</h2>
        <p>Week 0: send Welcome Test, review Learning Profile. Week 1 lesson: generate worksheet targeting the lowest-mastery skill from the radar. Live: work through 4-6 exercises on screen-share. End of lesson: assign 2-3 unused exercises as homework, 5-day deadline. Day +1: AI grading complete, student reviews errors. Week 2 lesson: review DSLM dashboard (30 seconds), generate new worksheet targeting the next priority skill. Loop.</p>
        <p>For deeper background see our <Link to="/glossary" className="text-primary hover:underline">ELT glossary</Link>, the <Link to="/how-it-works" className="text-primary hover:underline">complete How-It-Works guide</Link>, and the <Link to="/esl-worksheets" className="text-primary hover:underline">ESL worksheets landing page</Link>.</p>
      </>
    }
    faqs={[
      { question: 'Is this for kids or adults?', answer: 'Adults only. Every component is designed andragogically — vocabulary, scenarios, and tone target adult learners.' },
      { question: 'Does this replace coursebooks like Headway or Outcomes?', answer: 'Yes for 1-on-1 tutoring. For institutional teaching alongside a coursebook, Edooqoo generates personalized supplementary material per learner.' },
      { question: 'Can I export materials offline?', answer: 'Yes. Every worksheet exports to HTML or PDF for in-person printing. The Student Hub remains online for digital submission.' },
      { question: 'Is the toolkit free?', answer: 'The Free plan includes the full toolkit with 2 worksheet generations. Paid plans add volume (15-90 worksheets/month). All features available on all plans.' },
    ]}
    ctaTitle="Run your full ESL class on one platform"
    ctaBody="Placement test, worksheets, homework, flashcards, progress tracking — included on the Free plan. Sign up in 30 seconds."
  />
);

export default EslClassToolkit;