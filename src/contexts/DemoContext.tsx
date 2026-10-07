
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import type { DemoDataSet } from '@/data/demoData';

const DEMO_STORAGE_KEY = 'edooqoo_demo_mode';

/**
 * v6.9.114: Public demo mode is DISABLED (hard kill-switch) while /dashboard
 * and /student are being redesigned. DemoContext stays as a dormant shell so
 * the 25+ hooks that read isDemoMode keep compiling and always take the
 * production path. Re-enable = restore enterDemo body + /demo route.
 */

interface DemoContextType {
  isDemoMode: boolean;
  demoData: DemoDataSet | null;
  enterDemo: (countryCode: string) => void;
  exitDemo: () => void;
  canMutate: boolean;
  showDemoBlockedToast: (action: string) => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  demoData: null,
  enterDemo: () => {},
  exitDemo: () => {},
  canMutate: true,
  showDemoBlockedToast: () => {},
});

export const useDemoContext = () => useContext(DemoContext);

/** Hard-clear demo state and redirect. Works from anywhere, even outside React. */
export function forceExitDemo() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  sessionStorage.clear();
  window.location.replace('/');
}

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoData, setDemoData] = useState<DemoDataSet | null>(null);

  // v6.9.114: demo is disabled. On every app start we hard-clear any stale
  // demo flag so every visitor (and every hook) lands on the production path.
  useEffect(() => {
    try {
      if (localStorage.getItem(DEMO_STORAGE_KEY)) {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
    } catch {
      // storage unavailable: nothing to clear
    }
  }, []);

  // Disabled: keeps the same signature so call sites keep compiling.
  const enterDemo = useCallback((_countryCode: string) => {
    // no-op: demo mode is disabled (see kill-switch note above)
  }, []);

  const exitDemo = useCallback(() => {
    forceExitDemo();
  }, []);

  const showDemoBlockedToast = useCallback((action: string) => {
    toast({
      title: '🎯 Demo Mode',
      description: `${action} is disabled in demo mode. Sign up free to unlock all features!`,
    });
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoData,
        enterDemo,
        exitDemo,
        canMutate: !isDemoMode,
        showDemoBlockedToast,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};
