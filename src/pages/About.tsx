
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { faqItems } from '@/constants/faqItems';
import GlobalFooter from '@/components/GlobalFooter';
import { BookOpen, ClipboardCheck, Brain, Calendar, GraduationCap, Users, BarChart3, ChevronRight } from 'lucide-react';

const About = () => {
  useEffect(() => {
    document.title = 'About Edooqoo — AI Worksheet Generator for English Teachers';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'Learn how Edooqoo helps English teachers create personalized worksheets, manage students, assign homework with AI grading, and track progress. 29 exercise types, CEFR A1-C2.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</Link>
            <Link to="/signup" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity">Sign Up Free</Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* H1 */}
        <h1 className="text-4xl font-bold text-foreground mb-6">
          Edooqoo — AI Worksheet Generator for English Teachers
        </h1>

        {/* What is Edooqoo */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">What is Edooqoo?</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Edooqoo is an AI-powered platform built specifically for English teachers. It generates personalized worksheets tailored to each student in under 2 minutes, with 29 exercise types covering all CEFR levels from A1 to C2. Unlike generic worksheet libraries, Edooqoo creates unique, custom content every time — based on your student's level, interests, learning goals, and actual skill data.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            But Edooqoo is more than a worksheet generator. It's a complete teaching ecosystem: assign homework with automatic AI grading, create smart flashcards with spaced repetition, schedule lessons with Google Calendar sync, run placement tests, and track student progress at the nano-skill level. Your students get their own portal — the Student Hub — where they study independently.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Edooqoo is used by private English tutors, ESL/EFL instructors, Business English coaches, language school teachers, online English teachers, and corporate language trainers worldwide. It works entirely in the browser — no downloads, no installations.
          </p>
        </section>

        {/* Who is it for */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Who is Edooqoo For?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Private English Tutors', desc: 'Generate personalized worksheets for each student. Track individual progress and assign homework between lessons.' },
              { title: 'Language School Teachers', desc: 'Quickly create varied materials for different class levels. Save hours on material preparation and homework grading.' },
              { title: 'Business English Coaches', desc: 'Create industry-specific worksheets for corporate clients. Track professional development with detailed skill metrics.' },
              { title: 'Online ESL/EFL Teachers', desc: 'Use Live Session mode for real-time online lessons. Manage bookings across time zones with the lesson calendar.' },
              { title: 'Exam Preparation Tutors', desc: 'Select exercise types matching exam formats. Identify weak areas with nano-skill progress tracking.' },
              { title: 'Corporate Language Trainers', desc: 'Schedule sessions, generate company-specific content, and provide progress reports to HR departments.' },
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
              { icon: BookOpen, title: 'AI Worksheet Generator', desc: 'Generate complete, personalized worksheets in under 2 minutes. Choose from 29 exercise types across 3 categories (basic, audio, picture). The AI uses student context — level, interests, skill gaps — to create unique content every time. Download as HTML or PDF, share via permanent link, or use in live sessions.', bullets: ['29 exercise types including audio and picture exercises', 'CEFR levels A1 through C2', 'AI personalizes content using student learning data', 'Download as HTML/PDF or share interactive link'] },
              { icon: ClipboardCheck, title: 'Homework System', desc: 'Assign any worksheet or specific exercises as homework. Students complete exercises interactively online. AI automatically grades open-ended answers like paraphrasing, sentence transformation, and discussion questions.', bullets: ['Automatic AI grading of open-ended answers', 'Set deadlines with email reminders', 'Teacher review with comments per exercise', 'Track completion status in real-time'] },
              { icon: Brain, title: 'Smart Flashcards', desc: 'Create flashcard sets from worksheet vocabulary or manually. Students study using the SM-2 spaced repetition algorithm for optimal long-term retention.', bullets: ['SM-2 spaced repetition algorithm', 'Auto-generate from worksheet vocabulary', 'Bidirectional study mode', 'Accessible via Student Hub'] },
              { icon: Calendar, title: 'Lesson Calendar & Booking', desc: 'Teachers set availability, students book via a public booking page. Supports one-time and recurring weekly bookings with Google Calendar two-way sync.', bullets: ['Public booking page with shareable link', 'Google Calendar sync + Google Meet auto-generation', 'Recurring weekly bookings', 'Payment tracking per lesson'] },
              { icon: GraduationCap, title: 'Welcome Placement Test', desc: 'A comprehensive 49-question AI-powered assessment covering grammar, vocabulary, reading, listening, and speaking. AI creates a detailed Learning Profile with one of 4 Learning Paths.', bullets: ['49 questions across 5 skill categories', 'AI-analyzed Learning Profile', '4 Learning Paths: Comfort, Guided, Accelerated, Target', 'CEFR level estimation with confidence score'] },
              { icon: Users, title: 'Student Hub Portal', desc: 'A dedicated portal for students at edooqoo.com/my. Students enter their email, select their teacher, and access worksheets, flashcards, homework, and lesson booking — all without needing a teacher account.', bullets: ['Personal dashboard with quick stats', 'Browse and study flashcard sets', 'Complete homework assignments', 'Book and manage lessons with Google Calendar sync'] },
              { icon: BarChart3, title: 'Student Progress Tracking (DSLM)', desc: 'The Dynamic Student Learning Model tracks skills at the nano-skill level with CEFR tags. Every interaction updates metrics automatically. Teachers see mastery trends and AI-generated suggestions.', bullets: ['Nano-skill mastery tracking (e.g., B1.grammar.present_perfect)', 'Trend detection: improving, stable, declining', 'Category view: grammar, vocabulary, speaking, listening, reading, writing', 'AI suggestions for future worksheets'] },
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
              { step: '1', title: 'Add Your Student', desc: 'Enter student name, email, and English level. Optionally send a Welcome Test to assess their abilities.' },
              { step: '2', title: 'Generate a Worksheet', desc: 'Select topic, level, exercise types, and learning goals. AI generates a complete worksheet in under 2 minutes.' },
              { step: '3', title: 'Share with Your Student', desc: 'Use the permanent link, assign as homework, or use in a live session. Students complete exercises interactively online.' },
              { step: '4', title: 'Track Progress', desc: 'View nano-skill mastery trends, review AI-graded homework, study flashcards, and get AI suggestions for the next lesson.' },
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
                  ['AI homework grading', '✅', '❌', '❌', '❌'],
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
          <Link to="/signup" className="bg-primary text-primary-foreground px-8 py-3 rounded-md text-lg font-semibold hover:opacity-90 transition-opacity">
            Sign Up Free
          </Link>
        </section>
      </main>
    </div>
  );
};

export default About;
