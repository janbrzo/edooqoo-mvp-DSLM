/**
 * SignupPromptDialog — soft signup nudge shown 2.5s after a teacher clicks
 * a FeatureNavPill on the landing page. Per-feature copy from
 * `src/constants/featurePromptCopy.ts`.
 *
 * Dismissal is sticky for the rest of the session (sessionStorage flag set
 * by the parent FeatureNavPills component).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import type { FeaturePillItem } from '@/components/landing/FeatureNavPills';
import {
  FEATURE_PROMPT_COPY,
  DEFAULT_FEATURE_PROMPT,
} from '@/constants/featurePromptCopy';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: FeaturePillItem | null;
}

const SignupPromptDialog: React.FC<Props> = ({ open, onOpenChange, feature }) => {
  const navigate = useNavigate();
  const copy = (feature && FEATURE_PROMPT_COPY[feature.anchorId]) || DEFAULT_FEATURE_PROMPT;
  const Icon = feature?.icon ?? Sparkles;

  const handleStart = () => {
    onOpenChange(false);
    navigate('/signup', {
      state: { from: '/', scrollTo: feature?.anchorId, feature: feature?.anchorId },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center mb-2">
            <Icon className="h-6 w-6 text-violet-600" />
          </div>
          <DialogTitle className="text-center text-xl leading-snug">
            {copy.headline}
          </DialogTitle>
          <DialogDescription className="text-center pt-1">
            {copy.subline}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-col gap-2 sm:space-x-0 pt-2">
          <Button
            size="lg"
            onClick={handleStart}
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            {copy.cta}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
          >
            Maybe later
          </Button>
          <p className="text-[11px] text-center text-muted-foreground pt-1">
            No credit card · 2 worksheets free
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SignupPromptDialog;