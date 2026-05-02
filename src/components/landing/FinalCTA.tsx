import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, CheckCircle2 } from 'lucide-react';

const FinalCTA: React.FC = () => {
  const scrollToForm = () => {
    const formSection = document.getElementById('worksheet-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative py-24 text-center overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-slate-900"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/90 to-indigo-800/90 mix-blend-multiply"></div>
      
      <div className="relative z-10 max-w-3xl mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
          Ready to save hours every week?
        </h2>
        <p className="text-xl text-violet-100 mb-10 max-w-2xl mx-auto">
          Experience the difference in your next class. Your students will love it, and you'll love having your free time back.
        </p>
        
        <div className="flex flex-col items-center gap-6">
          <Button
            onClick={scrollToForm}
            size="lg"
            className="h-14 px-10 text-lg bg-white text-violet-900 hover:bg-violet-50 rounded-full font-bold shadow-2xl hover:-translate-y-1 transition-all duration-200"
          >
            Create Your First Worksheet — Free
            <ArrowUp className="h-5 w-5 ml-2" />
          </Button>
          
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-violet-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-300" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-300" />
              <span>No signup needed to try</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-300" />
              <span>Ready in 2 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;