
import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  userEmail?: string;
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userEmail = ''
}) => {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (confirmEmail !== userEmail) return;
    
    setIsDeleting(true);
    try {
      const success = await onConfirm();
      if (success) {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmEmail('');
    onClose();
  };

  const isEmailValid = confirmEmail === userEmail;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action will permanently delete your account and remove access to all your data.
            </p>
            <p className="text-sm text-muted-foreground">
              Your worksheet history will be preserved for administrative purposes, but you will lose access to your account.
            </p>
            <p className="text-sm text-muted-foreground">
              You can create a new account with the same email address if needed.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2">
          <Label htmlFor="confirm-email">
            Type your email address to confirm deletion:
          </Label>
          <Input
            id="confirm-email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={userEmail}
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isEmailValid || isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
