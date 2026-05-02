import React, { useEffect } from 'react';
import { BackgroundPatternSwitcher } from '@/components/ui/BackgroundPatternSwitcher';
import { BugReportButton } from '@/components/bug-report/BugReportButton';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const AuthenticatedPageShell: React.FC<Props> = ({ children, className = '' }) => {
  useEffect(() => {
    const saved = localStorage.getItem('edooqoo-bg-pattern');
    const shell = document.querySelector('.auth-bg-shell');
    if (shell && saved) {
      shell.setAttribute('data-pattern', saved);
    }
  }, []);

  return (
    <div className={`min-h-screen auth-bg-shell ${className}`}>
      {children}
      <BackgroundPatternSwitcher />
      <BugReportButton />
    </div>
  );
};
