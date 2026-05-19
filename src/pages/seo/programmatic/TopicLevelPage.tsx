import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ProgrammaticSeoLayout from '@/components/seo/ProgrammaticSeoLayout';
import {
  findTopic,
  findLevel,
  PSEO_TOPICS,
  PSEO_LEVELS,
  PSEO_EXERCISE_TYPES,
  PSEO_PERSONAS,
} from '@/constants/pseoMatrix';

const TopicLevelPage: React.FC = () => {
  const { topic: topicSlug = '', level: levelSlug = '' } = useParams();
  const topic = findTopic(topicSlug);
  const level = findLevel(levelSlug);

  if (!topic || !level) return <Navigate to="/esl-worksheets" replace />;

  const title = `${topic.label} Worksheets for ${level.label} Learners — Edooqoo`;
  const description = `Generate ${topic.label} worksheets for ${level.label} (${level.cefr}) adult learners in 60 seconds. AI-personalized, CEFR-aligned, printable PDF. Free to start.`;
  const h1 = `${topic.label} Worksheets for ${level.label} Learners`;
  const lead = `Edooqoo generates printable ${topic.label} worksheets for ${level.cefr} learners in 60 seconds. Each worksheet is AI-personalized to the student's goal, CEFR-aligned, and ready to assign as homework with automatic grading.`;

  const path = `/esl-worksheets/${topic.slug}/${level.slug}`;

  const otherLevels = PSEO_LEVELS.filter((l) => l.slug !== level.slug)
    .slice(0, 5)
    .map((l) => ({
      label: `${topic.label} — ${l.label}`,
      to: `/esl-worksheets/${topic.slug}/${l.slug}`,
    }));
  const sameCategoryTopics = PSEO_TOPICS.filter(
    (t) => t.category === topic.category && t.slug !== topic.slug
  )
    .slice(0, 4)
    .map((t) => ({
      label: `${t.label} — ${level.label}`,
      to: `/esl-worksheets/${t.slug}/${level.slug}`,
    }));
  const exerciseLinks = PSEO_EXERCISE_TYPES.slice(0, 2).map((e) => ({
    label: `${e.label}: ${topic.label}`,
    to: `/worksheets/${e.slug}/${topic.slug}`,
  }));
  const personaLinks = PSEO_PERSONAS.slice(0, 2).map((p) => ({
    label: `English for ${p.label}`,
    to: `/english-for/${p.slug}`,
  }));

  const courseLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: h1,
    educationalLevel: level.cefr,
    teaches: topic.label,
    learningResourceType: 'Worksheet',
    inLanguage: 'en',
    provider: { '@type': 'Organization', name: 'Edooqoo', url: 'https://edooqoo.com' },
  };

  return (
    <ProgrammaticSeoLayout
      seo={{ title, description, path }}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'ESL Worksheets', to: '/esl-worksheets' },
        { label: topic.label, to: `/esl-worksheets/${topic.slug}/b1-intermediate` },
        { label: level.label },
      ]}
      h1={h1}
      lead={lead}
      primaryCta={{
        label: `Generate a ${topic.label} worksheet`,
        to: `/signup?topic=${topic.slug}&level=${level.cefr}`,
      }}
      whatsInside={[
        { title: 'CEFR-aligned tasks', body: `Every exercise calibrated to ${level.cefr} difficulty by Martha (10 yrs ESL).` },
        { title: '29 exercise types', body: 'Mix fill-in-the-blanks, matching, error correction, dictation, picture description.' },
        { title: 'Auto-graded homework', body: 'Assign to your student. Edooqoo grades open answers with AI and feeds DSLM mastery.' },
        { title: 'Printable + interactive', body: 'Download PDF or share an interactive link. Works on phone and laptop.' },
        { title: 'Personalized to goal', body: 'Specify business email, IELTS, travel — examples adapt to the student\'s profession.' },
        { title: 'Editable in seconds', body: 'Click any question to edit text, answer, or distractors. No template lock-in.' },
      ]}
      bodyIntro={`Most ${level.cefr} learners need ${topic.label} practice that is calibrated, varied, and tied to a real goal. Generic textbook drills bore adult students. Edooqoo solves this with AI-personalized worksheets that match the learner's profession and level.`}
      howItWorks={[
        `Pick "${topic.label}" and CEFR level ${level.cefr} in the worksheet form.`,
        'Add 1-2 lines about the student (e.g., "B1 nurse preparing for night shifts").',
        'Edooqoo generates 8-12 exercises across the 29 types in ~60 seconds.',
        'Edit any question, then share as PDF or interactive homework link.',
        'Student completes it; AI grades open answers and updates the DSLM mastery map.',
      ]}
      trustNumbers={[
        { value: '60s', label: 'Average generation time' },
        { value: '29', label: 'Exercise types' },
        { value: 'A1–C2', label: 'Full CEFR coverage' },
        { value: '2', label: 'Free worksheets / month' },
      ]}
      related={{
        heading: `More ${topic.label} and ${level.cefr} resources`,
        items: [...otherLevels, ...sameCategoryTopics, ...exerciseLinks, ...personaLinks],
      }}
      faqs={[
        {
          question: `Are these ${topic.label} worksheets really free?`,
          answer: `Yes. The Edooqoo Free plan includes 2 fully generated ${topic.label} worksheets per month, with no credit card required.`,
        },
        {
          question: `Are the worksheets aligned to ${level.cefr} CEFR descriptors?`,
          answer: `Every worksheet is generated against the official ${level.cefr} CEFR can-do descriptors. Martha (10 yrs ESL) validated the rubric.`,
        },
        {
          question: 'Can I edit the generated questions?',
          answer: 'Yes. Every question is editable in place — text, correct answer, distractors, and instructions. No template lock-in.',
        },
        {
          question: 'Can my student do the worksheet online?',
          answer: 'Yes. Share an interactive Student Hub link. Edooqoo auto-grades closed tasks and uses AI to evaluate open answers.',
        },
        {
          question: 'Does Edooqoo work for 1-on-1 adult learners?',
          answer: 'Yes — that is the primary use case. The generator personalizes examples to the learner\'s profession and goals.',
        },
      ]}
      extraJsonLd={courseLd}
    />
  );
};

export default TopicLevelPage;