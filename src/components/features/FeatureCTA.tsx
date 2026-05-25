import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface FeatureCTAProps {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaLink?: string;
}

const FeatureCTA: React.FC<FeatureCTAProps> = ({
  headline = 'Ready to save hours every week?',
  subheadline = 'Start with 2 free worksheets. No credit card required.',
  ctaText = 'Get Started Free',
  ctaLink = '/signup',
}) => {
  const location = useLocation();
  const ctaState = ctaLink.startsWith('/signup') || ctaLink.startsWith('/login')
    ? { from: location.pathname + location.search }
    : undefined;
  return (
  <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
    <div className="max-w-2xl mx-auto px-4 text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{headline}</h2>
      <p className="text-muted-foreground mb-8">{subheadline}</p>
      <Button size="lg" asChild>
        <Link to={ctaLink} state={ctaState}>{ctaText} <ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  </section>
  );
};

export default FeatureCTA;
