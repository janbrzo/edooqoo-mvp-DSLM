import React from 'react';
import { ANON_FEATURES } from '@/constants/anonFeaturesShowcase';

/**
 * Static 3×2 grid of the 6 features. Used in AnonPostWorksheetLandingPage
 * after the user has experienced worksheet generation.
 */
export const MiniFeatureGrid: React.FC = () => {
  return (
    <section className="py-12 px-4 bg-background">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-2">
          Everything you get with a free account
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          The worksheet you just generated is one of 6 tools that work together.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ANON_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/40 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center mb-3 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5 leading-snug">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.benefit}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MiniFeatureGrid;