import React from 'react';
import { Link } from 'react-router-dom';
import SeoLandingLayout from '@/components/seo/SeoLandingLayout';

const blogPostingLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'ESL Games for Teachers — 15 Tested Activities',
  description: '15 ESL games tested by Martha (10 years adult ESL). Each pairs with an AI-generated Edooqoo worksheet for follow-up.',
  author: { '@type': 'Organization', name: 'Edooqoo' },
  publisher: { '@type': 'Organization', name: 'Edooqoo' },
  datePublished: '2026-05-18',
  mainEntityOfPage: 'https://edooqoo.com/blog/esl-games-for-teachers',
};

const EslGamesForTeachers = () => (
  <SeoLandingLayout
    seo={{
      title: 'ESL Games for Teachers — 15 Tested Activities',
      description: '15 ESL games tested by Martha (10 yrs ESL). Speaking, grammar, vocab — each game pairs with an AI-generated Edooqoo worksheet.',
      path: '/blog/esl-games-for-teachers',
      extraJsonLd: blogPostingLd,
    }}
    h1="ESL Games for Teachers — 15 Tested Activities"
    lead="A curated list of 15 ESL games that work with adult learners — tested across hundreds of 1-on-1 and small-group lessons. Each game maps to an Edooqoo worksheet so the language practice continues as homework."
    problems={[
      'Most ESL game lists copy-paste childrens activities and call them adult-friendly.',
      'Games without measurable outcomes feel like padding to results-driven adult students.',
      'Without a worksheet follow-up, target language from a game is forgotten within 48 hours.',
    ]}
    solutionHeading="Three rules every game on this list follows"
    solutions={[
      { title: 'Adult context only', body: 'Vocabulary, scenarios, and props pulled from professional and personal adult life.' },
      { title: 'Measurable language target', body: 'Each game has a clear grammar or vocabulary focus the teacher tracks.' },
      { title: 'Worksheet follow-up', body: 'Edooqoo generates a matching worksheet so language sticks via spaced practice.' },
    ]}
    listHeading="15 ESL games for adult learners"
    listIntro="Categorized by skill focus. CEFR ranges and pairing exercise types listed."
    list={[
      { title: 'Speaking: Two Truths and a Lie (Business)', body: 'B1-C2. Question forms + past simple.' },
      { title: 'Speaking: 60-Second Pitch', body: 'B2-C2. Persuasive language, modal verbs.' },
      { title: 'Speaking: Role-Play Hot Seat', body: 'B1-C1. Functional language for complaints, requests.' },
      { title: 'Speaking: Picture Differences (telephone)', body: 'A2-B2. Locative prepositions, present continuous.' },
      { title: 'Grammar: Conditional Time Machine', body: 'B1-C1. Mixed conditionals.' },
      { title: 'Grammar: Reported Speech Telephone', body: 'B1-B2. Reported speech transformations.' },
      { title: 'Grammar: Article Auction', body: 'B1-C1. A/an/the/zero article.' },
      { title: 'Vocabulary: Idiom Charades (Business)', body: 'B2-C1. Idiomatic expressions.' },
      { title: 'Vocabulary: Phrasal Verb Auction', body: 'B1-C1. Phrasal verbs in context.' },
      { title: 'Vocabulary: Synonym Tower', body: 'B2-C2. Register and lexical range.' },
      { title: 'Vocabulary: Collocation Speed-Match', body: 'B1-C1. Collocations.' },
      { title: 'Writing: Email Editor Race', body: 'B1-C1. Email register + error correction.' },
      { title: 'Writing: Three-Sentence News Summary', body: 'B2-C2. Summary writing.' },
      { title: 'Listening: Dictogloss', body: 'B1-C1. Listening + reconstruction.' },
      { title: 'Pronunciation: Minimal Pair Battle', body: 'A2-B2. Phoneme discrimination.' },
    ]}
    body={
      <>
        <h2 className="text-xl font-bold text-foreground mt-0">Martha's rule for adult ESL games</h2>
        <p>Martha (10 years adult ESL, our internal quality benchmark) has one rule: if a game would make a 40-year-old CFO feel patronized, do not run it. That eliminates 80% of the games on the typical ESL-resources internet. What is left is short, cognitively engaging, and produces measurable language output.</p>
        <p>Pair every game with a follow-up worksheet. The game produces fluency; the worksheet locks in accuracy. After Idiom Charades, assign a 10-minute Idiom Matching exercise from Edooqoo as homework. Objective answers can be checked automatically, and teacher-reviewed results can inform future prep. Three lessons later, the same 8 idioms can reappear in a Reading Comprehension because the teacher uses vocabulary signals in the DSLM layer.</p>
        <h2 className="text-xl font-bold text-foreground">How to time games in a 60-minute lesson</h2>
        <p>Warm-up game (5–7 min). Main input + controlled practice (25 min). Production game (10 min). Worksheet preview + homework assignment (5 min). Closing (3 min). The two games sandwich the lesson — opening to lower the affective filter, closing to apply new language. See our <Link to="/blog/english-games-for-learners" className="text-primary hover:underline">12 games for learners</Link> for a similar list framed for student perspective.</p>
        <p>Want the matching worksheet for any game on this list? Create it through Edooqoo's structured worksheet workflow — see <Link to="/exercise-types" className="text-primary hover:underline">all 29 exercise types</Link> or jump to the <Link to="/esl-worksheets" className="text-primary hover:underline">ESL worksheets generator</Link>.</p>
      </>
    }
    faqs={[
      { question: 'How many games should I use per lesson?', answer: 'Two: one as warm-up, one as production. Both under 10 minutes. More than 2 turns the lesson into entertainment with no language gain.' },
      { question: 'Do these work over Zoom?', answer: 'Yes. Every game on this list runs in a video lesson. Pronunciation and charades games need camera-on; the rest work either way.' },
      { question: 'Can I assign the matching worksheets as homework?', answer: 'Yes. Edooqoo lets you mark specific exercises as homework with a deadline. Objective answers can be checked automatically, and open answers can use AI-assisted evaluation for teacher review.' },
      { question: 'Are these suitable for group lessons?', answer: 'Most are. Auctions, charades, hot seats, and telephone games scale to 2-6 learners with minor adjustments.' },
    ]}
    ctaTitle="Match every game with a printable worksheet"
    ctaBody="Sign up free, pick the exercise type listed next to each game, and create the matching worksheet for teacher review."
  />
);

export default EslGamesForTeachers;
