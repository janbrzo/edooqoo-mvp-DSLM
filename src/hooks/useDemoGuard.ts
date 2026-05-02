
import { useDemoContext } from '@/contexts/DemoContext';

export function useDemoGuard() {
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();

  const guardAction = (action: string, callback: () => void) => {
    if (isDemoMode) {
      showDemoBlockedToast(action);
      return;
    }
    callback();
  };

  return { isDemoMode, guardAction };
}
