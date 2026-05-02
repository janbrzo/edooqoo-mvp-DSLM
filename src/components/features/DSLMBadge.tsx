import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers } from 'lucide-react';

interface DSLMBadgeProps {
  feature: string;
  description?: string;
}

const DSLMBadge: React.FC<DSLMBadgeProps> = ({ feature, description }) => (
  <section className="py-8 bg-primary/5 border-y border-primary/10">
    <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Layers className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 text-center sm:text-left">
        <p className="text-sm font-semibold text-foreground">
          Part of the Edooqoo DSLM Ecosystem
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {description || `${feature} feeds data into the Dynamic Student Learning Model, enabling personalized teaching at nano-skill level.`}
        </p>
      </div>
      <Link
        to="/features/dslm"
        className="text-sm text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
      >
        Learn about DSLM <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  </section>
);

export default DSLMBadge;
