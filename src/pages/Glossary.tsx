
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const glossaryTerms = [
  { term: "CEFR", definition: "Common European Framework of Reference for Languages. A 6-level scale (A1-C2) for describing language proficiency. Edooqoo generates worksheets calibrated to all CEFR levels." },
  { term: "ESL", definition: "English as a Second Language. Teaching English to non-native speakers in an English-speaking country. Edooqoo is built for ESL teachers." },
  { term: "EFL", definition: "English as a Foreign Language. Teaching English to non-native speakers in a non-English-speaking country. Edooqoo supports EFL teachers worldwide." },
  { term: "TEFL", definition: "Teaching English as a Foreign Language. A qualification for teaching English abroad. Edooqoo helps TEFL-certified teachers create materials efficiently." },
  { term: "TESOL", definition: "Teaching English to Speakers of Other Languages. An umbrella term covering both ESL and EFL. Edooqoo serves the entire TESOL community." },
  { term: "Spaced Repetition", definition: "A learning technique that reviews material at increasing intervals to optimize long-term retention. Edooqoo's flashcards use the SM-2 spaced repetition algorithm." },
  { term: "SM-2 Algorithm", definition: "SuperMemo 2, a spaced repetition algorithm that calculates optimal review intervals based on recall difficulty. Used in Edooqoo's flashcard system for vocabulary retention." },
  { term: "Nano-skill", definition: "A granular, specific competency tracked by Edooqoo's DSLM — e.g., 'B1.grammar.present_perfect.negative'. Enables precise identification of skill gaps." },
  { term: "DSLM", definition: "Dynamic Student Learning Model. Edooqoo's proprietary 4-layer system for tracking student progress: Event Log → Metrics → Profile → Decision Engine." },
  { term: "Mastery", definition: "A score (0-100) indicating how well a student has learned a specific skill. Edooqoo tracks mastery per nano-skill with exponential decay weighting for recency." },
  { term: "Scaffolding", definition: "Providing structured support to help learners achieve tasks just beyond their current ability. Edooqoo's AI scaffolds exercises by adjusting difficulty to the student's level." },
  { term: "Differentiation", definition: "Adapting teaching materials to meet individual student needs. Edooqoo automates differentiation by personalizing worksheets based on each student's CEFR level and skill gaps." },
  { term: "Cloze Test", definition: "A text with words removed (gaps) that students must fill in from context. Edooqoo's 'Gap Text (Cloze)' exercise type generates AI-created cloze tests." },
  { term: "Gap-fill", definition: "An exercise where students fill in missing words in sentences or texts. Edooqoo offers both sentence-level (Fill in the Blanks) and text-level (Gap Text) gap-fill exercises." },
  { term: "Collocation", definition: "Words that naturally occur together (e.g., 'make a decision', 'heavy rain'). Edooqoo generates exercises testing collocational knowledge at each CEFR level." },
  { term: "Reading Comprehension", definition: "The ability to understand written text. One of Edooqoo's 29 exercise types — AI generates original texts with comprehension questions at any CEFR level." },
  { term: "Listening Comprehension", definition: "The ability to understand spoken language. Edooqoo generates 5 types of audio exercises with AI-generated speech for listening practice." },
  { term: "Error Correction", definition: "Identifying and fixing mistakes in written text. An Edooqoo exercise type where students find grammatical or vocabulary errors in sentences." },
  { term: "Sentence Transformation", definition: "Rewriting sentences using different grammatical structures while preserving meaning. An AI-graded exercise type in Edooqoo, common in Cambridge exams." },
  { term: "Paraphrasing", definition: "Restating ideas using different words while keeping the same meaning. An AI-graded exercise type in Edooqoo that develops productive vocabulary skills." },
  { term: "Matching Exercise", definition: "Connecting items from two columns (words to definitions, sentence halves, etc.). A versatile exercise type in Edooqoo for vocabulary and comprehension." },
  { term: "Multiple Choice", definition: "Selecting the correct answer from several options. Edooqoo offers text, audio, and picture-based MCQ variants with automatic grading." },
  { term: "True/False", definition: "Determining whether statements are correct or incorrect. Available in text, audio, and picture variants in Edooqoo." },
  { term: "Odd One Out", definition: "Identifying which item doesn't belong in a group and explaining why. An Edooqoo exercise that tests vocabulary categorization and reasoning." },
  { term: "Word Order", definition: "Arranging scrambled words into correct sentences. An Edooqoo exercise type that practices syntax and sentence structure." },
  { term: "Negative Prefixes", definition: "Prefixes that create opposite meanings (un-, in-, im-, ir-, dis-). A specialized Edooqoo exercise type for word formation practice." },
  { term: "Categorization", definition: "Sorting words or concepts into groups. An Edooqoo exercise type that develops vocabulary organization and semantic relationships." },
  { term: "Dialogue Practice", definition: "Completing or creating conversational exchanges. An Edooqoo exercise type for practicing situational English and functional language." },
  { term: "Discussion Questions", definition: "Open-ended questions requiring extended responses. An AI-graded exercise type in Edooqoo for developing speaking and writing fluency." },
  { term: "Describe Picture", definition: "Writing about an image, describing what you see and inferring meaning. An AI-graded picture exercise in Edooqoo." },
  { term: "Formative Assessment", definition: "Ongoing evaluation during learning to provide feedback and adjust instruction. Edooqoo's homework and live session features support formative assessment." },
  { term: "Summative Assessment", definition: "Evaluation at the end of a learning period to measure achievement. Edooqoo's progress tracking and Welcome Test provide summative data." },
  { term: "Placement Test", definition: "An assessment to determine a student's current language level. Edooqoo's Welcome Test is a 49-question AI placement test covering all skills." },
  { term: "Learning Path", definition: "A structured sequence of learning activities based on student needs. Edooqoo's Welcome Test assigns one of 4 paths: Comfort, Guided, Accelerated, or Target." },
  { term: "Exponential Decay", definition: "A mathematical model where recent data is weighted more heavily than older data. Edooqoo's DSLM uses exponential decay to ensure mastery scores reflect current ability." },
  { term: "Productive Skills", definition: "Speaking and writing — skills where students produce language. Edooqoo exercises like paraphrasing, discussion questions, and describe picture develop productive skills." },
  { term: "Receptive Skills", definition: "Reading and listening — skills where students receive and understand language. Edooqoo's reading and listening comprehension exercises develop receptive skills." },
  { term: "Blended Learning", definition: "Combining face-to-face instruction with online activities. Edooqoo enables blended learning through live sessions, homework, Student Hub, and flashcards." },
  { term: "Flipped Classroom", definition: "Students learn content before class and practice during class. Edooqoo supports this: assign reading/exercises as homework, then use Live Session for interactive practice." },
  { term: "L1 Interference", definition: "When a student's first language patterns negatively affect their English. Edooqoo's AI can target common L1 interference errors in exercises." },
  { term: "Washback Effect", definition: "The influence of testing on teaching and learning. Edooqoo's exam preparation exercises create positive washback by practicing exam-format skills." },
  { term: "Input Hypothesis", definition: "Krashen's theory that language acquisition occurs when learners receive comprehensible input slightly above their current level (i+1). Edooqoo's CEFR calibration ensures appropriate input level." },
  { term: "Register", definition: "The level of formality in language use (formal, neutral, informal). Advanced Edooqoo exercises (C1-C2) practice register awareness and switching." },
  { term: "Lexical Approach", definition: "Teaching language through chunks and collocations rather than individual words. Edooqoo's matching, categorization, and collocation exercises support lexical learning." },
  { term: "Task-Based Learning", definition: "Learning through completing meaningful tasks rather than drilling grammar rules. Edooqoo's discussion questions and describe picture exercises are task-based." },
  { term: "Autonomous Learning", definition: "Students taking responsibility for their own learning. Edooqoo's Student Hub enables autonomous learning through self-paced flashcards, worksheets, and homework." },
  { term: "Interlanguage", definition: "A learner's developing language system between L1 and target language. Edooqoo's error correction exercises help students notice and correct interlanguage errors." },
  { term: "Backwash", definition: "See Washback Effect. The impact of assessment on curriculum and teaching practice." },
  { term: "Communicative Competence", definition: "The ability to use language effectively in real communication. Edooqoo develops this through dialogue practice, discussion questions, and situational exercises." },
  { term: "Fluency vs. Accuracy", definition: "Fluency is smooth, natural communication; accuracy is grammatical correctness. Edooqoo exercises target both — discussion questions for fluency, error correction for accuracy." },
];

