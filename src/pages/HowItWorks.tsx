
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, BarChart2, Brain, ClipboardCheck, FileText, RefreshCw } from 'lucide-react';

const steps = [
  { number: 1, title: "Create your account", description: "Create a free Edooqoo account so student context, worksheets, homework and progress signals can be saved between lessons.", benefits: ["No credit card required", "2 free worksheets to start", "Browser-based teacher workspace"] },
  { number: 2, title: "Add student profile and goals", description: "Create a student profile with CEFR level, learning goals, lesson context and preferences. This gives 1-Minute Prep a stable starting point.", benefits: ["Student goals stored in one place", "Manual CEFR estimate supported", "Works for repeat and one-off 1:1 students"] },
  { number: 3, title: "Send the Welcome Test, optional", description: "Send a placement test when you need a stronger baseline. The test covers grammar, vocabulary, reading, listening and speaking, then updates the student profile.", benefits: ["49-question assessment", "Speaking analysis included", "Initial DSLM profile data"] },
  { number: 4, title: "Review the profile and DSLM baseline", description: "Review strengths, weak areas, learning path and nano-skill signals before deciding what to teach next.", benefits: ["Skill radar and mastery signals", "Learning path context", "Teacher review stays in control"] },
  { number: 5, title: "Generate the next worksheet from context", description: "Use the student profile, goals and DSLM signals to generate a ready-to-teach worksheet with the topic, CEFR level and exercise types you choose.", benefits: ["29 exercise types", "Audio and image-capable worksheets", "Editable before teaching or assigning"] },
  { number: 6, title: "Teach, share or assign homework", description: "Use the worksheet in a live lesson, share it through a link, download it, or assign selected exercises as homework.", benefits: ["Interactive sharing", "Live session mode", "HTML/PDF download"] },
  { number: 7, title: "Student activity updates the model", description: "Homework answers, flashcards, shared worksheet activity and lesson signals feed back into the student model where applicable.", benefits: ["AI-assisted homework grading", "Flashcards with spaced repetition", "Learning events connected to student history"] },
  { number: 8, title: "Start the next lesson from stronger signals", description: "The next prep cycle starts with more student data than the previous one, so recommendations and generated materials can become faster and more precise.", benefits: ["DSLM trend detection", "Next-step recommendations", "Less blank-page preparation over time"] },
];

const loopStages = [
  { title: "Student context", description: "Profile, goals, CEFR estimate and lesson notes.", icon: Brain },
  { title: "Generate and teach", description: "Worksheet output reviewed by the teacher.", icon: FileText },
  { title: "Homework and flashcards", description: "Student activity creates learning signals.", icon: ClipboardCheck },
  { title: "DSLM recommendation", description: "Signals become next-step teaching context.", icon: BarChart2 },
  { title: "Better next prep", description: "The next cycle starts with stronger data.", icon: RefreshCw },
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
    name: 'How 1-Minute Prep Works in Edooqoo',
    description: "Step-by-step guide to Edooqoo's student learning loop: profile, worksheet, activity signals, DSLM recommendation, and the next prep cycle.",
    totalTime: 'PT5M',
    tool: { '@type': 'HowToTool', name: 'Edooqoo 1-Minute Prep' },
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
        <title>How 1-Minute Prep Works — Edooqoo Student Learning Loop</title>
        <meta name="description" content="See how Edooqoo's 1-Minute Prep loop connects student context, worksheets, homework, flashcards and DSLM recommendations for the next lesson." />
        <link rel="canonical" href="https://edooqoo.com/how-it-works" />
        <meta property="og:title" content="How 1-Minute Prep Works — Edooqoo Student Learning Loop" />
        <meta property="og:description" content="See how Edooqoo's 1-Minute Prep loop connects student context, worksheets, homework, flashcards and DSLM recommendations for the next lesson." />
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

        <h1 className="text-4xl font-bold text-foreground mb-4">How 1-Minute Prep Works</h1>
        <p className="text-lg text-muted-foreground mb-12">
          Edooqoo works as a student learning loop: every profile, worksheet, homework task and flashcard session can add context for the next lesson.
        </p>

        <section className="mb-14 -mx-4 border-y border-primary/10 bg-primary/5 px-4 py-8 sm:-mx-8 sm:px-8">
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-bold text-foreground">The 1-Minute Prep loop</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              More student context feeds better next-step decisions before the next worksheet is generated.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-5 md:gap-4">
            {loopStages.map(({ title, description, icon: Icon }, index) => (
              <div key={title} className="relative border-l-2 border-primary/20 pl-4 text-left md:border-l-0 md:border-t-2 md:pl-0 md:pt-5 md:text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 md:mx-auto">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                {index < loopStages.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary md:block" />
                )}
              </div>
            ))}
          </div>
        </section>

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
          <p className="text-muted-foreground mb-4">Sign up free, add a student profile, and start building the context for 1-Minute Prep.</p>
          <Link to="/signup" state={fromState} className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
            Try Edooqoo Free — 2 Worksheets Included
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
