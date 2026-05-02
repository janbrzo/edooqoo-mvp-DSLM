import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar, Loader2 } from 'lucide-react';
import { saveHubEmail, getSavedHubEmail } from '@/hooks/useStudentHubData';

const EMAIL_STORAGE_KEY = 'book_student_email';

function getSavedValue(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (new Date(expiresAt) < new Date()) { localStorage.removeItem(key); return null; }
    return value;
  } catch { return null; }
}

const PublicBookingPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    const hubEmail = getSavedHubEmail();
    const bookEmail = getSavedValue(EMAIL_STORAGE_KEY);
    const savedEmail = hubEmail || bookEmail;
    if (savedEmail && token) {
      saveHubEmail(savedEmail);
      navigate(`/my/${token}/lessons`, { replace: true });
    } else {
      setRedirecting(false);
    }
  }, [token, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !token) return;
    saveHubEmail(email.trim());
    navigate(`/my/${token}/lessons`, { replace: true });
  };

  if (redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Calendar className="h-10 w-10 mx-auto text-primary mb-2" />
          <CardTitle className="text-2xl">Book a Lesson</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Enter your email to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-sm">Your Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!email.trim()}>
              Continue to Booking
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicBookingPage;