const alphabet = [...new Set(glossaryTerms.map(t => t.term[0].toUpperCase()))].sort();

const Glossary = () => {
  useEffect(() => {
    document.title = "ELT Glossary — English Teaching Terms | Edooqoo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Complete glossary of English Language Teaching (ELT) terms. 50+ definitions including CEFR, ESL, EFL, TEFL, spaced repetition, scaffolding, and more. Learn how Edooqoo supports each concept.");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Link to="/" className="text-primary hover:underline text-sm">← Back to Edooqoo</Link>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4">ELT Glossary — English Language Teaching Terms</h1>
        <p className="text-lg text-muted-foreground mb-8">
          A comprehensive glossary of English Language Teaching terminology. Each term includes a definition and how Edooqoo helps teachers apply the concept in practice.
        </p>

        <nav className="flex flex-wrap gap-2 mb-8 pb-4 border-b">
          {alphabet.map(letter => (
            <a key={letter} href={`#letter-${letter}`} className="text-primary hover:underline font-semibold px-2 py-1 rounded hover:bg-primary/10 transition-colors">
              {letter}
            </a>
          ))}
        </nav>

        <div className="space-y-2">
          {alphabet.map(letter => {
            const terms = glossaryTerms.filter(t => t.term[0].toUpperCase() === letter);
            if (terms.length === 0) return null;
            return (
              <div key={letter} id={`letter-${letter}`}>
                <h2 className="text-2xl font-bold text-foreground mt-8 mb-4 border-b pb-2">{letter}</h2>
                {terms.map(({ term, definition }) => (
                  <div key={term} className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground">{term}</h3>
                    <p className="text-muted-foreground leading-relaxed">{definition}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-12 p-6 bg-primary/5 rounded-lg text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Ready to put these concepts into practice?</p>
          <p className="text-muted-foreground mb-4">Edooqoo helps English teachers apply ELT best practices with AI-powered worksheet generation.</p>
          <Link to="/signup" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
            Try Edooqoo Free — 2 Worksheets Included
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Glossary;
