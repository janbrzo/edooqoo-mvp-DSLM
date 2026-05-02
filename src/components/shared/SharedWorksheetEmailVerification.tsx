// ============================================
// FAZA 3: Email Verification for Shared Worksheets
// ============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SharedWorksheetEmailVerificationProps {
  onVerified: (email: string) => void;
  verifyEmail: (worksheetId: string, email: string) => Promise<boolean>;
  worksheetId: string;
  worksheetTitle: string;
  teacherEmail: string;
}

export const SharedWorksheetEmailVerification = ({
  onVerified,
  verifyEmail,
  worksheetId,
  worksheetTitle,
  teacherEmail
}: SharedWorksheetEmailVerificationProps) => {
  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      const isValid = await verifyEmail(worksheetId, email.trim().toLowerCase());
      
      if (isValid) {
        onVerified(email.trim().toLowerCase());
      } else {
        setError('This email is not authorized to access this worksheet. Please check your email address and try again, or contact your teacher.');
      }
    } catch (err) {
      setError('An error occurred while verifying your email. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Extract teacher name from email for display
  const teacherName = teacherEmail.split('@')[0] || 'Your Teacher';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-worksheet-purple/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-worksheet-purple" />
          </div>
          <CardTitle className="text-2xl">Access Worksheet</CardTitle>
          <CardDescription className="mt-2">
            <span className="font-medium text-worksheet-purple">{worksheetTitle}</span>
            <br />
            <span className="text-sm">Shared by: {teacherName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Enter your email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isVerifying}
                className="focus:border-worksheet-purple"
              />
              <p className="text-xs text-muted-foreground">
                Use the email address your teacher has registered for you.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-worksheet-purple hover:bg-worksheet-purpleDark" 
              disabled={isVerifying || !email}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Access Worksheet'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
