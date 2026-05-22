import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GraduationCap, ArrowRight, Loader2, LogOut, Lock } from 'lucide-react';
import { HubGoogleSignInButton } from '@/components/student-hub/HubGoogleSignInButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getSavedHubEmail, saveHubEmail, clearHubEmail } from '@/hooks/useStudentHubData';
import { AppBackground } from '@/components/ui/AppBackground';
import { BackgroundPatternSwitcher } from '@/components/ui/BackgroundPatternSwitcher';

interface Teacher {
  name: string;
  token: string;
}

const StudentHubLanding = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Password flow state
  const [pendingTeacher, setPendingTeacher] = useState<Teacher | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const saved = getSavedHubEmail();
    if (saved) {
      setEmail(saved);
      findTeachers(saved);
    }
  }, []);

  const checkPasswordAndNavigate = async (teacher: Teacher) => {
    try {
      const { data } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacher.token, email: email.trim(), action: 'check_password_required' },
      });
      if (data?.requiresPassword) {
        setPendingTeacher(teacher);
        setPasswordRequired(true);
        setPassword('');
      } else {
        saveHubEmail(email.trim());
        navigate(`/my/${teacher.token}`);
      }
    } catch {
      // Fallback: navigate without check
      saveHubEmail(email.trim());
      navigate(`/my/${teacher.token}`);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pendingTeacher || !password) return;
    setVerifying(true);
    try {
      const { data } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: pendingTeacher.token, email: email.trim(), action: 'verify_password', password },
      });
      if (data?.verified) {
        saveHubEmail(email.trim());
        navigate(`/my/${pendingTeacher.token}`);
      } else {
        toast.error('Incorrect password');
      }
    } catch {
      toast.error('Failed to verify password');
    } finally {
      setVerifying(false);
    }
  };

  const findTeachers = async (emailToSearch: string) => {
    if (!emailToSearch.trim()) return;
    setLoading(true);
    setSearched(true);
    setPasswordRequired(false);
    setPendingTeacher(null);
    try {
      const { data, error } = await supabase.functions.invoke('find-teachers-by-student-email', {
        body: { email: emailToSearch.trim() },
      });
      if (error) throw error;
      const found = data?.teachers || [];
      setTeachers(found);
      saveHubEmail(emailToSearch.trim());

      // Auto-redirect if single teacher (with password check)
      if (found.length === 1) {
        await checkPasswordAndNavigate(found[0]);
      }
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

  const handleLogout = () => {
    clearHubEmail();
    setEmail('');
    setTeachers([]);
    setSearched(false);
    setPasswordRequired(false);
    setPendingTeacher(null);
  };

  const savedEmail = getSavedHubEmail();

  return (
    <AppBackground className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full min-h-[340px]">
        <CardHeader className="text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-primary mb-2" />
          <CardTitle className="text-2xl">My Learning Hub</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email to access your flashcards, homework, worksheets & lessons
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Password verification screen */}
          {passwordRequired && pendingTeacher ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>This Hub is password-protected</span>
              </div>
              <div>
                <Label className="text-sm">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your Hub password"
                  onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={handlePasswordSubmit} disabled={verifying || !password}>
                {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {verifying ? 'Verifying...' : 'Continue'}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setPasswordRequired(false); setPendingTeacher(null); }}>
                ← Back
              </Button>
            </div>
          ) : (
            <>
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
                  {loading ? 'Searching...' : 'Access My Materials'}
                </Button>
              </form>

              <HubGoogleSignInButton onEmailResolved={(resolvedEmail) => {
                setEmail(resolvedEmail);
                findTeachers(resolvedEmail);
              }} />

              {savedEmail && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={handleLogout}>
                  <LogOut className="h-3 w-3 mr-1" /> Log out ({savedEmail})
                </Button>
              )}

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
                      onClick={() => checkPasswordAndNavigate(t)}
                    >
                      <span className="font-medium">{t.name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <BackgroundPatternSwitcher />
    </AppBackground>
  );
};

export default StudentHubLanding;