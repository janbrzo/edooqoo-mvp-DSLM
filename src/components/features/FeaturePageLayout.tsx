import React, { useEffect } from 'react';
import PublicWorkflowNav from '@/components/public/PublicWorkflowNav';

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
      <PublicWorkflowNav />
      <main>{children}</main>
    </div>
  );
};

export default FeaturePageLayout;
