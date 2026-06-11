import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Save, Coins, LineChart, ArrowRight } from 'lucide-react';

interface AnonPostWorksheetCTAProps {
  onSeePricing: () => void;
}

/**
 * Slide-up panel rendered immediately below GenerationView for anonymous
 * users right after worksheet generation completes — peak motivation moment.
 */
export const AnonPostWorksheetCTA: React.FC<AnonPostWorksheetCTAProps> = ({ onSeePricing }) => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  return (
    <section className="py-10 px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/30 border-y border-border animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-2xl border border-border shadow-lg p-6 md:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              🎉 Your worksheet is ready — now save the prep context
            </h2>
            <p className="text-muted-foreground">
              Create a free account to keep this worksheet, re-edit it later, and start building the student context behind 1-Minute Prep.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Save className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Save this worksheet</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Start with 2 free worksheet credits</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <LineChart className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Build student context for next prep</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="h-12 px-8 text-base font-semibold rounded-full shadow-md">
              <Link to="/signup" state={fromState}>
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onSeePricing}
              className="h-12 px-8 text-base font-semibold rounded-full"
            >
              See pricing →
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnonPostWorksheetCTA;