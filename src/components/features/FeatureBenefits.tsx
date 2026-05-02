import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface Benefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeatureBenefitsProps {
  title?: string;
  subtitle?: string;
  benefits: Benefit[];
}

const FeatureBenefits: React.FC<FeatureBenefitsProps> = ({
  title = 'Why teachers love it',
  subtitle,
  benefits,
}) => (
  <section className="py-16 bg-background">
    <div className="max-w-5xl mx-auto px-4">
      {title && (
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((b) => (
          <div key={b.title} className="text-center p-6 rounded-2xl border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <b.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2 text-sm">{b.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{b.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureBenefits;
