import React from 'react';
import { Link } from 'react-router-dom';
import SeoLandingLayout from '@/components/seo/SeoLandingLayout';

const collectionLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'ESL Worksheets — AI-Generated for Adult Learners',
  description: 'AI-generated, fully personalized ESL worksheets for adult learners across CEFR A1-C2, with 29 exercise types and AI homework grading.',
  url: 'https://edooqoo.com/esl-worksheets',
};

const EslWorksheets = () => (
  <SeoLandingLayout
    seo={{
      title: 'ESL Worksheets — AI-Generated for Adult Learners',
      description: 'Create personalized ESL worksheets with 29 exercise types, CEFR A1-C2 labels, business English, and IELTS prep workflows. Free to start.',
      path: '/esl-worksheets',
      extraJsonLd: collectionLd,
    }}
    h1="ESL Worksheets — AI-Generated for Adult Learners"
    lead="Edooqoo creates personalized ESL worksheets for adult learners through a structured teacher workflow: 29 exercise types, CEFR A1 through C2 labels, Business English, IELTS, conversation, grammar, and vocabulary."
    problems={[
      'Static PDF libraries (esl-brains, teach-this, Daves ESL Cafe) give you the same generic worksheet every adult learner sees — zero personalization to a banker preparing for an IELTS interview vs. a software engineer needing meeting English.',
      'Manual worksheet creation in Word or Google Docs eats 60–90 minutes per lesson. Multiply by 10 students and you lose your evenings.',
      'Adult learners disengage instantly with school-style content — fill-in-the-blanks about Tom and his cat, kids vocabulary, childish images. They quit lessons over it.',
    ]}
    solutionHeading="How Edooqoo solves it"
    solutions={[
      { title: '60-second generation', body: 'Type the topic, pick CEFR level, choose exercise types. Edooqoo generates the full worksheet — instructions, examples, answer keys — in under a minute.' },
      { title: 'Personalized to one student', body: 'The AI uses the student profile (job, goals, weaknesses from the placement test) so the IELTS-prep banker gets banking scenarios, the engineer gets stand-up meeting role-plays.' },
      { title: 'Andragogical by design', body: 'Built with Martha (10 years adult ESL). All examples reference adult professional or personal life — never kids, never school assemblies.' },
    ]}
    listHeading="8 worksheet types ESL teachers generate most"
    listIntro="Every type below is one of the 29 exercise types in Edooqoo. Each is editable after generation and can be assigned as homework with AI grading."
    list={[
      { title: 'Business English meeting role-plays', body: 'Stand-up meetings, salary negotiations, client objections. CEFR B1-C1. Pairs with speaking exercises.', href: '/exercise-types' },
      { title: 'Grammar gap-fills with distractors', body: 'Mixed conditionals, reported speech, articles. Distractor logic chosen so the wrong answer is plausible.', href: '/exercise-types' },
      { title: 'IELTS Reading passages with questions', body: 'Authentic-style 350-700 word passages, true/false/not given + multiple choice.', href: '/exercise-types' },
      { title: 'Listening transcripts with Whisper TTS audio', body: 'Natural English audio generated on-demand. CEFR-graded vocabulary in the script.', href: '/exercise-types' },
      { title: 'Vocabulary in context', body: 'New lexis embedded in 6 short paragraphs the learner must complete from a word bank.', href: '/exercise-types' },
      { title: 'Picture description prompts', body: 'AI-generated images for speaking and writing prompts. Useful for FCE/CAE speaking part 2.', href: '/exercise-types' },
      { title: 'Email writing with model answer', body: 'Brief + model email + grading rubric. AI grades the open answer when assigned as homework.', href: '/exercise-types' },
      { title: 'Pronunciation minimal pairs', body: 'ship/sheep, live/leave. Audio plays each pair. Tracks per-phoneme weakness over time.', href: '/exercise-types' },
    ]}
    body={
      <>
        <h2 className="text-xl font-bold text-foreground mt-0">Why generic ESL worksheets fail adult learners</h2>
        <p>Adult ESL students pay $30–80 per lesson and they audit value lesson by lesson. The moment a worksheet feels school-like — cartoon clipart, drills about Susan and her dog, vocabulary about playgrounds — they mentally check out. They booked you because they need English for a promotion, a visa interview, or a meeting next week. Static worksheet libraries cannot deliver that context. The same fill-in-the-blank on the present perfect goes to a 17-year-old high schooler and a 45-year-old M&A lawyer.</p>
        <p>Edooqoo's worksheet generator takes the student profile — their job, their goals, their identified weak skills from the placement test — and produces a worksheet that references their actual world. A banker drilling the present perfect gets sentences about quarterly reports and client onboarding. A software engineer drilling the same grammar point gets sentences about deployments and code reviews. The grammar focus is identical; the content is theirs.</p>
        <h2 className="text-xl font-bold text-foreground">How the AI personalization layer works</h2>
        <p>Every worksheet generation pulls four data points: CEFR level, lesson topic, grammar focus, and the student's Learning Profile. The Learning Profile is built from the 49-question <Link to="/features/placement-test" className="text-primary hover:underline">Welcome Test</Link>, ongoing exercise results, and teacher notes. The AI then writes exercise content that targets weaknesses without re-drilling already-mastered material. This is the DSLM (Dynamic Student Learning Model) layer — see <Link to="/features/dslm" className="text-primary hover:underline">DSLM</Link>.</p>
        <p>After generation, every worksheet has a permanent shareable link. Send it to the student before the lesson, use it live on screen-share, or assign specific exercises as homework with deadlines. AI grades closed AND open-answer exercises automatically — including emails, short essays, and speaking responses transcribed via Whisper. Teachers review and override grades in 30 seconds per assignment.</p>
        <h2 className="text-xl font-bold text-foreground">Pricing for ESL worksheet generation</h2>
        <p>The Free plan includes 2 worksheets and unlimited students — enough to test the generator with one student. Side-Gig ($9/month) gives 15 worksheets per month, suitable for a tutor with 5-10 weekly students. Full-Time (from $19/month) gives 30-90 worksheets per month for full-time teachers. Every plan includes all 29 exercise types, AI homework grading, flashcards with SM-2 spaced repetition, and the Student Hub portal. See full <Link to="/pricing" className="text-primary hover:underline">pricing</Link>.</p>
      </>
    }
    faqs={[
      { question: 'Can I edit worksheets after generation?', answer: 'Yes. Every generated worksheet is fully editable — change instructions, swap exercises, regenerate individual sections, or add your own. The worksheet stays at its permanent shareable link.' },
      { question: 'Do students need to install anything?', answer: 'No. Students open the worksheet link in any browser. Interactive completion, audio playback, image rendering, and homework submission all work without an account or app.' },
      { question: 'How is this different from ChatGPT for worksheets?', answer: 'ChatGPT gives raw text. Edooqoo gives 29 structured exercise types with answer keys, distractors, audio, images, AI grading, student progress tracking, and shareable links — all integrated.' },
      { question: 'Is it free to start?', answer: 'Yes. The Free plan includes 2 worksheets, unlimited students, all 29 exercise types, and AI homework grading. No credit card required to start.' },
    ]}
  />
);

export default EslWorksheets;
