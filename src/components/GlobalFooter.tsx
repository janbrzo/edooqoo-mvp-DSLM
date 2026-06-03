
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// v6.9.22 — Footer link helper. .html → static file (full-page nav); clean path → SPA Link.
const FooterLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  if (href.endsWith('.html')) {
    return (
      <a href={href} className="text-muted-foreground hover:text-primary transition-colors">
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className="text-muted-foreground hover:text-primary transition-colors">
      {children}
    </Link>
  );
};

const GlobalFooter = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  return (
    <footer className="relative z-0 border-t bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-10">
        {/* Brand */}
        <div className="mb-8">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <p className="text-sm text-muted-foreground mt-1">1-Minute Prep for 1:1 English teachers</p>
        </div>

        {/* 6-column grid (Compare column restored in v6.9.22) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-8">
          {/* Column 1: Product */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Product</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-muted-foreground hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link to="/one-minute-prep" className="text-muted-foreground hover:text-primary transition-colors">1-Minute Prep</Link></li>
              <li><Link to="/exercise-types" className="text-muted-foreground hover:text-primary transition-colors">Exercise Types</Link></li>
              <li><Link to="/how-it-works" className="text-muted-foreground hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About</Link></li>
              <li><Link to="/esl-worksheets" className="text-muted-foreground hover:text-primary transition-colors">ESL Worksheets</Link></li>
              <li><Link to="/for-english-tutors" className="text-muted-foreground hover:text-primary transition-colors">For English Tutors</Link></li>
              <li><Link to="/signup" state={fromState} className="text-muted-foreground hover:text-primary transition-colors">Sign Up Free</Link></li>
            </ul>
          </div>

          {/* Column: Features */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Features</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features/dslm" className="text-muted-foreground hover:text-primary transition-colors">DSLM Progress Tracking</Link></li>
              <li><Link to="/features/homework" className="text-muted-foreground hover:text-primary transition-colors">Homework Review</Link></li>
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
              <li><FooterLink href="/cefr-worksheet-generator.html">CEFR Guide</FooterLink></li>
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
              <li><FooterLink href="/present-simple-worksheets.html">Present Simple</FooterLink></li>
              <li><FooterLink href="/past-simple-worksheets.html">Past Simple</FooterLink></li>
              <li><FooterLink href="/present-perfect-worksheets.html">Present Perfect</FooterLink></li>
              <li><FooterLink href="/conditionals-worksheets-english.html">Conditionals</FooterLink></li>
              <li><FooterLink href="/passive-voice-worksheets-esl.html">Passive Voice</FooterLink></li>
              <li><FooterLink href="/modal-verbs-worksheets-esl.html">Modal Verbs</FooterLink></li>
              <li><FooterLink href="/future-tenses-worksheets-english.html">Future Tenses</FooterLink></li>
              <li><FooterLink href="/phrasal-verbs-worksheets-esl.html">Phrasal Verbs</FooterLink></li>
              <li><FooterLink href="/grammar-worksheet-generator.html">All Grammar</FooterLink></li>
            </ul>
          </div>

          {/* Column 4: For Teachers */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">For Teachers</h3>
            <ul className="space-y-2 text-sm">
              <li><FooterLink href="/ai-tools-for-private-english-tutors.html">Private Tutors</FooterLink></li>
              <li><FooterLink href="/worksheet-generator-for-language-schools.html">Language Schools</FooterLink></li>
              <li><FooterLink href="/ai-tools-for-online-esl-teachers.html">Online ESL Teachers</FooterLink></li>
              <li><FooterLink href="/business-english-worksheet-generator.html">Business English</FooterLink></li>
              <li><FooterLink href="/english-worksheets-for-corporate-training.html">Corporate Training</FooterLink></li>
            </ul>
          </div>

          {/* Column 5: Compare (restored v6.9.22 — all .html files exist) */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Compare</h3>
            <ul className="space-y-2 text-sm">
              <li><FooterLink href="/edooqoo-vs-islcollective.html">vs ISLCollective</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-liveworksheets.html">vs Liveworksheets</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-twee.html">vs Twee</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-magicschool.html">vs MagicSchool</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-busyteacher.html">vs BusyTeacher</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-kahoot.html">vs Kahoot</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-quizlet.html">vs Quizlet</FooterLink></li>
              <li><FooterLink href="/edooqoo-vs-wordwall.html">vs Wordwall</FooterLink></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Edooqoo. All rights reserved.</span>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
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
