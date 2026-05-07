import React, { useEffect, useState } from 'react';
import { BackgroundPatternSwitcher } from '@/components/ui/BackgroundPatternSwitcher';
import { BugReportButton } from '@/components/bug-report/BugReportButton';
import { useDemoContext } from '@/contexts/DemoContext';
import ParticlesBackground from '@/components/landing/ParticlesBackground';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const AuthenticatedPageShell: React.FC<Props> = ({ children, className = '' }) => {
  const { isDemoMode } = useDemoContext();
  const [pattern, setPattern] = useState<string>(() => {
    return localStorage.getItem('edooqoo-bg-pattern') || 'particles';
  });
  useEffect(() => {
    const saved = localStorage.getItem('edooqoo-bg-pattern') || 'particles';
    const shell = document.querySelector('.auth-bg-shell');
    if (shell) {
      shell.setAttribute('data-pattern', saved);
    }
    setPattern(saved);
    const handler = (e: Event) => setPattern((e as CustomEvent).detail);
    window.addEventListener('edooqoo-bg-pattern-changed', handler);
    return () => window.removeEventListener('edooqoo-bg-pattern-changed', handler);
  }, []);

  return (
    <div
      className={`min-h-screen auth-bg-shell ${className}`}
      style={isDemoMode ? { paddingTop: '36px' } : undefined}
    >
      {pattern === 'particles' && <ParticlesBackground interactive={false} />}
      {children}
      <BackgroundPatternSwitcher />
      <BugReportButton />
    </div>
  );
};
