import React from 'react';
import { Star } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const testimonials = [
  {
    quote: "I used to spend 3-4 hours every Sunday preparing materials for my private students. Now I generate exactly what I need 5 minutes before the lesson. Life-changing.",
    name: "Sarah J.",
    role: "Private English Tutor",
    location: "London, UK",
    colorClass: "bg-violet-100 text-violet-700",
    initial: "S",
  },
  {
    quote: "The variety of exercises is incredible. My adult learners were getting bored of standard gap-fills. The discussion prompts and role-plays generated here are spot on for Business English.",
    name: "Michael C.",
    role: "Business English Coach",
    location: "Toronto, CA",
    colorClass: "bg-blue-100 text-blue-700",
    initial: "M",
  },
  {
    quote: "The Student Hub completely removed my admin work. I send them a link, they do the interactive homework, and I see the results. It makes me look so professional.",
    name: "Elena R.",
    role: "Online ESL Teacher",
    location: "Madrid, ES",
    colorClass: "bg-emerald-100 text-emerald-700",
    initial: "E",
  },
];

const TestimonialsRow: React.FC = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-secondary/30 py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className={`text-center mb-16 animate-fade-up ${isVisible ? 'visible' : ''}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What teachers say
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real feedback from educators using edooqoo in their 1-on-1 lessons.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`bg-background rounded-2xl p-8 border border-border shadow-sm hover:shadow-md transition-shadow relative animate-fade-up stagger-${i + 1} ${isVisible ? 'visible' : ''}`}
            >
              <div className="flex mb-6 gap-1">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-base text-foreground leading-relaxed mb-8">"{t.quote}"</p>
              <div className="flex items-center gap-3 mt-auto">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${t.colorClass}`}>
                  {t.initial}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role} · {t.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsRow;
