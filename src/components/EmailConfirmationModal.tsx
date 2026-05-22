
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPendingClaimIds } from '@/hooks/useWorksheetClaim';

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
}

export const EmailConfirmationModal: React.FC<EmailConfirmationModalProps> = ({
  isOpen,
  onClose,
  email
}) => {
  const navigate = useNavigate();
  const pendingClaimsCount = getPendingClaimIds().length;

  const handleGoToLogin = () => {
    onClose();
    navigate('/login');
  };

  const handleGoHome = () => {
    onClose();
    navigate('/');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle>Check Your Email</DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <p>We've sent a confirmation email to:</p>
            <p className="font-semibold text-primary">{email}</p>
            <p>Please check your email and click the confirmation link to activate your account.</p>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-800">
                <p className="font-medium">Account created successfully!</p>
                <p>You'll receive 2 free tokens after email confirmation.</p>
                {pendingClaimsCount > 0 && (
                  <p className="mt-1 font-medium">
                    Your {pendingClaimsCount === 1 ? 'worksheet' : `${pendingClaimsCount} worksheets`} will be saved to your account after confirmation.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>What's next:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Check your inbox for the confirmation email from Supabase (and spam folder)</li>
              <li>Click the confirmation link to activate your account</li>
              <li>You'll then receive a welcome email from <strong>hello@edooqoo.com</strong> with next steps</li>
              <li>Sign in and start generating worksheets!</li>
            </ol>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleGoToLogin} className="flex-1">
              Go to Sign In
            </Button>
            <Button onClick={handleGoHome} variant="outline" className="flex-1">
              Go to Home
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
