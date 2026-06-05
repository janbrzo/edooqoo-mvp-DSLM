import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Brain, CheckCircle2, ClipboardCheck } from 'lucide-react';

interface StartOneMinutePrepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTryWorksheetGenerator: () => void;
}

const StartOneMinutePrepDialog: React.FC<StartOneMinutePrepDialogProps> = ({
  open,
  onOpenChange,
  onTryWorksheetGenerator,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignup = () => {
    onOpenChange(false);
    navigate('/signup', {
      state: {
        from: location.pathname + location.search,
        startOneMinutePrep: true,
      },
    });
  };

  const handleTryGenerator = () => {
    onOpenChange(false);
    window.requestAnimationFrame(onTryWorksheetGenerator);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
            <Brain className="h-6 w-6 text-violet-600" />
          </div>
          <DialogTitle className="text-center text-xl leading-snug">
            Create a free account to unlock 1-Minute Prep
          </DialogTitle>
          <DialogDescription className="pt-1 text-center">
            1-Minute Prep needs saved student context: profile, goals, lesson notes, homework, flashcard progress and DSLM nano-skill evidence. The worksheet generator remains available without setup.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <ClipboardCheck className="h-4 w-4 text-violet-600" />
            What the account unlocks
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>Student profiles, goals and learning history.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>DSLM evidence stack before worksheet generation.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>Homework, flashcards and interactive sharing.</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button size="lg" onClick={handleSignup} className="w-full bg-violet-600 hover:bg-violet-700">
            Create free account
          </Button>
          <Button size="sm" variant="ghost" onClick={handleTryGenerator} className="w-full text-muted-foreground">
            Try worksheet generator first
          </Button>
          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            No credit card. 2 worksheets free. Teacher review stays in control.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StartOneMinutePrepDialog;
