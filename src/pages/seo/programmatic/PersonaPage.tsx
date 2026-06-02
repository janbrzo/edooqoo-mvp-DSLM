import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ProgrammaticSeoLayout from '@/components/seo/ProgrammaticSeoLayout';
import { findPersona, PSEO_PERSONAS, PSEO_TOPICS, PSEO_LEVELS } from '@/constants/pseoMatrix';

const PersonaPage: React.FC = () => {
  const { persona: slug = '' } = useParams();
  const persona = findPersona(slug);
  if (!persona) return <Navigate to="/for-english-tutors" replace />;

  const title = `English for ${persona.label} — Worksheets, Lessons, Vocabulary | Edooqoo`;
  const description = `Teach English for ${persona.professionPlural} with AI-generated worksheets calibrated to their daily tasks. CEFR A1-C2. Free to start.`;
  const h1 = `English for ${persona.label}`;
  const lead = `Edooqoo helps English tutors prepare ${persona.professionPlural} for real workplace communication. Generate vocabulary lists, dialogues, and CEFR-aligned worksheets that match their actual job.`;
  const path = `/english-for/${persona.slug}`;

  const sameDomainPersonas = PSEO_PERSONAS.filter(
    (p) => p.domain === persona.domain && p.slug !== persona.slug
  )
    .slice(0, 4)
    .map((p) => ({ label: `English for ${p.label}`, to: `/english-for/${p.slug}` }));
  const topicLinks = PSEO_TOPICS.filter((t) => t.category === 'business' || t.category === 'skills')
    .slice(0, 6)
    .map((t) => ({
      label: `${t.label} for ${persona.label}`,
      to: `/esl-worksheets/${t.slug}/b1-intermediate`,
    }));
  const levelLinks = PSEO_LEVELS.slice(0, 3).map((l) => ({
    label: `Business English ${l.label}`,
    to: `/esl-worksheets/business-email/${l.slug}`,
  }));

  return (
    <ProgrammaticSeoLayout
      seo={{ title, description, path }}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'For English Tutors', to: '/for-english-tutors' },
        { label: `English for ${persona.label}` },
      ]}
      h1={h1}
      lead={lead}
      primaryCta={{
        label: `Generate a worksheet for a ${persona.label.replace(/s$/, '').toLowerCase()}`,
        to: `/signup?persona=${persona.slug}`,
      }}
      whatsInside={[
        { title: 'Profession-specific vocabulary', body: `Lexis drawn from real ${persona.domain} contexts, not generic textbooks.` },
        { title: 'Role-play dialogues', body: `Conversations modeled after the situations ${persona.professionPlural} actually face.` },
        { title: 'CEFR alignment', body: 'Same template scales from A1 survival English to C1 negotiation.' },
        { title: 'Homework review workflow', body: 'Assign via Student Hub. Objective answers can be checked automatically and open answers can use AI-assisted review.' },
        { title: '1-on-1 ready', body: 'Built for tutors running 1-on-1 adult lessons, not classroom drills.' },
        { title: 'Editable everything', body: 'Replace any example with one your specific student will recognize.' },
      ]}
      bodyIntro={`Adult ${persona.professionPlural} need English materials that reflect their work context. Edooqoo lets tutors draft personalized worksheets, role-plays, email templates, and vocabulary banks that map to the learner's ${persona.domain} domain.`}
      howItWorks={[
        `Add your ${persona.label.replace(/s$/, '').toLowerCase()} student in Edooqoo with their CEFR level and goal.`,
        'Open the worksheet form — fields pre-fill with their profile.',
        `Choose a topic (e.g., meetings, telephone English, ${persona.domain} vocabulary).`,
        'Generate. Review. Share to Student Hub or export PDF.',
        'Edooqoo organizes available learning signals so the next worksheet can build on what stuck.',
      ]}
      trustNumbers={[
        { value: 'Workflow', label: 'Teacher-controlled generation' },
        { value: '25', label: 'Profession personas' },
        { value: 'A1–C2', label: 'CEFR coverage' },
        { value: '1-on-1', label: 'Adult tutoring focus' },
      ]}
      related={{
        heading: 'Related English-for-profession pages',
        items: [...sameDomainPersonas, ...topicLinks, ...levelLinks],
      }}
      faqs={[
        {
          question: `Does Edooqoo support English for ${persona.label}?`,
          answer: `Yes. The generator personalizes every worksheet to the learner's profession, so ${persona.professionPlural} get examples, vocabulary, and dialogues drawn from their ${persona.domain} domain.`,
        },
        {
          question: 'Do I need a separate plan for business English?',
          answer: 'No. Every Edooqoo plan supports general and business English. Profession context is just a field in the worksheet form.',
        },
        {
          question: `What CEFR levels work for ${persona.label}?`,
          answer: 'All six CEFR levels (A1-C2) are supported. The generator scales examples and grammar complexity to the level you select.',
        },
        {
          question: 'Can I bundle this into a course or curriculum?',
          answer: 'Yes. Use Curriculum Phases to sequence worksheets across weeks, and the DSLM mastery model tracks long-term progress.',
        },
      ]}
    />
  );
};

export default PersonaPage;
