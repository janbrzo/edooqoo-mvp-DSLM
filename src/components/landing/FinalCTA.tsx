import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface FinalCTAProps {
  onStartOneMinutePrep?: () => void;
}

const FinalCTA: React.FC<FinalCTAProps> = ({ onStartOneMinutePrep }) => {
  return (
    <section className="relative py-24 text-center overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-slate-900"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/90 to-indigo-800/90 mix-blend-multiply"></div>
      
      <div className="relative z-10 max-w-3xl mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
          Stop prepping from a blank prompt.
        </h2>
        <p className="text-xl text-violet-100 mb-10 max-w-2xl mx-auto">
          Set up the student context once, let Edooqoo collect learning signals, and generate the next worksheet from a concrete recommendation.
        </p>
        
        <div className="flex flex-col items-center gap-6">
          <Button
            onClick={onStartOneMinutePrep}
            size="lg"
            className="h-14 px-10 text-lg bg-white text-violet-900 hover:bg-violet-50 rounded-full font-bold shadow-2xl hover:-translate-y-1 transition-all duration-200"
          >
            Start 1-Minute Prep Free
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-violet-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-300" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-300" />
              <span>2 worksheets free</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-300" />
              <span>Teacher review stays in control</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
