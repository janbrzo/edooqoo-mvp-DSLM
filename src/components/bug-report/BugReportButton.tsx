/**
 * BugReportButton — fixed bottom-right floating button.
 *
 * Visibility rules:
 *  - Only on authenticated teacher routes (mounted from AuthenticatedPageShell).
 *  - Hidden on /demo* and on Student Hub (/student-hub*) — Student Hub renders
 *    its own shell so this won't appear there.
 *
 * Position: bottom-6 right-6, with a 64px lift above the calendar FAB if it
 * already occupies the corner. We use bottom-24 to sit just above any FAB.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { BugReportModal } from './BugReportModal';

export const BugReportButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  // Don't render on demo route — keeps the demo experience clean.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        // Sits to the RIGHT of the BackgroundPatternSwitcher (which occupies
        // left-4 bottom-4, 40x40px). left-16 = 64px from the left edge gives
        // ~16px gap between the two FABs. z-40 keeps both below modals (z-50)
        // and toasts (z-200).
        className="fixed bottom-4 left-16 z-40 shadow-md gap-2 bg-background/95 backdrop-blur-sm hover:bg-accent"
        aria-label="Report a bug"
      >
        <Bug className="h-4 w-4" />
        <span className="hidden sm:inline">Report a bug</span>
      </Button>
      <BugReportModal open={open} onOpenChange={setOpen} />
    </>
  );
};