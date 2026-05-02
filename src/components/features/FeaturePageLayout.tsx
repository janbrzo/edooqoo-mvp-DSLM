import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface FeaturePageLayoutProps {
  title: string;
  metaDescription: string;
  children: React.ReactNode;
}

const FeaturePageLayout: React.FC<FeaturePageLayoutProps> = ({ title, metaDescription, children }) => {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', metaDescription);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = metaDescription;
      document.head.appendChild(m);
    }
    window.scrollTo(0, 0);
  }, [title, metaDescription]);

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">edooqoo</Link>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Button size="sm" asChild>
              <Link to="/signup">Start Free <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
};

export default FeaturePageLayout;
