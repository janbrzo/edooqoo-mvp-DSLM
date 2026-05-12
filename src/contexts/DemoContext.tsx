
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { buildDemoData, type DemoDataSet } from '@/data/demoData';

const DEMO_STORAGE_KEY = 'edooqoo_demo_mode';

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

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      setIsDemoMode(true);
      // v6.9.7 — async demo build (lazy chunk for ~150 KiB demo worksheet content).
      buildDemoData(stored).then(setDemoData);
    }
  }, []);

  const enterDemo = useCallback((countryCode: string) => {
    const code = countryCode || 'DEFAULT';
    localStorage.setItem(DEMO_STORAGE_KEY, code);
    setIsDemoMode(true);
    buildDemoData(code).then(setDemoData);
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
