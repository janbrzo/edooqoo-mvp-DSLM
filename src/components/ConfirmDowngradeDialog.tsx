
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDowngradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  targetPlan: string;
  onConfirm: () => void;
  isLoading: boolean;
}

export const ConfirmDowngradeDialog = ({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  onConfirm,
  isLoading
}: ConfirmDowngradeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="w-12 h-12 text-orange-500" />
          </div>
          <DialogTitle>Confirm Plan Change</DialogTitle>
          <DialogDescription className="text-center space-y-2">
            <p>You are about to change your subscription plan:</p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium">From: {currentPlan}</p>
              <p className="font-medium">To: {targetPlan}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Your existing tokens will remain unchanged. The new plan will take effect immediately, 
              and you'll be billed at the new rate starting from your next renewal.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-black text-white hover:bg-black/90"
          >
            {isLoading ? 'Processing...' : 'Confirm Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
