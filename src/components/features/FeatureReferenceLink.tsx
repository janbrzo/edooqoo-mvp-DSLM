import React from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';

interface FeatureReferenceLinkProps {
  href: string;
  title: string;
  description: string;
}

/**
 * Links a product feature page to its canonical in-depth reference page.
 * The feature page owns product/signup intent; the reference page owns
 * the informational and citation intent for the same topic.
 */
const FeatureReferenceLink: React.FC<FeatureReferenceLinkProps> = ({ href, title, description }) => (
  <section className="py-10">
    <div className="max-w-4xl mx-auto px-4">
      <a
        href={href}
        className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span className="text-sm text-primary font-medium flex items-center gap-1 shrink-0 group-hover:underline">
          Read the full guide <ArrowRight className="h-3 w-3" />
        </span>
      </a>
    </div>
  </section>
);

export default FeatureReferenceLink;
