import { useEffect } from 'react';
import { forceExitDemo } from '@/contexts/DemoContext';

/** Emergency exit route — always clears demo and redirects to / */
export default function ExitDemo() {
  useEffect(() => {
    forceExitDemo();
  }, []);
  return null;
}
