import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StudentEmailVerificationProps {
  onVerified: (email: string) => void;
  verifyEmail: (homeworkId: string, email: string) => Promise<boolean>;
  homeworkId: string;
  studentName: string;
  teacherName: string;
}

export const StudentEmailVerification = ({
  onVerified,
  verifyEmail,
  homeworkId,
  studentName,
  teacherName
}: StudentEmailVerificationProps) => {
  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      const isValid = await verifyEmail(homeworkId, email.trim().toLowerCase());
      
      if (isValid) {
        onVerified(email.trim().toLowerCase());
      } else {
        setError('This email is not associated with this homework assignment. Please check your email address and try again.');
      }
    } catch (err) {
      setError('An error occurred while verifying your email. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome, {studentName}!</CardTitle>
          <CardDescription>
            Please enter your email to access this homework assignment from {teacherName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Your Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isVerifying}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isVerifying || !email}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Start Homework'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your answers will be automatically saved as you work.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
