import React from 'react';
import { BackgroundPatternSwitcher } from '@/components/ui/BackgroundPatternSwitcher';
import { BugReportButton } from '@/components/bug-report/BugReportButton';
import { useDemoContext } from '@/contexts/DemoContext';
import { AppBackground } from '@/components/ui/AppBackground';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const AuthenticatedPageShell: React.FC<Props> = ({ children, className = '' }) => {
  const { isDemoMode } = useDemoContext();
  return (
    <AppBackground
      className={`min-h-screen ${className}`}
      style={isDemoMode ? { paddingTop: '36px' } : undefined}
    >
      {children}
      <BackgroundPatternSwitcher />
      <BugReportButton />
    </AppBackground>
  );
};
