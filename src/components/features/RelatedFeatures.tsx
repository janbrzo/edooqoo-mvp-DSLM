import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, BookCheck, Layers3, CalendarDays, Radio, ClipboardCheck, GraduationCap } from 'lucide-react';

const allFeatures = [
  { path: '/features/dslm', title: 'DSLM Progress Tracking', icon: Brain, color: 'text-violet-600' },
  { path: '/features/homework', title: 'Homework Review', icon: BookCheck, color: 'text-amber-600' },
  { path: '/features/flashcards', title: 'Smart Flashcards', icon: Layers3, color: 'text-blue-600' },
  { path: '/features/calendar', title: 'Lesson Calendar', icon: CalendarDays, color: 'text-green-600' },
  { path: '/features/live-sessions', title: 'Live Sessions', icon: Radio, color: 'text-red-600' },
  { path: '/features/placement-test', title: 'Placement Test', icon: ClipboardCheck, color: 'text-indigo-600' },
  { path: '/features/student-hub', title: 'Student Hub', icon: GraduationCap, color: 'text-teal-600' },
];

interface RelatedFeaturesProps {
  currentPath: string;
}

const RelatedFeatures: React.FC<RelatedFeaturesProps> = ({ currentPath }) => {
  const related = allFeatures.filter(f => f.path !== currentPath).slice(0, 4);

  return (
    <section className="py-12 bg-secondary/20 border-t border-border">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-lg font-bold text-foreground mb-6 text-center">Explore More Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {related.map(f => (
            <Link
              key={f.path}
              to={f.path}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <f.icon className={`h-5 w-5 ${f.color} shrink-0`} />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{f.title}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RelatedFeatures;
