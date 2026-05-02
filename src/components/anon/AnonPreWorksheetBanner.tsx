import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

/**
 * Slim banner rendered ABOVE the generated worksheet for anonymous users.
 * Mirrors the post-worksheet CTA copy to maximize conversion at the
 * peak-motivation moment (right after generation).
 */
export const AnonPreWorksheetBanner: React.FC = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  return (
    <section className="px-4 pt-4">
      <div className="max-w-5xl mx-auto bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/30 border border-primary/20 rounded-xl shadow-sm px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <h2 className="text-lg md:text-xl font-bold text-foreground leading-tight">
            🎉 You just generated a worksheet
          </h2>
          <p className="text-sm text-muted-foreground">
            Save it forever — free account in 30 seconds.
          </p>
        </div>
        <Button asChild size="sm" className="h-10 px-5 text-sm font-semibold rounded-full shadow-md whitespace-nowrap">
          <Link to="/signup" state={fromState}>
            Create Free Account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default AnonPreWorksheetBanner;