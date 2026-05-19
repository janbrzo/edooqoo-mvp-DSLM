
import React from 'react';
import { Link } from 'react-router-dom';

const GlobalFooter = () => {
  return (
    <footer className="border-t bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-10">
        {/* Brand */}
        <div className="mb-8">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <p className="text-sm text-muted-foreground mt-1">AI Worksheet Generator for English Teachers</p>
        </div>

        {/* 5-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-8">
          {/* Column 1: Product */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Product</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-muted-foreground hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link to="/exercise-types" className="text-muted-foreground hover:text-primary transition-colors">Exercise Types</Link></li>
              <li><Link to="/how-it-works" className="text-muted-foreground hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About</Link></li>
              <li><Link to="/esl-worksheets" className="text-muted-foreground hover:text-primary transition-colors">ESL Worksheets</Link></li>
              <li><Link to="/for-english-tutors" className="text-muted-foreground hover:text-primary transition-colors">For English Tutors</Link></li>
              <li><Link to="/signup" className="text-muted-foreground hover:text-primary transition-colors">Sign Up Free</Link></li>
            </ul>
          </div>

          {/* Column: Features */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Features</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features/dslm" className="text-muted-foreground hover:text-primary transition-colors">DSLM Progress Tracking</Link></li>
              <li><Link to="/features/homework" className="text-muted-foreground hover:text-primary transition-colors">Homework + AI Grading</Link></li>
              <li><Link to="/features/flashcards" className="text-muted-foreground hover:text-primary transition-colors">Smart Flashcards</Link></li>
              <li><Link to="/features/calendar" className="text-muted-foreground hover:text-primary transition-colors">Lesson Calendar</Link></li>
              <li><Link to="/features/live-sessions" className="text-muted-foreground hover:text-primary transition-colors">Live Sessions</Link></li>
              <li><Link to="/features/placement-test" className="text-muted-foreground hover:text-primary transition-colors">Placement Test</Link></li>
              <li><Link to="/features/student-hub" className="text-muted-foreground hover:text-primary transition-colors">Student Hub</Link></li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/prompts" className="text-muted-foreground hover:text-primary transition-colors">Prompt Library</Link></li>
              <li><Link to="/glossary" className="text-muted-foreground hover:text-primary transition-colors">ELT Glossary</Link></li>
              <li><Link to="/resources" className="text-muted-foreground hover:text-primary transition-colors">All Resources</Link></li>
              <li><Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</Link></li>
              <li><a href="/cefr-worksheet-generator.html" className="text-muted-foreground hover:text-primary transition-colors">CEFR Guide</a></li>
              <li><Link to="/tools" className="text-muted-foreground hover:text-primary transition-colors">Free Tools</Link></li>
              <li><Link to="/tools/cefr-level-test" className="text-muted-foreground hover:text-primary transition-colors">CEFR Level Test</Link></li>
              <li><Link to="/tools/lesson-plan-generator" className="text-muted-foreground hover:text-primary transition-colors">Lesson Plan Generator</Link></li>
              <li><Link to="/tools/vocab-cefr-checker" className="text-muted-foreground hover:text-primary transition-colors">Vocab CEFR Checker</Link></li>
            </ul>
          </div>

          {/* Column 3: Grammar */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Grammar</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/present-simple-worksheets.html" className="text-muted-foreground hover:text-primary transition-colors">Present Simple</a></li>
              <li><a href="/past-simple-worksheets.html" className="text-muted-foreground hover:text-primary transition-colors">Past Simple</a></li>
              <li><a href="/present-perfect-worksheets.html" className="text-muted-foreground hover:text-primary transition-colors">Present Perfect</a></li>
              <li><a href="/conditionals-worksheets-english.html" className="text-muted-foreground hover:text-primary transition-colors">Conditionals</a></li>
              <li><a href="/passive-voice-worksheets-esl.html" className="text-muted-foreground hover:text-primary transition-colors">Passive Voice</a></li>
              <li><a href="/modal-verbs-worksheets-esl.html" className="text-muted-foreground hover:text-primary transition-colors">Modal Verbs</a></li>
              <li><a href="/future-tenses-worksheets-english.html" className="text-muted-foreground hover:text-primary transition-colors">Future Tenses</a></li>
              <li><a href="/phrasal-verbs-worksheets-esl.html" className="text-muted-foreground hover:text-primary transition-colors">Phrasal Verbs</a></li>
              <li><a href="/grammar-worksheet-generator.html" className="text-muted-foreground hover:text-primary transition-colors">All Grammar</a></li>
            </ul>
          </div>

          {/* Column 4: For Teachers */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">For Teachers</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/ai-tools-for-private-english-tutors.html" className="text-muted-foreground hover:text-primary transition-colors">Private Tutors</a></li>
              <li><a href="/worksheet-generator-for-language-schools.html" className="text-muted-foreground hover:text-primary transition-colors">Language Schools</a></li>
              <li><a href="/ai-tools-for-online-esl-teachers.html" className="text-muted-foreground hover:text-primary transition-colors">Online ESL Teachers</a></li>
              <li><a href="/business-english-worksheet-generator.html" className="text-muted-foreground hover:text-primary transition-colors">Business English</a></li>
              <li><a href="/english-worksheets-for-corporate-training.html" className="text-muted-foreground hover:text-primary transition-colors">Corporate Training</a></li>
            </ul>
          </div>

          {/* Column 5: Compare */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Compare</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/edooqoo-vs-islcollective.html" className="text-muted-foreground hover:text-primary transition-colors">vs ISLCollective</a></li>
              <li><a href="/edooqoo-vs-liveworksheets.html" className="text-muted-foreground hover:text-primary transition-colors">vs Liveworksheets</a></li>
              <li><a href="/edooqoo-vs-twee.html" className="text-muted-foreground hover:text-primary transition-colors">vs Twee</a></li>
              <li><a href="/edooqoo-vs-magicschool.html" className="text-muted-foreground hover:text-primary transition-colors">vs MagicSchool</a></li>
              <li><a href="/edooqoo-vs-quizlet.html" className="text-muted-foreground hover:text-primary transition-colors">vs Quizlet</a></li>
              <li><a href="/edooqoo-vs-kahoot.html" className="text-muted-foreground hover:text-primary transition-colors">vs Kahoot</a></li>
              <li><a href="/edooqoo-vs-wordwall.html" className="text-muted-foreground hover:text-primary transition-colors">vs Wordwall</a></li>
              <li><a href="/edooqoo-vs-busyteacher.html" className="text-muted-foreground hover:text-primary transition-colors">vs BusyTeacher</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Edooqoo. All rights reserved.</span>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/cookie-policy" className="text-muted-foreground hover:text-primary transition-colors">Cookie Policy</Link>
            <Link to="/status" className="text-muted-foreground hover:text-primary transition-colors">Status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default GlobalFooter;
