import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { saveHubEmail, getSavedHubEmail } from '@/hooks/useStudentHubData';

const STORAGE_KEY = 'book_landing_email';
const TTL_DAYS = 7;

function getSavedEmail(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { email, expiresAt } = JSON.parse(raw);
    if (new Date(expiresAt) < new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return email;
  } catch {
    return null;
  }
}

function saveEmail(email: string) {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, expiresAt }));
}

interface Teacher {
  name: string;
  token: string;
}

const BookLandingPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const saved = getSavedEmail() || getSavedHubEmail();
    if (saved) {
      setEmail(saved);
      findTeachers(saved);
    }
  }, []);

  // Auto-redirect when exactly 1 teacher found
  useEffect(() => {
    if (teachers.length === 1 && !loading && searched) {
      saveHubEmail(email.trim());
      navigate(`/my/${teachers[0].token}/lessons`, { replace: true });
    }
  }, [teachers, loading, searched]);

  const findTeachers = async (emailToSearch: string) => {
    if (!emailToSearch.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('find-teachers-by-student-email', {
        body: { email: emailToSearch.trim() },
      });
      if (error) throw error;
      setTeachers(data?.teachers || []);
      saveEmail(emailToSearch.trim());
    } catch (err: any) {
      console.error('Error finding teachers:', err);
      toast.error('Could not find teachers');
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    findTeachers(email);
  };

  const handleSelectTeacher = (token: string) => {
    saveHubEmail(email.trim());
    navigate(`/my/${token}/lessons`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Calendar className="h-10 w-10 mx-auto text-primary mb-2" />
          <CardTitle className="text-2xl">Book a Lesson</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Enter your email to find your teacher's calendar</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-sm">Your Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? 'Searching...' : 'Find My Teacher'}
            </Button>
          </form>

          {searched && !loading && teachers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teachers found for this email. Make sure your teacher has added you as a student.
            </p>
          )}

          {teachers.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select your teacher:</p>
              {teachers.map((t, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  onClick={() => handleSelectTeacher(t.token)}
                >
                  <span className="font-medium">{t.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookLandingPage;
