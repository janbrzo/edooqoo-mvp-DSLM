import React from 'react';
import { Lightbulb, Workflow, Target } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const cards = [
  {
    icon: Lightbulb,
    title: 'Never run out of lesson ideas',
    description: 'With 29 exercise types including gap-fill, matching, listening, and discussion — every lesson feels fresh and engaging.',
  },
  {
    icon: Workflow,
    title: 'Zero admin work for you',
    description: 'Students get their own portal with worksheets, interactive flashcards, automated homework, and seamless lesson booking.',
  },
  {
    icon: Target,
    title: 'Know exactly what to teach',
    description: 'CEFR-tagged skill tracking and analytics. See exactly what each student has mastered and what to focus on next.',
  },
];

const ValueCards: React.FC = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-background py-20 relative border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className={`text-center mb-16 animate-fade-up ${isVisible ? 'visible' : ''}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need to teach better
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete toolkit designed specifically for 1-on-1 language tutors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className={`group bg-background rounded-2xl p-8 border border-border hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300 animate-fade-up stagger-${i + 1} ${isVisible ? 'visible' : ''}`}
            >
              <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <card.icon className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{card.title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValueCards;