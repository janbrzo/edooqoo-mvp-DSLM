import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ProgrammaticSeoLayout from '@/components/seo/ProgrammaticSeoLayout';
import {
  findExerciseType,
  findTopic,
  PSEO_LEVELS,
  PSEO_TOPICS,
  PSEO_EXERCISE_TYPES,
} from '@/constants/pseoMatrix';

const ExerciseTopicPage: React.FC = () => {
  const { exerciseType: exSlug = '', topic: topicSlug = '' } = useParams();
  const exercise = findExerciseType(exSlug);
  const topic = findTopic(topicSlug);

  if (!exercise || !topic) return <Navigate to="/exercise-types" replace />;

  const title = `${exercise.label} Worksheet: ${topic.label} — Edooqoo`;
  const description = `Create a ${exercise.label} worksheet on ${topic.label} for adult English learners through a structured worksheet-generation workflow. CEFR A1-C2 labels, editable output, free to start.`;
  const h1 = `${exercise.label} Worksheet: ${topic.label}`;
  const lead = `Build a ${exercise.label.toLowerCase()} worksheet on ${topic.label} for a selected CEFR level. Edooqoo uses teacher inputs such as topic, learner goal, level, and context to draft editable worksheet material.`;
  const path = `/worksheets/${exercise.slug}/${topic.slug}`;

  const levelLinks = PSEO_LEVELS.slice(0, 4).map((l) => ({
    label: `${topic.label} for ${l.label}`,
    to: `/esl-worksheets/${topic.slug}/${l.slug}`,
  }));
  const otherExercises = PSEO_EXERCISE_TYPES.filter((e) => e.slug !== exercise.slug)
    .slice(0, 4)
    .map((e) => ({
      label: `${e.label}: ${topic.label}`,
      to: `/worksheets/${e.slug}/${topic.slug}`,
    }));
  const otherTopics = PSEO_TOPICS.filter((t) => t.slug !== topic.slug)
    .slice(0, 4)
    .map((t) => ({
      label: `${exercise.label}: ${t.label}`,
      to: `/worksheets/${exercise.slug}/${t.slug}`,
    }));

  return (
    <ProgrammaticSeoLayout
      seo={{ title, description, path }}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Worksheets', to: '/esl-worksheets' },
        { label: exercise.label, to: '/exercise-types' },
        { label: topic.label },
      ]}
      h1={h1}
      lead={lead}
      primaryCta={{
        label: `Generate this ${exercise.label} worksheet`,
        to: `/signup?exerciseType=${exercise.slug}&topic=${topic.slug}`,
      }}
      whatsInside={[
        { title: `${exercise.label} mechanic`, body: `Tasks built around the proven ${exercise.label.toLowerCase()} pattern from the Edooqoo engine.` },
        { title: `${topic.label} focus`, body: 'Every item teaches or tests the target structure in context.' },
        { title: 'CEFR scaling', body: 'Same template renders A1-friendly or C2-rigorous depending on your selection.' },
        { title: 'Editable answers', body: 'Override any answer key or distractor. Generated suggestions remain teacher-editable.' },
        { title: 'Interactive + print', body: 'Send as Student Hub homework or export to PDF for in-class use.' },
        { title: 'Review workflow', body: 'Use submitted answers as input for teacher review and follow-up planning.' },
      ]}
      bodyIntro={`The ${exercise.label} format is one of 29 exercise types Edooqoo generates. Pairing it with the topic ${topic.label} gives tutors a sharp, andragogical drill that adult learners actually finish.`}
      howItWorks={[
        `Open the worksheet form and select "${exercise.label}".`,
        `Set the topic to ${topic.label}.`,
        'Pick a CEFR level and add learner context.',
        'Edooqoo drafts a complete worksheet for teacher review.',
        'Review, edit, share to Student Hub or export PDF.',
      ]}
      trustNumbers={[
        { value: 'Workflow', label: 'Teacher-controlled generation' },
        { value: '29', label: 'Exercise types' },
        { value: 'A1–C2', label: 'CEFR levels' },
        { value: 'Public', label: 'Citable workflow pages' },
      ]}
      related={{
        heading: 'Related worksheet templates',
        items: [...levelLinks, ...otherExercises, ...otherTopics],
      }}
      faqs={[
        {
          question: `What is a ${exercise.label} worksheet?`,
          answer: `${exercise.label} is one of 29 exercise types Edooqoo can generate. It tests ${topic.label} via the ${exercise.label.toLowerCase()} pattern that adult learners complete in 3-10 minutes.`,
        },
        {
          question: `Can I print the ${exercise.label} worksheet?`,
          answer: 'Yes. Every worksheet exports to a printable PDF or a shareable interactive link for Student Hub.',
        },
        {
          question: 'How long does generation take?',
          answer: 'Generation time depends on worksheet complexity and current service conditions. Teachers should review generated material before assigning it.',
        },
        {
          question: 'Can I mix exercise types in one worksheet?',
          answer: 'Yes. Use the standard worksheet form to mix any of the 29 types. The /worksheets/{type}/{topic} landing pages just pre-seed your form.',
        },
      ]}
    />
  );
};

export default ExerciseTopicPage;
