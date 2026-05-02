import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface FeatureHeroProps {
  badge?: string;
  badgeColor?: string;
  headline: string;
  subheadline: string;
  ctaText?: string;
  ctaLink?: string;
  children?: React.ReactNode; // mockup/screenshot
}

const FeatureHero: React.FC<FeatureHeroProps> = ({
  badge,
  badgeColor = 'bg-primary/10 text-primary border-primary/20',
  headline,
  subheadline,
  ctaText = 'Try Free — No Credit Card',
  ctaLink = '/signup',
  children,
}) => (
  <section className="py-16 md:py-24 bg-gradient-to-b from-background to-secondary/30">
    <div className="max-w-6xl mx-auto px-4">
      <div className="text-center max-w-3xl mx-auto mb-12">
        {badge && (
          <span className={`inline-block text-xs font-bold border rounded-full px-3 py-1 mb-4 ${badgeColor}`}>
            {badge}
          </span>
        )}
        <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight mb-4">
          {headline}
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          {subheadline}
        </p>
        <Button size="lg" asChild>
          <Link to={ctaLink}>{ctaText} <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
      {children && (
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {children}
          </div>
        </div>
      )}
    </div>
  </section>
);

export default FeatureHero;
