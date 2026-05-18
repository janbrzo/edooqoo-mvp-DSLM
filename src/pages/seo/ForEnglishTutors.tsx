import React from 'react';
import { Link } from 'react-router-dom';
import SeoLandingLayout from '@/components/seo/SeoLandingLayout';

const serviceLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'AI tools for English tutors',
  provider: { '@type': 'Organization', name: 'Edooqoo' },
  description: 'Complete toolkit for independent English tutors: AI worksheet generator, automated homework grading, student progress tracking, public booking page with Stripe payments.',
  areaServed: 'Worldwide',
  url: 'https://edooqoo.com/for-english-tutors',
};

const ForEnglishTutors = () => (
  <SeoLandingLayout
    seo={{
      title: 'English Tutor Tools — Run a Pro Tutoring Business',
      description: 'Tools for English tutors: AI worksheet generator, automated homework grading, student progress tracking, calendar with payments.',
      path: '/for-english-tutors',
      ogType: 'website',
      extraJsonLd: serviceLd,
    }}
    h1="English Tutor Tools — Run a Pro Tutoring Business"
    lead="The complete toolkit for independent English tutors. AI worksheet generation, automated homework grading, student progress tracking, public booking page with Stripe payments — all in one platform."
    problems={[
      'Independent English tutors juggle 5+ tools (Google Docs, Calendly, Stripe, Zoom, a notes app) just to run one student.',
      'Lesson preparation and homework grading consume 10-15 hours per week — destroying the effective hourly rate.',
      'No centralized view of student progress means every lesson starts with what did we cover last time?',
    ]}
    solutionHeading="One platform replaces the typical 5-tool stack"
    solutions={[
      { title: 'AI worksheet generator', body: '29 exercise types, CEFR A1-C2, generated in 60 seconds per worksheet. Personalized to each students profile.' },
      { title: 'Automated homework grading', body: 'AI grades closed AND open-answer homework — including emails, essays, speaking transcripts. Teacher reviews in 30 seconds.' },
      { title: 'Booking + payment + calendar', body: 'Public booking page with Stripe. Google Calendar sync. Vacation blocks. Automated student reminders.' },
    ]}
    listHeading="What Edooqoo replaces in a tutors workflow"
    listIntro="Each line item is a tool or routine that becomes obsolete after switching to Edooqoo."
    list={[
      { title: 'Google Docs worksheet templates', body: 'Replaced by 29 AI exercise types with editable output.', href: '/exercise-types' },
      { title: 'Manual homework correction', body: 'Replaced by AI grading on submission. Teacher overrides in 30 seconds per assignment.', href: '/features/homework' },
      { title: 'Calendly + Stripe + Zoom links', body: 'Replaced by public booking page with embedded payment and auto-generated Google Meet links.', href: '/features/calendar' },
      { title: 'Notion / Apple Notes for student notes', body: 'Replaced by DSLM Student Knowledge with AI classification.', href: '/features/dslm' },
      { title: 'Quizlet for vocabulary', body: 'Replaced by Edooqoo Flashcards with SM-2 spaced repetition.', href: '/features/flashcards' },
      { title: 'Manual placement testing', body: 'Replaced by 49-question Welcome Test with AI Learning Profile generation.', href: '/features/placement-test' },
      { title: 'WhatsApp / email for student materials', body: 'Replaced by Student Hub portal — students access worksheets, homework, flashcards in one place.', href: '/features/student-hub' },
      { title: 'Excel for progress tracking', body: 'Replaced by DSLM nano-skill metrics updated automatically after every exercise.', href: '/features/dslm' },
    ]}
    body={
      <>
        <h2 className="text-xl font-bold text-foreground mt-0">Why independent tutors win in 2026</h2>
        <p>Platforms like Cambly, Preply, and italki take 15-30% commission and dictate pricing. An independent tutor with their own booking page, payment processing, and student management workflow keeps 100% of revenue and sets their own rate. The historical blocker has been the operational complexity — building that stack with 5+ separate tools added 10 hours per week of admin. Edooqoo collapses the stack into one platform, making independent tutoring genuinely more profitable than platform work.</p>
        <h2 className="text-xl font-bold text-foreground">What you get on the Free plan</h2>
        <p>Unlimited students. All 29 exercise types. 2 worksheet generations to test the engine. AI homework grading on those 2 worksheets. Public booking page. Stripe payment integration. Student Hub portal. Flashcards with spaced repetition. The Free plan is enough to run 1-2 paying students end-to-end before deciding to upgrade.</p>
        <h2 className="text-xl font-bold text-foreground">Paid plans for full-time tutors</h2>
        <p>Side-Gig ($9/month): 15 worksheets/month, suitable for 5-10 weekly students. Full-Time (from $19/month): 30-90 worksheets/month for tutors with 15+ weekly students. Every plan includes every feature — the only meter is worksheet generation volume. See <Link to="/pricing" className="text-primary hover:underline">full pricing</Link>.</p>
        <h2 className="text-xl font-bold text-foreground">Built by tutors, for tutors</h2>
        <p>Edooqoo is built with Martha (10 years adult ESL) as the quality benchmark. Every feature is rejected if it feels generic, school-like, or fails the adult-learner test. Read more in <Link to="/about" className="text-primary hover:underline">About Edooqoo</Link>.</p>
      </>
    }
    faqs={[
      { question: 'Is Edooqoo only for ESL tutors?', answer: 'Edooqoo is purpose-built for English tutors teaching adult learners. Other languages and child learners are out of scope by design.' },
      { question: 'Can I import my existing students?', answer: 'Yes. Add students manually or via CSV. Existing teacher notes can be pasted into DSLM Student Knowledge for AI classification.' },
      { question: 'How does payment processing work?', answer: 'Edooqoo integrates Stripe. Students book and pay through your public booking page. Funds go directly to your Stripe account.' },
      { question: 'Do I need a website?', answer: 'No. Your public booking page is your website in year one. It includes your bio, services, pricing, and live calendar.' },
    ]}
    ctaTitle="Run your tutoring business on one platform"
    ctaBody="Free plan: unlimited students, 2 worksheets, AI homework grading, Stripe payments, Student Hub. No credit card required."
  />
);

export default ForEnglishTutors;