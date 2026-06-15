import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ProgrammaticSeoLayout from '@/components/seo/ProgrammaticSeoLayout';
import {
  findTopic,
  findLevel,
  findExerciseType,
  PSEO_TOPICS,
  PSEO_LEVELS,
  PSEO_PERSONAS,
} from '@/constants/pseoMatrix';
import {
  getTopicIndexPolicy,
  INDEXABLE_PERSONA_SLUGS,
  isIndexableTopicLevel,
} from '@/lib/seo/pseoIndexPolicy';

const TopicLevelPage: React.FC = () => {
  const { topic: topicSlug = '', level: levelSlug = '' } = useParams();
  const topic = findTopic(topicSlug);
  const level = findLevel(levelSlug);

  if (!topic || !level) return <Navigate to="/esl-worksheets" replace />;

  const policy = getTopicIndexPolicy(topic.slug);
  const isIndexable = isIndexableTopicLevel(topic.slug, level.slug);
  const title = `${topic.label} worksheets for ${level.label} English learners | Edooqoo`;
  const description = `Create ${topic.label} worksheets for ${level.label} (${level.cefr}) adult learners through a structured worksheet-generation workflow. Editable, printable, and free to start.`;
  const h1 = `${topic.label} worksheets for ${level.label} English learners`;
  const lead = policy
    ? `${policy.useCase} Edooqoo lets the tutor set ${level.cefr}, add the adult learner's context, select a suitable exercise type, edit the draft, and collect follow-up evidence.`
    : `Edooqoo can draft ${topic.label} practice for ${level.cefr} adult learners, but this combination is not part of the current public indexing set because it does not yet have a distinct teaching rationale.`;

  const path = `/esl-worksheets/${topic.slug}/${level.slug}`;

  const otherLevels = PSEO_LEVELS.filter(
    (candidateLevel) =>
      candidateLevel.slug !== level.slug &&
      isIndexableTopicLevel(topic.slug, candidateLevel.slug)
  )
    .slice(0, 5)
    .map((l) => ({
      label: `${topic.label} — ${l.label}`,
      to: `/esl-worksheets/${topic.slug}/${l.slug}`,
    }));
  const sameCategoryTopics = PSEO_TOPICS.filter(
    (candidateTopic) =>
      candidateTopic.category === topic.category &&
      candidateTopic.slug !== topic.slug &&
      isIndexableTopicLevel(candidateTopic.slug, level.slug)
  )
    .slice(0, 4)
    .map((t) => ({
      label: `${t.label} — ${level.label}`,
      to: `/esl-worksheets/${t.slug}/${level.slug}`,
    }));
  const exerciseLinks = (policy?.exerciseTypes || [])
    .map((slug) => findExerciseType(slug))
    .filter(Boolean)
    .slice(0, 5)
    .map((exerciseType) => ({
      label: `${exerciseType!.label}: ${topic.label}`,
      to: `/worksheets/${exerciseType!.slug}/${topic.slug}`,
    }));
  const personaLinks = PSEO_PERSONAS.filter((persona) =>
    INDEXABLE_PERSONA_SLUGS.includes(persona.slug)
  ).slice(0, 2).map((p) => ({
    label: `English for ${p.label}`,
    to: `/english-for/${p.slug}`,
  }));
  const generatorLinks = [
    { label: 'AI worksheet generator for English teachers', to: '/ai-worksheet-generator-for-english-teachers.html' },
    { label: 'Editable ESL worksheet generator', to: '/editable-esl-worksheet-generator.html' },
    { label: 'CEFR worksheet generator', to: '/cefr-worksheet-generator.html' },
    { label: '1-Minute Prep workflow', to: '/one-minute-prep' },
  ];

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
      seo={{ title, description, path, robots: isIndexable ? 'index,follow' : 'noindex,follow' }}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'ESL Worksheets', to: '/esl-worksheets' },
        {
          label: topic.label,
          to: policy?.validLevels[0]
            ? `/esl-worksheets/${topic.slug}/${policy.validLevels[0]}`
            : '/esl-worksheets',
        },
        { label: level.label },
      ]}
      h1={h1}
      lead={lead}
      primaryCta={{
        label: `Generate a ${topic.label} worksheet`,
        to: `/signup?topic=${topic.slug}&level=${level.cefr}`,
      }}
      whatsInside={[
        { title: 'CEFR-oriented tasks', body: `Exercises use ${level.cefr} as the selected difficulty label and can be reviewed by the teacher before use.` },
        {
          title: policy ? 'Five selected exercise types' : 'Teacher-selected exercise type',
          body: policy
            ? 'The indexed combinations are limited to exercise mechanics that fit this language objective.'
            : 'The full worksheet workflow remains available even when this public page is not indexed.',
        },
        { title: 'Homework review workflow', body: 'Assign to your student, review submitted answers, and use results as input for follow-up planning.' },
        { title: 'Printable + interactive', body: 'Download PDF or share an interactive link. Works on phone and laptop.' },
        { title: 'Personalized to goal', body: 'Specify business email, IELTS, travel — examples adapt to the student\'s profession.' },
        { title: 'Editable after generation', body: 'Click any question to edit text, answer, or distractors before teaching or assigning.' },
      ]}
      bodyIntro={`Most ${level.cefr} learners need ${topic.label} practice that is level-aware, varied, and tied to a real goal. Edooqoo supports this with worksheet-generation inputs for learner context, profession, topic, and selected CEFR level.`}
      howItWorks={[
        `Pick "${topic.label}" and CEFR level ${level.cefr} in the worksheet form.`,
        'Add 1-2 lines about the student (e.g., "B1 nurse preparing for night shifts").',
        'Edooqoo drafts a worksheet across selected exercise types.',
        'Edit any question, then share as PDF or interactive homework link.',
        'Student completes it; teacher-reviewed results can inform the next worksheet.',
      ]}
      trustNumbers={[
        { value: 'Workflow', label: 'Teacher-controlled generation' },
        { value: policy ? '5' : '29', label: policy ? 'Selected exercise types' : 'Available exercise types' },
        { value: policy ? String(policy.validLevels.length) : 'A1-C2', label: policy ? 'Indexed level fits' : 'Available CEFR levels' },
        { value: '2', label: 'Free worksheets / month' },
      ]}
      decisionCriteria={policy}
      related={{
        heading: `More ${topic.label} and ${level.cefr} resources`,
        items: [...generatorLinks, ...otherLevels, ...sameCategoryTopics, ...exerciseLinks, ...personaLinks],
      }}
      faqs={[
        {
          question: `Are these ${topic.label} worksheets really free?`,
          answer: `Yes. The Edooqoo Free plan includes 2 fully generated ${topic.label} worksheets per month, with no credit card required.`,
        },
        {
          question: `Are the worksheets aligned to ${level.cefr} CEFR descriptors?`,
          answer: `The worksheet form uses ${level.cefr} as the selected CEFR-oriented difficulty label. Teachers should review generated material before using it for formal assessment.`,
        },
        {
          question: 'Can I edit the generated questions?',
          answer: 'Yes. Every question is editable in place — text, correct answer, distractors, and instructions. No template lock-in.',
        },
        {
          question: 'Can my student do the worksheet online?',
          answer: 'Yes. Share an interactive Student Hub link. Edooqoo can auto-check closed tasks and use AI-assisted evaluation for open answers with teacher review.',
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
