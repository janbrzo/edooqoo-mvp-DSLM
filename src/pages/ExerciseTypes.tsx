
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const exerciseTypes = [
  { category: "Basic Exercises", types: [
    { name: "Reading Comprehension", description: "Students read an AI-generated passage and answer questions about content, inference, and vocabulary in context. The AI creates original texts on any topic, calibrated to the student's CEFR level.", bestFor: "A1-C2", useCase: "Testing understanding of written text, building vocabulary in context, developing inference skills." },
    { name: "Fill in the Blanks", description: "Complete sentences with missing words. The AI selects gaps that target specific grammar points or vocabulary items. Supports both grammar-focused and vocabulary-focused gap-fill.", bestFor: "A1-C2", useCase: "Practicing verb tenses, prepositions, collocations, and topic vocabulary in context." },
    { name: "Multiple Choice", description: "Select the correct answer from 3-4 options. The AI creates plausible distractors that test real understanding rather than guessing. Covers grammar, vocabulary, and comprehension.", bestFor: "A1-C2", useCase: "Quick assessment of grammar and vocabulary knowledge, exam preparation (FCE, CAE, IELTS)." },
    { name: "True/False Questions", description: "Determine if statements are true or false based on a text or general knowledge. Simple format that builds comprehension confidence.", bestFor: "A1-C2", useCase: "Reading comprehension checks, factual knowledge assessment, IELTS true/false/not given practice." },
    { name: "Matching Exercise", description: "Match items from two columns — words to definitions, sentences to pictures, or terms to explanations. Low cognitive load makes it ideal for vocabulary introduction.", bestFor: "A1-C2", useCase: "Vocabulary introduction, definition practice, concept linking." },
    { name: "Dialogue Practice", description: "Complete or create dialogues for specific situations. Practices conversational English with realistic scenarios like shopping, booking, or job interviews.", bestFor: "A1-C1", useCase: "Functional language practice, role-play preparation, situational English." },
    { name: "Answer Questions", description: "Open-ended questions requiring full sentence answers. Tests both comprehension and productive language ability. AI evaluates answer quality.", bestFor: "A2-C2", useCase: "Testing comprehension depth, developing written production, Cambridge exam practice." },
    { name: "Discussion Questions", description: "Thought-provoking questions for speaking or writing practice. AI grades written responses for relevance, coherence, grammar, and vocabulary.", bestFor: "B1-C2", useCase: "Speaking preparation, critical thinking, essay writing practice, debate skills." },
    { name: "Error Correction", description: "Find and correct grammatical or vocabulary errors in sentences. Develops accuracy awareness and editing skills.", bestFor: "A2-C2", useCase: "Grammar accuracy training, proofreading skills, FCE/CAE Use of English preparation." },
    { name: "Odd One Out", description: "Identify which word doesn't belong in a group and explain why. Tests vocabulary categorization and reasoning ability.", bestFor: "A1-B2", useCase: "Vocabulary categorization, semantic relationships, analytical thinking." },
    { name: "Matching Halves", description: "Match sentence beginnings with correct endings. Tests grammatical knowledge and reading comprehension.", bestFor: "A2-C1", useCase: "Complex sentence practice, conditional structures, cause and effect." },
    { name: "Word Order", description: "Rearrange scrambled words into correct sentences. Builds understanding of English syntax and word order rules.", bestFor: "A1-B2", useCase: "Syntax practice, question formation, complex sentence building." },
    { name: "Gap Text (Cloze)", description: "Fill gaps in a longer text. Tests contextual understanding, grammar, and vocabulary in connected discourse.", bestFor: "B1-C2", useCase: "Advanced reading skills, contextual guessing, FCE/CAE open cloze." },
    { name: "Negative Prefixes", description: "Add correct negative prefixes (un-, in-, im-, ir-, dis-) to words. Practices English word formation rules.", bestFor: "A2-C1", useCase: "Word formation, vocabulary building, Cambridge exam preparation." },
    { name: "Categorization", description: "Sort words or phrases into correct categories. Develops vocabulary organization and semantic networks.", bestFor: "A1-B2", useCase: "Vocabulary organization, topic vocabulary review, concept grouping." },
    { name: "Complete Word", description: "Fill in missing letters to complete words based on definitions or context clues. Tests spelling and vocabulary knowledge.", bestFor: "A1-B2", useCase: "Spelling practice, vocabulary recall, crossword-style exercises." },
    { name: "Paraphrasing", description: "Rewrite sentences keeping the same meaning using different words. AI grades for meaning preservation, grammar, and vocabulary range.", bestFor: "B1-C2", useCase: "Writing skills, vocabulary flexibility, Cambridge exam preparation." },
    { name: "Sentence Transformation", description: "Transform sentences using specific grammar structures (e.g., active→passive, direct→reported speech). AI grades for accuracy.", bestFor: "B1-C2", useCase: "Grammar mastery, Use of English practice, structural flexibility." },
    { name: "Synonyms Matching", description: "Match words with their synonyms from a provided list. Expands productive vocabulary range.", bestFor: "A2-C2", useCase: "Vocabulary expansion, writing improvement, synonym awareness." },
    { name: "Antonyms Matching", description: "Match words with their antonyms from a provided list. Builds understanding of word relationships.", bestFor: "A2-C2", useCase: "Vocabulary building, word relationships, descriptive language." },
  ]},
  { category: "Audio Exercises", types: [
    { name: "Listening Comprehension", description: "Listen to AI-generated audio and answer comprehension questions. Audio is calibrated to the student's CEFR level with appropriate speed and complexity.", bestFor: "A1-C2", useCase: "Developing listening skills, exam preparation (IELTS, Cambridge), real-world comprehension." },
    { name: "Fill in the Blanks (Audio)", description: "Listen to audio and fill in missing words in a transcript. Combines listening with writing accuracy.", bestFor: "A2-C2", useCase: "Dictation practice, spelling in listening context, note-taking skills." },
    { name: "Multiple Choice (Audio)", description: "Listen to audio and select correct answers from options. Standard listening exam format.", bestFor: "A1-C2", useCase: "Listening exam preparation, comprehension checking, information extraction." },
    { name: "True/False (Audio)", description: "Listen to audio and determine if statements are true or false. Tests listening for specific information.", bestFor: "A1-C2", useCase: "Listening for detail, factual comprehension, IELTS preparation." },
    { name: "Answer Questions (Audio)", description: "Listen to audio and write open-ended answers. AI evaluates response quality and relevance.", bestFor: "A2-C2", useCase: "Advanced listening skills, note-taking, integrated skills practice." },
  ]},
  { category: "Picture Exercises", types: [
    { name: "Describe Picture", description: "Write a description of an AI-generated image. AI grades for accuracy, detail, vocabulary range, and grammar.", bestFor: "A2-C2", useCase: "Speaking exam preparation, descriptive writing, vocabulary activation." },
    { name: "Multiple Choice (Picture)", description: "Look at an image and select the correct answer from options. Tests visual comprehension and vocabulary.", bestFor: "A1-C1", useCase: "Vocabulary testing, visual literacy, lower-level comprehension." },
    { name: "True/False (Picture)", description: "Look at an image and determine if statements about it are true or false.", bestFor: "A1-B2", useCase: "Visual comprehension, descriptive language, attention to detail." },
    { name: "Answer Questions (Picture)", description: "Look at an image and answer open-ended questions about it. AI evaluates responses.", bestFor: "A2-C2", useCase: "Speaking preparation, inference skills, creative language use." },
  ]},
];

