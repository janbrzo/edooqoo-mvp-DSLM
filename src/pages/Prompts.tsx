
import React, { useEffect, useState } from 'react';
import { Copy, Check, Search, BookOpen, MessageSquare, Headphones, Briefcase, GraduationCap, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import StickyNav from '@/components/landing/StickyNav';

interface Prompt {
  title: string;
  text: string;
  level: string;
  category: string;
}

const prompts: Prompt[] = [
  // Vocabulary
  { title: "Travel Vocabulary Worksheet", text: "Create a B1 vocabulary worksheet about travel and tourism. Include fill in the blanks, matching exercises, and a dialogue practice at an airport. Focus on common travel phrases and hotel vocabulary.", level: "B1", category: "Vocabulary" },
  { title: "Food & Cooking Vocabulary", text: "Generate an A2 worksheet about food, cooking, and restaurants. Include matching exercise for cooking verbs, fill in the blanks with food vocabulary, and a dialogue practice ordering food at a restaurant.", level: "A2", category: "Vocabulary" },
  { title: "Technology Vocabulary for Adults", text: "Create a B2 vocabulary worksheet about technology and digital life. Include synonyms matching, categorization exercise (hardware vs software vs internet terms), and discussion questions about technology habits.", level: "B2", category: "Vocabulary" },
  { title: "Health & Body Vocabulary", text: "Generate an A2 worksheet about health, body parts, and visiting the doctor. Include matching exercise, fill in the blanks, and a dialogue practice at a doctor's office.", level: "A2", category: "Vocabulary" },
  { title: "Work & Office Vocabulary", text: "Create a B1 vocabulary worksheet about work and office life. Include categorization exercise, fill in the blanks with work-related collocations, and multiple choice questions.", level: "B1", category: "Vocabulary" },
  { title: "Environment & Nature Vocabulary", text: "Generate a B2 vocabulary worksheet about environmental issues and nature. Include negative prefixes exercise, synonyms matching for environmental terms, and discussion questions about climate change.", level: "B2", category: "Vocabulary" },
  { title: "Emotions & Personality Vocabulary", text: "Create a B1 worksheet about emotions, feelings, and personality traits. Include antonyms matching, categorization (positive vs negative traits), and sentence transformation with emotional vocabulary.", level: "B1", category: "Vocabulary" },
  { title: "Shopping & Money Vocabulary", text: "Generate an A2 worksheet about shopping, money, and transactions. Include fill in the blanks, dialogue practice in a shop, and matching exercise for prices and quantities.", level: "A2", category: "Vocabulary" },
  { title: "Advanced Academic Vocabulary", text: "Create a C1 vocabulary worksheet with academic word list items. Include complete word exercises, paraphrasing with academic register, and sentence transformation using formal vocabulary.", level: "C1", category: "Vocabulary" },

  // Grammar
  { title: "Present Perfect vs Past Simple", text: "Create a B1 grammar worksheet comparing present perfect and past simple tenses. Include fill in the blanks (choosing the correct tense), error correction, sentence transformation, and gap text exercises.", level: "B1", category: "Grammar" },
  { title: "Conditionals (1st and 2nd)", text: "Generate a B1-B2 grammar worksheet on first and second conditionals. Include fill in the blanks, matching halves (matching if-clauses with results), sentence transformation, and discussion questions using conditionals.", level: "B1-B2", category: "Grammar" },
  { title: "Passive Voice Practice", text: "Create a B2 grammar worksheet on passive voice in various tenses. Include sentence transformation (active to passive), fill in the blanks, error correction, and a reading comprehension text with passive constructions.", level: "B2", category: "Grammar" },
  { title: "Articles (a/an/the/zero)", text: "Generate an A2-B1 grammar worksheet on English articles. Include fill in the blanks, error correction with article mistakes, gap text, and multiple choice questions.", level: "A2-B1", category: "Grammar" },
  { title: "Reported Speech", text: "Create a B2 grammar worksheet on reported speech. Include sentence transformation (direct to indirect), fill in the blanks with reporting verbs, and error correction exercises.", level: "B2", category: "Grammar" },
  { title: "Modal Verbs for Advice & Obligation", text: "Generate a B1 grammar worksheet on modal verbs (should, must, have to, ought to). Include multiple choice, fill in the blanks, matching exercises, and discussion questions about giving advice.", level: "B1", category: "Grammar" },
  { title: "Relative Clauses", text: "Create a B2 grammar worksheet on defining and non-defining relative clauses. Include sentence transformation (combining sentences with who/which/that/where), error correction, and gap text.", level: "B2", category: "Grammar" },
  { title: "Comparative & Superlative", text: "Generate an A2 grammar worksheet on comparatives and superlatives. Include fill in the blanks, error correction, sentence transformation, and multiple choice questions comparing things.", level: "A2", category: "Grammar" },
  { title: "Advanced Inversion Structures", text: "Create a C1 grammar worksheet on inversion after negative adverbials (Never have I, Not only...but also, Hardly had...when). Include sentence transformation, fill in the blanks, and error correction.", level: "C1", category: "Grammar" },

  // Reading
  { title: "Reading: Daily Routines", text: "Create an A1-A2 reading comprehension worksheet about daily routines. Include a short text about someone's typical day, true/false questions, answer questions, and vocabulary matching exercise.", level: "A1-A2", category: "Reading" },
  { title: "Reading: Social Media Impact", text: "Generate a B2 reading comprehension worksheet about the impact of social media on society. Include a 400-word text, multiple choice questions, true/false with justification, and discussion questions.", level: "B2", category: "Reading" },
  { title: "Reading: Job Interview Tips", text: "Create a B1 reading comprehension worksheet about preparing for job interviews. Include answer questions, true/false, vocabulary fill in the blanks from the text, and a matching exercise.", level: "B1", category: "Reading" },
  { title: "Reading: Climate Change", text: "Generate a B2-C1 reading comprehension worksheet about climate change solutions. Include a detailed text, multiple choice, paraphrasing exercises, and discussion questions about environmental responsibility.", level: "B2-C1", category: "Reading" },
  { title: "Reading: Cultural Differences", text: "Create a B1-B2 reading comprehension about cultural differences in communication styles. Include true/false questions, answer questions, vocabulary exercises, and discussion questions.", level: "B1-B2", category: "Reading" },
  { title: "Reading: Space Exploration", text: "Generate a B2 reading comprehension worksheet about recent space exploration achievements. Include multiple choice, sentence transformation, vocabulary matching, and opinion discussion questions.", level: "B2", category: "Reading" },

  // Speaking & Discussion
  { title: "Discussion: Work-Life Balance", text: "Create a B2 discussion-focused worksheet about work-life balance. Include discussion questions, a dialogue practice between two colleagues, vocabulary for expressing opinions, and paraphrasing exercises.", level: "B2", category: "Speaking" },
  { title: "Debate: Technology in Education", text: "Generate a B2-C1 worksheet for a structured debate about technology in education. Include discussion questions (for and against), vocabulary for debating, sentence transformation for hedging language.", level: "B2-C1", category: "Speaking" },
  { title: "Role Play: Restaurant Complaint", text: "Create a B1 worksheet with a dialogue practice about making a complaint at a restaurant. Include the dialogue, vocabulary matching for complaint phrases, and fill in the blanks for polite language.", level: "B1", category: "Speaking" },
  { title: "Discussion: Future Predictions", text: "Generate a B1-B2 discussion worksheet about predictions for the future. Include discussion questions using will/going to/might, sentence transformation with future forms, and vocabulary for predictions.", level: "B1-B2", category: "Speaking" },
  { title: "Everyday Small Talk", text: "Create an A2-B1 worksheet about making small talk. Include dialogue practice, matching exercises for conversation starters, fill in the blanks with social phrases, and role-play scenarios.", level: "A2-B1", category: "Speaking" },
  { title: "Advanced Presentation Skills", text: "Create a C1 worksheet about giving professional presentations in English. Include vocabulary for signposting, paraphrasing exercises, discussion questions, and sentence transformation for formal register.", level: "C1", category: "Speaking" },

  // Business English
  { title: "Business Email Writing", text: "Create a B2 Business English worksheet about writing professional emails. Include fill in the blanks with email phrases, sentence transformation (informal to formal), matching exercise for email openings/closings, and error correction.", level: "B2", category: "Business English" },
  { title: "Meeting Language", text: "Generate a B2 Business English worksheet about participating in meetings. Include dialogue practice, vocabulary matching for meeting phrases (agreeing, disagreeing, suggesting), and fill in the blanks.", level: "B2", category: "Business English" },
  { title: "Negotiation Vocabulary", text: "Create a C1 Business English worksheet about negotiation language. Include vocabulary matching, fill in the blanks with negotiation idioms, paraphrasing exercises, and discussion questions about negotiation strategies.", level: "C1", category: "Business English" },
  { title: "Financial English", text: "Generate a B2-C1 Business English worksheet about financial terminology. Include categorization exercise, fill in the blanks with financial terms, reading comprehension about market trends, and multiple choice.", level: "B2-C1", category: "Business English" },
  { title: "Job Application Process", text: "Create a B1-B2 Business English worksheet about applying for jobs. Include vocabulary for CVs and cover letters, fill in the blanks, dialogue practice for a phone interview, and discussion questions.", level: "B1-B2", category: "Business English" },
  { title: "Corporate Culture", text: "Generate a B2 Business English worksheet about corporate culture and workplace communication. Include reading comprehension, discussion questions, vocabulary matching, and sentence transformation.", level: "B2", category: "Business English" },
  { title: "Marketing & Advertising English", text: "Create a B2-C1 worksheet about marketing vocabulary and advertising techniques. Include categorization, fill in the blanks with marketing collocations, discussion questions, and a reading comprehension about a campaign.", level: "B2-C1", category: "Business English" },
  { title: "HR & Recruitment Language", text: "Generate a B2 Business English worksheet about HR processes and recruitment. Include vocabulary matching, fill in the blanks, dialogue practice for a performance review, and discussion questions.", level: "B2", category: "Business English" },

  // Exam Prep
  { title: "FCE Reading & Use of English Practice", text: "Create a B2 worksheet aligned with Cambridge FCE (B2 First) format. Include multiple choice cloze, word formation (complete word), sentence transformation (key word transformation style), and reading comprehension.", level: "B2", category: "Exam Prep" },
  { title: "CAE Advanced Grammar Practice", text: "Generate a C1 worksheet aligned with Cambridge CAE format. Include sentence transformation with key words, error correction (find the extra word), gap text with advanced vocabulary, and multiple choice.", level: "C1", category: "Exam Prep" },
  { title: "IELTS Reading Practice", text: "Create a B2-C1 worksheet with IELTS-style reading exercises. Include true/false/not given questions, matching headings (matching halves), fill in the blanks summary completion, and answer questions.", level: "B2-C1", category: "Exam Prep" },
  { title: "PET (B1 Preliminary) Practice", text: "Generate a B1 worksheet aligned with Cambridge PET format. Include multiple choice reading, fill in the blanks, sentence transformation, and true/false questions from a short text.", level: "B1", category: "Exam Prep" },
  { title: "KET (A2 Key) Practice", text: "Create an A2 worksheet aligned with Cambridge KET format. Include multiple choice, matching exercise, fill in the blanks with basic grammar, and reading comprehension with short texts.", level: "A2", category: "Exam Prep" },
  { title: "CPE Proficiency Practice", text: "Generate a C2 worksheet with Cambridge CPE-style exercises. Include word formation with advanced derivation, sentence transformation, gap text with nuanced vocabulary, and error correction.", level: "C2", category: "Exam Prep" },
  { title: "TOEFL Independent Writing Practice", text: "Create a B2-C1 worksheet focused on TOEFL writing skills. Include discussion questions (essay topic brainstorming), paraphrasing exercises, sentence transformation for academic style, and vocabulary for argumentation.", level: "B2-C1", category: "Exam Prep" },

  // Mixed / Creative
  { title: "Listening: News Report", text: "Create a B2 listening comprehension worksheet based on a news report about a current event. Include true/false (audio), multiple choice (audio), fill in the blanks (audio), and answer questions (audio).", level: "B2", category: "Vocabulary" },
  { title: "Picture Description Practice", text: "Generate a B1-B2 worksheet with picture exercises. Include describe picture, multiple choice (picture), true/false (picture), and answer questions (picture). Topic: city life and urban scenes.", level: "B1-B2", category: "Speaking" },
  { title: "Idioms & Phrasal Verbs", text: "Create a B2-C1 vocabulary worksheet about common English idioms and phrasal verbs. Include matching exercise, fill in the blanks, categorization (by topic: work, relationships, money), and sentence transformation.", level: "B2-C1", category: "Vocabulary" },
  { title: "Collocations Practice", text: "Generate a B2 worksheet focused on common English collocations. Include matching exercise (verb + noun collocations), fill in the blanks, odd one out, and sentence transformation exercises.", level: "B2", category: "Vocabulary" },
];

const categories = ["All", "Vocabulary", "Grammar", "Reading", "Speaking", "Business English", "Exam Prep"];

const categoryIcons: Record<string, React.ReactNode> = {
  "Vocabulary": <BookOpen className="w-4 h-4" />,
  "Grammar": <PenTool className="w-4 h-4" />,
  "Reading": <BookOpen className="w-4 h-4" />,
  "Speaking": <MessageSquare className="w-4 h-4" />,
  "Business English": <Briefcase className="w-4 h-4" />,
  "Exam Prep": <GraduationCap className="w-4 h-4" />,
};

const Prompts = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    document.title = "50+ Ready-to-Use Prompts for English Teachers — Edooqoo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Copy-paste prompts for creating English worksheets with AI. Vocabulary, Grammar, Reading, Speaking, Business English, and Exam Prep prompts for CEFR levels A1-C2.');
  }, []);

  const filtered = prompts.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = search === '' || 
      p.title.toLowerCase().includes(search.toLowerCase()) || 
      p.text.toLowerCase().includes(search.toLowerCase()) ||
      p.level.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <StickyNav isRegisteredUser={false} tokenLeft={0} user={null} />
      
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            50+ Ready-to-Use Prompts for English Teachers
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Copy any prompt below and paste it into Edooqoo's worksheet generator to create personalized English worksheets in seconds. Organized by category and CEFR level.
          </p>
        </header>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts by topic, level, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map(cat => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className="gap-1.5"
              >
                {cat !== "All" && categoryIcons[cat]}
                {cat}
                {cat !== "All" && (
                  <span className="text-xs opacity-70">
                    ({prompts.filter(p => p.category === cat).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Prompts Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((prompt, i) => (
            <article
              key={i}
              className="border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground text-sm">{prompt.title}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-xs">{prompt.level}</Badge>
                  <Badge variant="outline" className="text-xs">{prompt.category}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{prompt.text}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(prompt.text, i)}
                className="gap-1.5 text-xs h-7"
              >
                {copiedIndex === i ? (
                  <><Check className="w-3 h-3" /> Copied!</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copy Prompt</>
                )}
              </Button>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No prompts match your search. Try different keywords.</p>
        )}

        {/* CTA */}
        <div className="text-center mt-16 p-8 bg-primary/5 rounded-xl border">
          <h2 className="text-2xl font-bold text-foreground mb-2">Ready to Create Your Worksheet?</h2>
          <p className="text-muted-foreground mb-4">Copy any prompt above and paste it into Edooqoo. Your first 2 worksheets are free.</p>
          <Button asChild size="lg">
            <a href="/signup">Sign Up Free — 2 Worksheets Included</a>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Prompts;
