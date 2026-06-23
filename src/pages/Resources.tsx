
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface ResourceCard {
  title: string;
  description: string;
  href: string;
  badge: string;
}

const ResourceCardItem = ({ card }: { card: ResourceCard }) => {
  const body = (
    <>
      <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded mb-2">{card.badge}</span>
      <h3 className="font-semibold text-foreground text-sm mb-1">{card.title}</h3>
      <p className="text-xs text-muted-foreground">{card.description}</p>
    </>
  );
  // v6.9.22 — .html → static file (full-page nav); clean path → React Router.
  if (card.href.endsWith('.html')) {
    return (
      <a href={card.href} className="block rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
        {body}
      </a>
    );
  }
  return (
    <Link to={card.href} className="block rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
      {body}
    </Link>
  );
};

const ResourceSection = ({ title, cards }: { title: string; cards: ResourceCard[] }) => (
  <section className="mb-12">
    <h2 className="text-2xl font-semibold text-foreground mb-6">{title}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => <ResourceCardItem key={card.href} card={card} />)}
    </div>
  </section>
);

const Resources = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  useEffect(() => {
    document.title = 'English Teaching Resources — AI Worksheets, Guides & Tools | Edooqoo';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'Free resources for English teachers: AI worksheet generators, CEFR level guides, exercise tutorials, tool comparisons, blog articles, and teaching tips. Browse 100+ resources.');
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "English Teaching Resources",
      "description": "Free resources for English teachers: AI worksheet generators, CEFR level guides, exercise tutorials, tool comparisons, blog articles, and teaching tips.",
      "url": "https://edooqoo.com/resources",
      "provider": { "@type": "Organization", "name": "Edooqoo", "url": "https://edooqoo.com" }
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const worksheetGenerators: ResourceCard[] = [
    { title: "AI Worksheet Generator", description: "Create personalized ESL/EFL worksheets with 29 exercise types.", href: "/ai-worksheet-generator-for-english-teachers.html", badge: "Tool" },
    { title: "Grammar Worksheet Generator", description: "Generate grammar exercises for any CEFR level.", href: "/grammar-worksheet-generator.html", badge: "Grammar" },
    { title: "Vocabulary Exercise Generator", description: "Create vocabulary activities with context and definitions.", href: "/vocabulary-exercise-generator.html", badge: "Vocabulary" },
    { title: "Fill in the Blanks Generator", description: "Gap-fill exercises for grammar and vocabulary practice.", href: "/fill-in-the-blanks-worksheet-generator.html", badge: "Exercise" },
    { title: "Reading Comprehension Maker", description: "Generate reading passages with comprehension questions.", href: "/reading-comprehension-worksheet-maker.html", badge: "Reading" },
    { title: "Multiple Choice Quiz Generator", description: "Create MCQ quizzes for any English topic.", href: "/multiple-choice-quiz-generator-english.html", badge: "Quiz" },
    { title: "Listening Comprehension Exercises", description: "AI-generated audio exercises for ESL students.", href: "/listening-comprehension-exercises-esl.html", badge: "Audio" },
    { title: "How to Create Worksheets with AI", description: "Step-by-step guide to AI worksheet creation.", href: "/how-to-create-english-worksheets-with-ai.html", badge: "Guide" },
  ];

  const cefrLevels: ResourceCard[] = [
    { title: "CEFR Worksheet Generator", description: "AI worksheets aligned to all 6 CEFR levels.", href: "/cefr-worksheet-generator.html", badge: "CEFR" },
    { title: "A1 Beginner Worksheets", description: "Worksheets for absolute beginners.", href: "/a1-beginner-english-worksheets.html", badge: "A1" },
    { title: "A2 Elementary Worksheets", description: "Elementary level English exercises.", href: "/a2-elementary-english-worksheets.html", badge: "A2" },
    { title: "B1 Intermediate Worksheets", description: "Intermediate English practice materials.", href: "/b1-intermediate-english-worksheets.html", badge: "B1" },
    { title: "B2 Upper Intermediate Worksheets", description: "Upper intermediate exercises and activities.", href: "/b2-upper-intermediate-english-worksheets.html", badge: "B2" },
    { title: "C1 Advanced Worksheets", description: "Advanced English worksheets for proficient learners.", href: "/c1-advanced-english-worksheets.html", badge: "C1" },
    { title: "C2 Proficiency Worksheets", description: "Near-native proficiency level materials.", href: "/c2-proficiency-english-worksheets.html", badge: "C2" },
  ];

  const teachingTools: ResourceCard[] = [
    { title: "Best AI Tools for ESL Teachers", description: "Compare top AI tools for English teaching.", href: "/best-ai-tools-for-esl-teachers.html", badge: "Comparison" },
    { title: "AI Lesson Planning", description: "Plan lessons with AI-generated materials.", href: "/ai-lesson-planning-for-english-teachers.html", badge: "Planning" },
    { title: "Online English Teaching Tools", description: "Essential tools for online ESL instruction.", href: "/online-english-teaching-tools.html", badge: "Online" },
    { title: "How to Save Time as English Teacher", description: "Time-saving strategies with AI assistance.", href: "/how-to-save-time-as-english-teacher.html", badge: "Productivity" },
    { title: "ESL Student Progress Tracking", description: "Track student skills and mastery over time.", href: "/esl-student-progress-tracking-tool.html", badge: "Tracking" },
    { title: "ESL Homework Review Tool", description: "AI-assisted homework evaluation with teacher review.", href: "/esl-homework-grading-tool.html", badge: "Review" },
    { title: "AI-Assisted Homework Review Tool", description: "Teacher-reviewed evaluation of open-ended answers.", href: "/ai-grading-tool-for-english-homework.html", badge: "AI" },
    { title: "Spaced Repetition Flashcards", description: "SM-2 algorithm flashcards for vocabulary retention.", href: "/spaced-repetition-flashcards-esl.html", badge: "Flashcards" },
  ];

  const specialized: ResourceCard[] = [
    { title: "Business English Generator", description: "Worksheets for meetings, emails, negotiations.", href: "/business-english-worksheet-generator.html", badge: "Business" },
    { title: "Exam Preparation Worksheets", description: "Practice for Cambridge, IELTS, and TOEFL.", href: "/exam-preparation-worksheets-cambridge-ielts.html", badge: "Exams" },
    { title: "For Private Tutors", description: "AI tools designed for 1-on-1 English tutoring.", href: "/ai-tools-for-private-english-tutors.html", badge: "Tutors" },
    { title: "For Language Schools", description: "Scale worksheet creation for your school.", href: "/worksheet-generator-for-language-schools.html", badge: "Schools" },
    { title: "For Online ESL Teachers", description: "Tools for remote English teaching.", href: "/ai-tools-for-online-esl-teachers.html", badge: "Online" },
  ];

  const comparisons: ResourceCard[] = [
    { title: "Edooqoo vs ChatGPT", description: "Tutor workflow vs general-purpose AI drafting.", href: "/edooqoo-vs-chatgpt.html", badge: "Compare" },
    { title: "Edooqoo vs Claude", description: "Stored learner context vs one-off AI assistance.", href: "/edooqoo-vs-claude.html", badge: "Compare" },
    { title: "Edooqoo vs General AI", description: "Recurring 1:1 prep workflow vs generic chat tools.", href: "/edooqoo-vs-general-purpose-ai.html", badge: "Compare" },
    { title: "Edooqoo vs Gemini", description: "Tutor workflow vs general AI drafting and research.", href: "/edooqoo-vs-gemini.html", badge: "Compare" },
    { title: "Edooqoo vs Copilot", description: "English-tutor workflow vs general productivity AI.", href: "/edooqoo-vs-copilot.html", badge: "Compare" },
    { title: "Edooqoo vs Perplexity", description: "Recurring lesson workflow vs answer research.", href: "/edooqoo-vs-perplexity.html", badge: "Compare" },
    { title: "ChatGPT Alternative for English Tutors", description: "When a tutor needs context, homework evidence, and review.", href: "/chatgpt-alternative-for-english-tutors.html", badge: "Guide" },
    { title: "ChatGPT for ESL Teachers: Limitations", description: "Where prompts help and where tutor workflow context matters.", href: "/chatgpt-for-esl-teachers-limitations.html", badge: "LLM" },
    { title: "AI Lesson Prep Tool vs Chatbot", description: "Structured prep workflow vs one-off prompt drafting.", href: "/ai-lesson-prep-tool-vs-chatbot.html", badge: "Guide" },
    { title: "AI Chatbot vs Student Context System", description: "One-off drafting vs stored learner evidence.", href: "/ai-chatbot-vs-student-context-system.html", badge: "LLM" },
    { title: "Teacher-Controlled AI", description: "How English tutors keep objectives, evidence, and review under teacher control.", href: "/teacher-controlled-ai-for-english-tutors.html", badge: "Guide" },
    { title: "AI Worksheet Tools Criteria", description: "Evaluate worksheet tools by editability, task fit, evidence, and review.", href: "/best-ai-worksheet-tools-for-english-tutors.html", badge: "Criteria" },
    { title: "AI Tools for Private Tutors", description: "Workflow criteria for adult 1:1 English tutors.", href: "/best-ai-tools-for-private-english-tutors.html", badge: "Criteria" },
    { title: "Edooqoo vs ISLCollective", description: "AI-generated vs user-uploaded worksheets.", href: "/edooqoo-vs-islcollective.html", badge: "Compare" },
    { title: "Edooqoo vs Liveworksheets", description: "AI generation vs manual interactive conversion.", href: "/edooqoo-vs-liveworksheets.html", badge: "Compare" },
    { title: "Edooqoo vs Twee", description: "Complete ecosystem vs quick text generation.", href: "/edooqoo-vs-twee.html", badge: "Compare" },
    { title: "Edooqoo vs MagicSchool", description: "English-specific vs general K-12 AI.", href: "/edooqoo-vs-magicschool.html", badge: "Compare" },
  ];

  const guides: ResourceCard[] = [
    { title: "All 29 Exercise Types", description: "Descriptions, CEFR levels, and use cases.", href: "/exercise-types", badge: "Guide" },
    { title: "Prompt Library", description: "50+ ready-to-use prompts for worksheet creation.", href: "/prompts", badge: "Prompts" },
    { title: "ELT Glossary", description: "50+ English teaching terms with definitions.", href: "/glossary", badge: "Reference" },
    { title: "How It Works", description: "8-step guide to using Edooqoo.", href: "/how-it-works", badge: "Guide" },
  ];

  const blogArticles: ResourceCard[] = [
    { title: "How to Create Grammar Worksheets with AI", description: "Step-by-step guide with CEFR grammar topics.", href: "/blog/how-to-create-grammar-worksheets-with-ai.html", badge: "Blog" },
    { title: "10 Vocabulary Teaching Strategies", description: "ESL vocabulary strategies with AI examples.", href: "/blog/vocabulary-teaching-strategies-esl.html", badge: "Blog" },
    { title: "15 Reading Comprehension Activities", description: "Activities from A1 to C2 for English classes.", href: "/blog/reading-comprehension-activities-english.html", badge: "Blog" },
    { title: "Fill in the Blanks Best Practices", description: "How to create effective gap-fill exercises.", href: "/blog/fill-in-the-blanks-exercises-best-practices.html", badge: "Blog" },
    { title: "Differentiated Instruction Guide", description: "Practical guide for the English classroom.", href: "/blog/differentiated-instruction-english-classroom.html", badge: "Blog" },
    { title: "How to Assess English Level (CEFR)", description: "Complete teacher's guide to CEFR assessment.", href: "/blog/how-to-assess-english-level-cefr.html", badge: "Blog" },
    { title: "Teaching English Online Guide", description: "Complete guide for online ESL teachers.", href: "/blog/teaching-english-online-complete-guide.html", badge: "Blog" },
    { title: "Spaced Repetition for Vocabulary", description: "The science and practice of spaced repetition.", href: "/blog/spaced-repetition-vocabulary-learning.html", badge: "Blog" },
    { title: "Best AI Tools for English Teachers 2026", description: "Compare all AI tools for ELT.", href: "/blog/ai-tools-for-english-teachers-2026.html", badge: "Blog" },
    { title: "AI-Assisted Homework Review Guide", description: "Use teacher-reviewed AI support for homework feedback.", href: "/blog/ai-homework-grading-for-english-teachers.html", badge: "Blog" },
    { title: "AI-Generated Listening Exercises", description: "How TTS changes language teaching.", href: "/blog/ai-generated-listening-exercises-esl.html", badge: "Blog" },
    { title: "Personalized Learning in English", description: "From theory to AI-powered practice.", href: "/blog/personalized-learning-english-teaching.html", badge: "Blog" },
    { title: "Cambridge Exam Preparation Tips", description: "Worksheet strategies for Cambridge exams.", href: "/blog/cambridge-exam-preparation-tips-teachers.html", badge: "Blog" },
    { title: "Teaching Business English Guide", description: "Complete guide for ESL tutors and schools.", href: "/blog/teaching-business-english-guide.html", badge: "Blog" },
    { title: "IELTS Preparation Worksheets", description: "Teacher's guide to effective IELTS practice.", href: "/blog/ielts-preparation-worksheets-guide.html", badge: "Blog" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</Link>
            <Link to="/signup" state={fromState} className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity">Sign Up Free</Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <h1 className="text-4xl font-bold text-foreground mb-4">English Teaching Resources</h1>
        <p className="text-lg text-muted-foreground mb-12 max-w-3xl">
          Free resources for English teachers: AI worksheet generators, CEFR level guides, exercise tutorials, tool comparisons, blog articles, and practical teaching tips. Browse 100+ resources.
        </p>

        <ResourceSection title="Worksheet Generators" cards={worksheetGenerators} />
        <ResourceSection title="CEFR Level Guides" cards={cefrLevels} />
        <ResourceSection title="Teaching Tools & Productivity" cards={teachingTools} />
        <ResourceSection title="Specialized Teaching" cards={specialized} />
        <ResourceSection title="Comparisons" cards={comparisons} />
        <ResourceSection title="Guides & References" cards={guides} />
        <ResourceSection title="Blog Articles" cards={blogArticles} />
      </main>
    </div>
  );
};

export default Resources;