const ExerciseTypes = () => {
  useEffect(() => {
    document.title = "29 Exercise Types for English Teachers — Edooqoo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Detailed guide to all 29 exercise types in Edooqoo: 20 basic, 5 audio, 4 picture exercises. Each with description, CEFR levels, and use cases for ESL/EFL teachers.");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Link to="/" className="text-primary hover:underline text-sm">← Back to Edooqoo</Link>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4">29 Exercise Types for English Teachers</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Edooqoo offers 29 AI-generated exercise types across 3 categories. All types are available on every plan, including the free demo. Each exercise is automatically calibrated to the student's CEFR level (A1-C2).
        </p>

        {exerciseTypes.map(category => (
          <div key={category.category} className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2">
              {category.category} ({category.types.length} types)
            </h2>
            <div className="space-y-6">
              {category.types.map(type => (
                <div key={type.name} className="p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{type.name}</h3>
                  <p className="text-muted-foreground mb-3">{type.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-primary font-medium">Best for: {type.bestFor}</span>
                    <span className="text-muted-foreground">Use case: {type.useCase}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-12 p-6 bg-primary/5 rounded-lg text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Try all 29 exercise types for free</p>
          <p className="text-muted-foreground mb-4">Sign up and get 2 free worksheets with access to every exercise type.</p>
          <Link to="/signup" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
            Try Edooqoo Free
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypes;
