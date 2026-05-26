
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const steps = [
  { number: 1, title: "Sign Up for Free", description: "Create your Edooqoo account in 30 seconds. No credit card required. You receive 2 free tokens to generate your first worksheets immediately.", benefits: ["Free account with 2 worksheet tokens", "All 29 exercise types available", "No installation — works in your browser"] },
  { number: 2, title: "Add Your Student", description: "Add your first student by entering their name, email, and estimated English level (CEFR A1-C2). You can add unlimited students on any plan.", benefits: ["Unlimited students on all plans", "Student profiles store learning preferences", "Each student gets personalized content"] },
  { number: 3, title: "Send the Welcome Test", description: "Optionally send a 49-question AI placement test covering grammar, vocabulary, reading, listening, and speaking. The AI creates a detailed Learning Profile with skill scores, strengths, weaknesses, and a recommended Learning Path.", benefits: ["49-question comprehensive assessment", "AI-generated Learning Profile", "4 Learning Paths: Comfort, Guided, Accelerated, Target"] },
  { number: 4, title: "Review the Learning Profile", description: "Review your student's test results including CEFR level estimation, radar chart of skills, identified strengths and weaknesses, and the AI-recommended learning focus areas.", benefits: ["Radar chart visualization of skills", "Clear strengths and weaknesses", "AI recommendations for lesson focus"] },
  { number: 5, title: "Generate a Worksheet", description: "Select the student, set the topic and CEFR level, choose grammar focus, and pick from 29 exercise types. Click Generate and review the personalized worksheet before teaching or assigning it.", benefits: ["29 exercise types (basic, audio, picture)", "CEFR levels A1 through C2", "AI personalizes based on student data"] },
  { number: 6, title: "Share with Your Student", description: "Every worksheet gets a permanent shareable link. Send it to your student, use it in a live session, assign exercises as homework, or download as HTML/PDF.", benefits: ["Permanent shareable links", "Interactive online completion", "Download as HTML or PDF"] },
  { number: 7, title: "Assign Homework", description: "Select specific exercises from the worksheet and assign them as homework. Set deadlines, send email notifications. Students complete online, and AI grades their answers automatically — including open-ended exercises.", benefits: ["AI grades even open-ended answers", "Deadline and reminder emails", "Teacher review and comments"] },
  { number: 8, title: "Track Progress", description: "Every interaction updates the student's skill metrics automatically. View mastery trends (improving, stable, declining), identify gaps, and use AI suggestions for the next lesson focus. Create flashcard sets for vocabulary retention.", benefits: ["Automatic nano-skill tracking (DSLM)", "Mastery trends and gap identification", "Smart flashcards with SM-2 spaced repetition"] },
];

const faqItems = [
  { q: "How long does the entire setup take?", a: "You can go from sign-up to generating your first worksheet in under 5 minutes. Adding a student takes 30 seconds. The Welcome Test is optional and takes students 20-30 minutes to complete." },
  { q: "What emails will I receive after signing up?", a: "Two emails. First, a confirmation email from Supabase (no-reply) with an activation link — click it to activate your account. After confirming, you'll receive a branded welcome email from hello@edooqoo.com with quick-start guidance and a link to your dashboard." },
  { q: "Do students need to create accounts?", a: "No. Students access everything via links or the Student Hub portal using just their email. No account creation, no password, no app installation needed." },
  { q: "Can I skip the Welcome Test?", a: "Yes. The Welcome Test is optional. You can start generating worksheets immediately by manually setting the student's CEFR level. The test is recommended for new students where you want a detailed skill assessment." },
  { q: "How many worksheets can I generate?", a: "Free plan: 2 worksheets. Side-Gig ($9/mo): 15 worksheets/month. Full-Time (from $19/mo): 30-90 worksheets/month. Each worksheet can contain up to 12 exercises." },
  { q: "Is there a limit on students?", a: "No. You can add unlimited students on any plan, including the free plan. Student management is always free." },
];

const HowItWorks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;
  const fromState = { from: location.pathname + location.search };
  const handleBack = () => navigate(fromPath ?? '/');

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Use Edooqoo to Teach English with AI Worksheets',
    description: "Step-by-step guide to running an English teaching workflow on Edooqoo — from sign-up to progress tracking.",
    totalTime: 'PT5M',
    tool: { '@type': 'HowToTool', name: 'Edooqoo AI Worksheet Generator' },
    step: steps.map(s => ({
      '@type': 'HowToStep',
      position: s.number,
      name: s.title,
      text: s.description,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>How Edooqoo Works — AI Worksheet Generator in 8 Steps</title>
        <meta name="description" content="Step-by-step guide to Edooqoo: sign up, add students, generate AI worksheets, assign homework with AI grading, and track progress automatically." />
        <link rel="canonical" href="https://edooqoo.com/how-it-works" />
        <meta property="og:title" content="How Edooqoo Works — AI Worksheet Generator in 8 Steps" />
        <meta property="og:description" content="Step-by-step guide to Edooqoo: sign up, add students, generate AI worksheets, assign homework with AI grading, and track progress automatically." />
        <meta property="og:url" content="https://edooqoo.com/how-it-works" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(howToJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <button onClick={handleBack} className="text-primary hover:underline text-sm">
            ← Back to Edooqoo
          </button>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4">How Edooqoo Works — Step-by-Step Guide</h1>
        <p className="text-lg text-muted-foreground mb-12">
          From sign-up to full teaching workflow in 8 steps. Edooqoo handles material creation, homework grading, vocabulary retention, and progress tracking — so you can focus on teaching.
        </p>

        <div className="space-y-12">
          {steps.map(step => (
            <div key={step.number} className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                {step.number}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">{step.title}</h2>
                <p className="text-muted-foreground mb-4">{step.description}</p>
                <ul className="space-y-1">
                  {step.benefits.map((b, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">✓</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqItems.map(({ q, a }) => (
              <details key={q} className="border rounded-lg p-4">
                <summary className="font-semibold text-foreground cursor-pointer">{q}</summary>
                <p className="mt-2 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-12 p-6 bg-primary/5 rounded-lg text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Ready to get started?</p>
          <p className="text-muted-foreground mb-4">Sign up free and generate your first worksheet in under 5 minutes.</p>
          <Link to="/signup" state={fromState} className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
            Try Edooqoo Free — 2 Worksheets Included
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
