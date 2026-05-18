import React from 'react';
import { Link } from 'react-router-dom';
import SeoLandingLayout from '@/components/seo/SeoLandingLayout';

const blogPostingLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'How to Teach English Online — Complete 2026 Guide',
  description: 'Complete 2026 guide to teaching English online: pricing, tools, lesson prep, student acquisition, AI worksheet generation and homework grading.',
  author: { '@type': 'Organization', name: 'Edooqoo' },
  publisher: { '@type': 'Organization', name: 'Edooqoo' },
  datePublished: '2026-05-18',
  mainEntityOfPage: 'https://edooqoo.com/blog/teach-english-online-guide',
};

const TeachEnglishOnlineGuide = () => (
  <SeoLandingLayout
    seo={{
      title: 'How to Teach English Online — Complete 2026 Guide',
      description: 'Start teaching English online: pricing, tools, lesson prep, student acquisition. Tutor toolkit with AI worksheets and homework grading.',
      path: '/blog/teach-english-online-guide',
      extraJsonLd: blogPostingLd,
    }}
    h1="How to Teach English Online — Complete 2026 Guide"
    lead="A practical 2026 guide to setting up, pricing, and running an online English tutoring business. Written for independent tutors (not platforms like Cambly or italki) who want to keep 100% of revenue."
    problems={[
      'Most teach English online guides on the internet are affiliate funnels for low-paying platforms (Cambly, Preply, italki) that take 20-30% commission and lock you into their pricing.',
      'New online tutors lose 10-15 hours per week to lesson preparation and homework grading — destroying their effective hourly rate.',
      'Independent tutors with no website or booking system rely on WhatsApp scheduling and bank transfers — losing professionalism and students.',
    ]}
    solutionHeading="The independent online tutor stack in 2026"
    solutions={[
      { title: 'Direct booking + payment', body: 'Public booking page with Stripe checkout. No platform commission. Set your own hourly rate.' },
      { title: 'AI worksheet generation', body: 'Edooqoo generates personalized worksheets in 60 seconds. Eliminate the 60-minute lesson prep.' },
      { title: 'Automated homework grading', body: 'AI grades closed and open-answer homework overnight. Teacher reviews in 30 seconds.' },
    ]}
    listHeading="9 steps to launch an online English tutoring business"
    listIntro="A practical sequence from zero to first paying student. Estimated total time: 8-12 hours of setup."
    list={[
      { title: 'Pick your niche', body: 'Business English, IELTS prep, conversation, kids — but pick ONE for your first 6 months. Niching doubles your conversion rate.' },
      { title: 'Set your hourly rate', body: '2026 benchmarks: $25-40 General English, $40-80 Business English, $50-100 IELTS prep. Independent tutors charge 2-3x platform rates.' },
      { title: 'Choose video lesson platform', body: 'Zoom (paid, $14/mo, best stability) or Google Meet (free, integrated with Edooqoo calendar).' },
      { title: 'Set up a booking + payment page', body: 'Use Edooqoo public booking page or Calendly + Stripe. Avoid WhatsApp-only scheduling.' },
      { title: 'Create a placement test workflow', body: 'Send every new student a placement test before lesson 1. Edooqoo Welcome Test takes 20-30 minutes and generates a Learning Profile automatically.', href: '/features/placement-test' },
      { title: 'Build a worksheet generation routine', body: 'Generate the worksheet 24 hours before each lesson. Share the link with the student. Use it on screen-share during the live session.', href: '/esl-worksheets' },
      { title: 'Assign homework after every lesson', body: 'Pick 2-4 exercises from the lesson worksheet, set a 5-day deadline. AI grades on submission.', href: '/features/homework' },
      { title: 'Track progress with DSLM', body: 'Every exercise updates nano-skill metrics automatically. Review the dashboard before each lesson — no manual notes required.', href: '/features/dslm' },
      { title: 'Market on 1-2 channels only', body: 'LinkedIn (Business English niche), Instagram + TikTok (conversation/IELTS), Reddit r/EnglishLearning (general). Pick 1-2 and post 3x/week.' },
    ]}
    body={
      <>
        <h2 className="text-xl font-bold text-foreground mt-0">Why platforms like Cambly and Preply destroy your rate</h2>
        <p>Cambly pays $0.17/minute ($10.20/hour) with no scheduling control. Preply takes 18-33% commission on every lesson and 100% of the first lesson with each new student. italki charges 15% commission. Working independently with 5-10 weekly students at $30-50/hour replaces a $10/hour platform job in roughly 3 months. The bottleneck is not student supply — there is enormous demand. The bottleneck is the time cost of running the business yourself: marketing, scheduling, payments, lesson prep, homework grading.</p>
        <p>Edooqoo eliminates the two biggest time costs (lesson prep and homework grading) and bundles a public booking page so you do not need Calendly. That collapses the independent-tutor stack from 5 tools (Calendly + Stripe + Zoom + Notion + Google Docs) to 2 (Edooqoo + video platform).</p>
        <h2 className="text-xl font-bold text-foreground">Pricing benchmarks for online English tutors in 2026</h2>
        <p>General English conversation: $25-40/hour. Business English (banking, tech, M&A, legal): $40-80/hour. IELTS or Cambridge exam prep: $50-100/hour. Academic English (university applications, dissertations): $60-120/hour. Pricing scales with measurable outcomes — a tutor who can guarantee +0.5 IELTS band in 10 weeks charges 3x a general conversation tutor.</p>
        <h2 className="text-xl font-bold text-foreground">The lesson workflow that saves 8 hours per week</h2>
        <p>1. The night before: open Edooqoo, pick the student, generate a worksheet for the next lesson (60 seconds). 2. Share the link with the student via email or Student Hub. 3. During the lesson: screen-share the worksheet, work through 4-6 exercises live. 4. End of lesson: select 2-3 unused exercises, assign as homework with a 5-day deadline. 5. AI grades the homework overnight. 6. Before the next lesson: review the auto-generated student progress dashboard (30 seconds). Total prep + admin time: 5 minutes per lesson, down from 75 minutes.</p>
        <p>For the full tutor toolkit see <Link to="/for-english-tutors" className="text-primary hover:underline">English tutor tools</Link> and <Link to="/pricing" className="text-primary hover:underline">Edooqoo pricing</Link>.</p>
      </>
    }
    faqs={[
      { question: 'Do I need a teaching certificate to teach English online?', answer: 'For independent tutoring, no certificate is legally required. TEFL/TESOL/CELTA helps credibility for Business English and exam prep students; less relevant for conversation tutoring.' },
      { question: 'How long until I replace a full-time income?', answer: 'Typical timeline: 3-6 months to reach 15 weekly students at $40/hour ($2400-3200/month). 9-12 months for full-time income at $50-70/hour.' },
      { question: 'Can I teach English online without a website?', answer: 'Yes, in year one. Use Edooqoo public booking page + LinkedIn/Instagram for client acquisition. Build a website in year two for SEO.' },
      { question: 'What is the best tool stack for independent online tutors?', answer: 'Video: Zoom or Google Meet. Worksheets + homework + booking: Edooqoo. Payment: Stripe (built into Edooqoo). Total monthly cost under $40.' },
    ]}
    ctaTitle="Cut lesson prep from 60 minutes to 60 seconds"
    ctaBody="Edooqoo generates personalized worksheets, grades homework with AI, and handles booking + payment. Free plan includes 2 worksheets."
  />
);

export default TeachEnglishOnlineGuide;