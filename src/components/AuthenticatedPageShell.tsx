import React, { useEffect } from 'react';
import { BackgroundPatternSwitcher } from '@/components/ui/BackgroundPatternSwitcher';
import { BugReportButton } from '@/components/bug-report/BugReportButton';
import { useDemoContext } from '@/contexts/DemoContext';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const AuthenticatedPageShell: React.FC<Props> = ({ children, className = '' }) => {
  const { isDemoMode } = useDemoContext();
  useEffect(() => {
    const saved = localStorage.getItem('edooqoo-bg-pattern');
    const shell = document.querySelector('.auth-bg-shell');
    if (shell && saved) {
      shell.setAttribute('data-pattern', saved);
    }
  }, []);

  return (
    <div
      className={`min-h-screen auth-bg-shell ${className}`}
      style={isDemoMode ? { paddingTop: '36px' } : undefined}
    >
      {children}
      <BackgroundPatternSwitcher />
      <BugReportButton />
    </div>
  );
};
