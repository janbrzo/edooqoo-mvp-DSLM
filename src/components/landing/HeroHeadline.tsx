import React, { useState, useEffect } from 'react';
import { ArrowDown, BookOpen, Brain, Calendar, BarChart2, ClipboardCheck, Share2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const unlockFeatures = [
{ icon: BookOpen, label: 'Homework & AI Grading' },
{ icon: Brain, label: 'Smart Flashcards' },
{ icon: Calendar, label: 'Smart Lesson Calendar' },
{ icon: Bell, label: 'Auto Lesson Reminders' },
{ icon: BarChart2, label: 'Student Progress Tracking' },
{ icon: ClipboardCheck, label: 'Placement Tests' },
{ icon: Share2, label: 'Interactive Sharing' }];


const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HeroHeadline: React.FC = () => {
  const [dayIndex, setDayIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDayIndex((i) => (i + 1) % 7);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const scrollToForm = () => {
    const formSection = document.getElementById('worksheet-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative pt-12 pb-4 px-2 sm:px-4 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-100/30 via-transparent to-transparent pointer-events-none"></div>

      <div className="max-w-5xl mx-auto text-center">
        {/* Headline */}
        <h1 className="text-[2rem] sm:text-5xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-5 leading-[1.1]">
          <span className="block sm:inline">Stop wasting</span>
          <span className="hidden sm:inline">{' '}</span>
          <span className="block sm:inline whitespace-nowrap">
            <span
              className="relative inline-block overflow-hidden whitespace-nowrap align-baseline"
              style={{ height: '1.1em', minWidth: '4.2em' }}>
              <span
                key={dayIndex}
                className="inline-block animate-day-enter text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
                {days[dayIndex]}
              </span>
            </span>
            {' '}evenings
          </span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
            on lesson prep.
          </span>
        </h1>

        {/* Subheadline — LCP element, hint browser to prioritize */}
        <p
          className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
          // @ts-expect-error fetchpriority is valid HTML but not yet typed in React
          fetchpriority="high"
        >
          AI creates complete, fully personalized worksheets for your 1-on-1 lessons. 29 exercise types. Ready in under 90 seconds.
        
        </p>

        {/* CTA Area */}
        <div className="flex flex-col items-center gap-6 mb-10">
          <Button
            onClick={scrollToForm}
            size="lg"
            className="h-12 sm:h-14 px-5 sm:px-8 text-base sm:text-lg max-w-full whitespace-normal sm:whitespace-nowrap font-semibold rounded-full shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all duration-200">
            <span className="sm:hidden">Generate Free Worksheet</span>
            <span className="hidden sm:inline">Generate Your First Worksheet — Free</span>
            <ArrowDown className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Unlock features ticker */}
        <div className="w-full max-w-2xl mx-auto overflow-hidden border border-border rounded-2xl bg-secondary/60 py-[10px] my-[15px]">
          <p className="text-xs font-semibold uppercase tracking-widest text-center mb-1.5 px-4 text-muted-foreground">
            Create a free account to unlock
          </p>
          <div className="flex overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...unlockFeatures, ...unlockFeatures].map(({ icon: Icon, label }, i) =>
              <div key={i} className="flex items-center gap-1.5 text-sm text-foreground/80 mx-4 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                  <span>{label}</span>
                  <span className="mx-3 text-muted-foreground/40">·</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>);

};

export default HeroHeadline;