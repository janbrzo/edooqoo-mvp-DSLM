
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { faqItems } from '@/constants/faqItems';
import GlobalFooter from '@/components/GlobalFooter';
import { BookOpen, ClipboardCheck, Brain, Calendar, GraduationCap, Users, BarChart3, ChevronRight } from 'lucide-react';
import { PageSeo, buildFaqPageLd } from '@/components/seo/PageSeo';
import { SEO_META } from '@/constants/seoMeta';

const About = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  return (
    <div className="min-h-screen bg-background">
      <PageSeo {...SEO_META.about} jsonLd={buildFaqPageLd(faqItems)} />
      {/* Header */}
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
        {/* H1 */}
        <h1 className="text-4xl font-bold text-foreground mb-6">
          Edooqoo — 1-Minute Prep for 1:1 English Teachers
        </h1>

        {/* What is Edooqoo */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">What is Edooqoo?</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Edooqoo is a 1-Minute Prep system built for 1:1 English teachers. It helps teachers move recurring weekly prep toward one focused minute per student by combining student profile, goals, Welcome Test context, homework, flashcard progress, live lesson signals, calendar rhythm, and DSLM nano-skill evidence.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The worksheet generator remains a core output layer. After the teacher chooses or confirms the next teaching focus, Edooqoo generates editable worksheets with 29 exercise types across CEFR A1-C2, including audio and picture-capable exercises where applicable.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Edooqoo is used by private English tutors, ESL/EFL instructors, Business English coaches, language-school teachers, online English teachers, and corporate language trainers. It works in the browser and keeps teacher review, editing, and lesson decisions in the teacher's hands.
          </p>
        </section>

        {/* Who is it for */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Who is Edooqoo For?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Private English Tutors', desc: 'Build per-student context, generate targeted worksheets, and use homework or flashcards to strengthen the next prep cycle.' },
              { title: 'Language School Teachers', desc: 'Create varied English materials while keeping student goals, worksheet history, and review signals connected.' },
              { title: 'Business English Coaches', desc: 'Prepare workplace-specific lessons from student goals, professional context, and recurring performance signals.' },
              { title: 'Online ESL/EFL Teachers', desc: 'Use live worksheet sessions, Student Hub, and calendar workflows to keep online 1:1 lessons organized.' },
              { title: 'Exam Preparation Tutors', desc: 'Select exercise types that match exam skills while using student context to decide what needs review next.' },
              { title: 'Corporate Language Trainers', desc: 'Schedule sessions, generate company-specific content, and maintain continuity across professional learners.' },
            ].map((persona) => (
              <div key={persona.title} className="border rounded-lg p-4 bg-card">
                <h3 className="font-semibold text-foreground mb-1">{persona.title}</h3>
                <p className="text-sm text-muted-foreground">{persona.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Features</h2>
          <div className="space-y-8">
            {[
              { icon: Brain, title: '1-Minute Prep + DSLM', desc: 'Build student context once, then use DSLM nano-skill evidence and teacher review to move weekly prep toward one focused minute per recurring student.', bullets: ['Student profile, goals, Welcome Test, and observations', 'Next-step suggestions before worksheet generation', 'Teacher chooses, edits, and approves direction', 'Best with recurring 1:1 adult English students'] },
              { icon: BookOpen, title: 'Worksheet Generator Output Layer', desc: 'Generate complete, editable worksheets after the teacher chooses or confirms the next focus. Choose from 29 exercise types across basic, audio, and picture categories.', bullets: ['29 exercise types including audio and picture exercises', 'CEFR levels A1 through C2', 'Student context can inform generated material', 'Download as HTML/PDF or share interactive link'] },
              { icon: ClipboardCheck, title: 'Homework System', desc: 'Assign any worksheet or specific exercises as homework. Students complete exercises interactively online. AI can pre-evaluate supported open-ended answers for teacher review.', bullets: ['AI-assisted review for supported answers', 'Set deadlines with email reminders', 'Teacher review with comments per exercise', 'Homework results can feed the next prep cycle'] },
              { icon: Brain, title: 'Smart Flashcards', desc: 'Create flashcard sets from worksheet vocabulary or manually. Students study using SM-2 scheduling logic, and review activity can become vocabulary context for future prep.', bullets: ['SM-2 spaced repetition scheduling logic', 'Auto-generate from worksheet vocabulary', 'Bidirectional study mode', 'Accessible via Student Hub'] },
              { icon: Calendar, title: 'Lesson Calendar & Booking', desc: 'Teachers set availability, students book via a public booking page. Supports one-time and recurring weekly bookings with Google Calendar two-way sync.', bullets: ['Public booking page with shareable link', 'Google Calendar sync + Google Meet auto-generation', 'Recurring weekly bookings', 'Payment tracking per lesson'] },
              { icon: GraduationCap, title: 'Welcome Placement Test', desc: 'A 49-question CEFR-oriented diagnostic covering grammar, vocabulary, reading, listening, and speaking. Results become profile input and a DSLM starting point for teacher review.', bullets: ['49 questions across 5 skill categories', 'AI-analyzed Learning Profile', '4 Learning Paths: Comfort, Guided, Accelerated, Target', 'CEFR level estimation with confidence score'] },
              { icon: Users, title: 'Student Hub Portal', desc: 'A dedicated portal for students at edooqoo.com/my. Students enter their email, select their teacher, and access worksheets, flashcards, homework, and lesson booking without needing a teacher account.', bullets: ['Personal dashboard with quick stats', 'Browse and study flashcard sets', 'Complete homework assignments', 'Supported activity can add learning signals'] },
              { icon: BarChart3, title: 'Student Progress Tracking (DSLM)', desc: 'The Dynamic Student Learning Model organizes available signals at the nano-skill level with CEFR tags. Teachers see mastery trends and AI-generated suggestions for future worksheets.', bullets: ['Nano-skill mastery tracking (e.g., B1.grammar.present_perfect)', 'Trend detection: improving, stable, declining', 'Category view: grammar, vocabulary, speaking, listening, reading, writing', 'Teacher-reviewed suggestions for future worksheets'] },
            ].map(({ icon: Icon, title, desc, bullets }) => (
              <div key={title} className="border rounded-lg p-6 bg-card">
                <div className="flex items-start gap-3 mb-3">
                  <Icon className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                </div>
                <p className="text-muted-foreground mb-3 leading-relaxed">{desc}</p>
                <ul className="space-y-1">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0 text-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Exercise Types */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">All 29 Exercise Types</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">📝 Basic Exercises (20 types)</h3>
              <p className="text-muted-foreground leading-relaxed">
                Reading Comprehension, Fill in the Blanks, Multiple Choice, True/False Questions, Matching Exercise, Dialogue Practice, Answer Questions, Discussion Questions, Error Correction, Odd One Out, Matching Halves, Word Order, Gap Text (Cloze), Negative Prefixes, Categorization, Complete Word, Paraphrasing, Sentence Transformation, Synonyms Matching, Antonyms Matching.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">🎧 Audio Exercises (5 types)</h3>
              <p className="text-muted-foreground leading-relaxed">
                Listening Comprehension, Fill in the Blanks (Audio), Multiple Choice (Audio), True/False (Audio), Answer Questions (Audio). All audio is AI-generated with natural-sounding speech.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">🖼️ Picture Exercises (4 types)</h3>
              <p className="text-muted-foreground leading-relaxed">
                Describe Picture, Multiple Choice (Picture), True/False (Picture), Answer Questions (Picture). Images are AI-generated to match the lesson topic.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { step: '1', title: 'Add Your Student', desc: 'Enter student details, CEFR estimate, goals, and known lesson context. Optionally send a Welcome Test.' },
              { step: '2', title: 'Review Next-Step Context', desc: 'Use profile, goals, DSLM nano-skill evidence, homework, flashcard progress, and teacher observations to choose the next focus.' },
              { step: '3', title: 'Generate the Worksheet', desc: 'Create an editable worksheet from the confirmed focus, then review and adjust before teaching or assigning.' },
              { step: '4', title: 'Strengthen the Next Prep Cycle', desc: 'Use homework, flashcards, live work, and teacher review to build more context for the next recurring prep.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{step}</span>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Pricing Overview</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { plan: 'Free', price: '$0', features: ['2 free worksheets', 'All 29 exercise types', 'Online preview'] },
              { plan: 'Side-Gig', price: '$9/mo', features: ['15 worksheets/month', 'Homework + Flashcards', 'Lesson Calendar', 'Student Hub'] },
              { plan: 'Full-Time', price: 'From $19/mo', features: ['30-90 worksheets/month', 'All features included', 'Priority support', 'Rollover tokens'] },
            ].map(({ plan, price, features }) => (
              <div key={plan} className="border rounded-lg p-4 bg-card text-center">
                <h3 className="font-semibold text-foreground mb-1">{plan}</h3>
                <p className="text-2xl font-bold text-primary mb-3">{price}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {features.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center mt-4">
            <Link to="/pricing" className="text-primary hover:underline">View full pricing details →</Link>
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqItems.map((item) => (
              <details key={item.question} className="border rounded-lg bg-card group">
                <summary className="p-4 cursor-pointer font-medium text-foreground hover:text-primary transition-colors">
                  {item.question}
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Alternatives */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Edooqoo vs Alternatives</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-foreground">Feature</th>
                  <th className="text-center p-3 text-primary font-bold">Edooqoo</th>
                  <th className="text-center p-3 text-muted-foreground">ISLCollective</th>
                  <th className="text-center p-3 text-muted-foreground">Liveworksheets</th>
                  <th className="text-center p-3 text-muted-foreground">BusyTeacher</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ['AI-generated worksheets', '✅', '❌', '❌', '❌'],
                  ['29 exercise types', '✅', 'Varies', 'Limited', 'Varies'],
                  ['AI-assisted homework review', '✅', '❌', '❌', '❌'],
                  ['Student progress tracking', '✅', '❌', 'Basic', '❌'],
                  ['Flashcards (SM-2)', '✅', '❌', '❌', '❌'],
                  ['Lesson calendar', '✅', '❌', '❌', '❌'],
                  ['Student portal', '✅', '❌', '❌', '❌'],
                  ['Placement test', '✅', '❌', '❌', '❌'],
                  ['Per-student personalization', '✅', '❌', '❌', '❌'],
                ].map(([feature, ...vals]) => (
                  <tr key={feature} className="border-b">
                    <td className="p-3 text-foreground">{feature}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="text-center p-3">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-8 border rounded-lg bg-card mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Ready to Try Edooqoo?</h2>
          <p className="text-muted-foreground mb-6">Sign up free and get 2 worksheets to start.</p>
          <Link to="/signup" state={fromState} className="bg-primary text-primary-foreground px-8 py-3 rounded-md text-lg font-semibold hover:opacity-90 transition-opacity">
            Sign Up Free
          </Link>
        </section>
      </main>
    </div>
  );
};

export default About;
